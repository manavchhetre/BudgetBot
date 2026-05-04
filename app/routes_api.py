import asyncio
import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.agent import BudgetAgent
from app.budget_parser import BudgetTextInterpreter
from app.categorization import MerchantCategorizer
from app.config import Settings, get_settings
from app.dependencies import get_repository, require_user
from app.rate_limit import limiter
from app.models import AnalyticsSummary, ChatRequest, ChatResponse, TransactionPublic
from app.providers import build_provider_chain
from app.repositories import BudgetRepository

logger = logging.getLogger("jerry.api")

router = APIRouter(prefix="/api")


def get_agent(
    repository: Annotated[BudgetRepository, Depends(get_repository)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> BudgetAgent:
    provider_chain = build_provider_chain(settings)
    categorizer = MerchantCategorizer(web_search_enabled=settings.web_search_enabled)
    return BudgetAgent(repository, BudgetTextInterpreter(provider_chain, categorizer))


@router.get("/conversations")
async def conversations(
    user: Annotated[dict, Depends(require_user)],
    repository: Annotated[BudgetRepository, Depends(get_repository)],
) -> list[dict]:
    return await repository.get_conversations(user["id"])


@router.get("/conversations/{conversation_id}/messages")
async def conversation_messages(
    conversation_id: str,
    user: Annotated[dict, Depends(require_user)],
    repository: Annotated[BudgetRepository, Depends(get_repository)],
) -> list[dict]:
    return await repository.get_messages(user["id"], conversation_id, limit=100)


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("30/minute")
async def chat(
    request: Request,
    payload: ChatRequest,
    user: Annotated[dict, Depends(require_user)],
    agent: Annotated[BudgetAgent, Depends(get_agent)],
) -> ChatResponse:
    logger.info("Chat from user %s: %.60s…", user["id"], payload.message)
    return await agent.handle_message(user["id"], payload.message, payload.conversation_id)


@router.post("/chat/stream")
@limiter.limit("30/minute")
async def chat_stream(
    request: Request,
    payload: ChatRequest,
    user: Annotated[dict, Depends(require_user)],
    agent: Annotated[BudgetAgent, Depends(get_agent)],
) -> StreamingResponse:
    logger.info("Stream chat from user %s: %.60s…", user["id"], payload.message)

    async def event_stream():
        response = await agent.handle_message(user["id"], payload.message, payload.conversation_id)
        yield json.dumps(
            {
                "type": "meta",
                "conversation_id": response.conversation_id,
                "intent": response.intent,
                "transaction_saved": response.transaction_saved,
                "needs_clarification": response.needs_clarification,
            }
        ) + "\n"
        words = response.message.split(" ")
        for index, word in enumerate(words):
            separator = "" if index == len(words) - 1 else " "
            yield json.dumps({"type": "chunk", "text": word + separator}) + "\n"
            await asyncio.sleep(0.015)
        yield json.dumps({"type": "done"}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.get("/analytics/summary", response_model=AnalyticsSummary)
async def analytics_summary(
    user: Annotated[dict, Depends(require_user)],
    repository: Annotated[BudgetRepository, Depends(get_repository)],
) -> AnalyticsSummary:
    return AnalyticsSummary(**await repository.analytics_summary(user["id"]))


@router.get("/transactions", response_model=list[TransactionPublic])
async def transactions(
    user: Annotated[dict, Depends(require_user)],
    repository: Annotated[BudgetRepository, Depends(get_repository)],
) -> list[TransactionPublic]:
    return [TransactionPublic(**item) for item in await repository.get_transactions(user["id"])]

