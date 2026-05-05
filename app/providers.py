import json
import re
from abc import ABC, abstractmethod
from typing import Any

import httpx
from openai import AsyncOpenAI
from groq import AsyncGroq

from app.config import Settings


class ProviderUnavailableError(RuntimeError):
    pass


class LLMProvider(ABC):
    @abstractmethod
    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        raise NotImplementedError


def parse_json_response(raw_text: str) -> dict[str, Any]:
    text = clean_model_text(raw_text)
    if text.startswith("```"):
        text = text.strip("`")
        text = text.removeprefix("json").strip()
    if not text.startswith("{"):
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if match:
            text = match.group(0)
    return json.loads(text)


def clean_model_text(raw_text: str) -> str:
    text = raw_text.strip()
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()
    if text.lower().startswith("<think>"):
        marker = "</think>"
        if marker in text.lower():
            text = text[text.lower().find(marker) + len(marker) :].strip()
    return text


class GroqProvider(LLMProvider):
    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise ProviderUnavailableError("GROQ_API_KEY is not configured")
        self.client = AsyncGroq(api_key=api_key)
        self.model = model

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        return parse_json_response(response.choices[0].message.content)

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return clean_model_text(response.choices[0].message.content)


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise ProviderUnavailableError("OPENAI_API_KEY is not configured")
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        response = await self.client.responses.create(
            model=self.model,
            instructions=system_prompt,
            input=user_prompt,
            text={"format": {"type": "json_object"}},
        )
        return parse_json_response(response.output_text)

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.responses.create(
            model=self.model,
            instructions=system_prompt,
            input=user_prompt,
        )
        return clean_model_text(response.output_text)


class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise ProviderUnavailableError("GOOGLE_API_KEY is not configured")
        self.api_key = api_key
        self.model = model

    async def _generate(self, system_prompt: str, user_prompt: str) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, params={"key": self.api_key}, json=payload)
            response.raise_for_status()
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        return parse_json_response(await self._generate(system_prompt, user_prompt))

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        return clean_model_text(await self._generate(system_prompt, user_prompt))


class SarvamProvider(LLMProvider):
    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise ProviderUnavailableError("SARVAM_API_KEY is not configured")
        self.api_key = api_key
        self.model = model

    async def _chat(self, system_prompt: str, user_prompt: str) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": f"{system_prompt}\nDo not reveal chain-of-thought. Do not include <think> blocks."},
                {"role": "user", "content": user_prompt},
            ],
        }
        headers = {"api-subscription-key": self.api_key}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post("https://api.sarvam.ai/v1/chat/completions", json=payload, headers=headers)
            response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        return parse_json_response(await self._chat(system_prompt, user_prompt))

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        return clean_model_text(await self._chat(system_prompt, user_prompt))


class ProviderChain:
    def __init__(self, providers: list[LLMProvider]):
        self.providers = providers

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        last_error: Exception | None = None
        for provider in self.providers:
            try:
                return await provider.complete_json(system_prompt, user_prompt)
            except Exception as exc:  # External provider failures should fall through to local parsing.
                last_error = exc
        raise ProviderUnavailableError(str(last_error) if last_error else "No providers configured")

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        last_error: Exception | None = None
        for provider in self.providers:
            try:
                return await provider.complete_text(system_prompt, user_prompt)
            except Exception as exc:
                last_error = exc
        raise ProviderUnavailableError(str(last_error) if last_error else "No providers configured")


def build_provider_chain(settings: Settings) -> ProviderChain:
    ordered_names = [settings.llm_provider.lower(), *settings.fallback_provider_names]
    providers: list[LLMProvider] = []
    for name in dict.fromkeys(ordered_names):
        try:
            if name == "groq":
                providers.append(GroqProvider(settings.groq_api_key, settings.groq_model))
            elif name == "openai":
                providers.append(OpenAIProvider(settings.openai_api_key, settings.openai_model))
            elif name in {"google", "gemini"}:
                providers.append(GeminiProvider(settings.google_api_key, settings.gemini_model))
            elif name == "sarvam":
                providers.append(SarvamProvider(settings.sarvam_api_key, settings.sarvam_model))
        except ProviderUnavailableError:
            continue
    return ProviderChain(providers)
