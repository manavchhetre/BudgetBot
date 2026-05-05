import re
from datetime import datetime, timedelta
from typing import Any

from app.categorization import CATEGORY_KEYWORDS, MerchantCategorizer
from app.date_context import app_now, current_date_context
from app.models import Intent, TransactionDraft
from app.providers import ProviderChain, ProviderUnavailableError


class BudgetTextInterpreter:
    def __init__(self, provider_chain: ProviderChain, categorizer: MerchantCategorizer | None = None):
        self.provider_chain = provider_chain
        self.categorizer = categorizer or MerchantCategorizer()

    async def classify_intent(self, message: str) -> Intent:
        lowered = message.strip().lower()
        if lowered in ["hi", "hello", "hey", "yo", "greetings", "hi there", "hello there", "hey jerry", "hi jerry"]:
            return Intent.general_chat

        system_prompt = (
            f"{current_date_context()}\n"
            "Classify a personal budgeting chatbot message. Return JSON only with key intent. "
            "Allowed intents: add_transaction, analytics_query, general_chat."
        )
        try:
            data = await self.provider_chain.complete_json(system_prompt, message)
            return Intent(data.get("intent", Intent.general_chat))
        except (ProviderUnavailableError, ValueError, KeyError):
            return self._classify_with_rules(message)

    async def extract_transaction(self, message: str) -> TransactionDraft:
        system_prompt = (
            f"{current_date_context()}\n"
            "Extract one expense transaction from the user's message. Return JSON only with keys: "
            "amount number or null, currency string, merchant string or null, category string or null, "
            "date ISO datetime or null, notes string or null. Use INR unless another currency is explicit. "
            "Resolve relative dates such as today, yesterday, this morning, and last night using the current date."
        )
        try:
            data = await self.provider_chain.complete_json(system_prompt, message)
            if data.get("date"):
                data["date"] = datetime.fromisoformat(str(data["date"]).replace("Z", "+00:00"))
            merchant = data.get("merchant")
            category = await self.categorizer.categorize(merchant, message, data.get("category"))
            data["category"] = category.category
            return TransactionDraft(**data)
        except Exception:
            return await self._extract_with_rules(message)

    async def answer_general(
        self,
        message: str,
        history: list[dict[str, Any]],
        transactions: list[dict[str, Any]],
        summary: dict[str, Any],
        user_profile: dict[str, Any],
        budgets: list[dict[str, Any]],
    ) -> str:
        system_prompt = (
            f"{current_date_context()}\n"
            "You are Budget Bot, a concise financial assistant. You have context of the user's stored expenses. "
            "Use transaction history for financial guidance, mention dates when useful, and keep answers practical."
        )
        transcript = "\n".join(f"{item['role']}: {item['content']}" for item in history[-8:])
        expense_lines = "\n".join(
            f"- {item['date'].date().isoformat()}: {item['currency']} {item['amount']} at {item['merchant']} ({item['category']})"
            for item in transactions[:20]
        )
        
        income = user_profile.get("monthly_income")
        remaining = summary.get("remaining_budget")
        user_summary = user_profile.get("user_summary")
        
        financial_context = f"Monthly Income: {income if income else 'Not set'}"
        if remaining is not None:
            financial_context += f"\nRemaining Budget this month: {remaining}"
            
        if budgets:
            budget_str = "\n".join(f"- {b['category']}: Limit {b['limit_amount']}" for b in budgets)
            financial_context += f"\n\nCategory Budgets:\n{budget_str}"
            
        prompt = (
            f"User Profile Summary:\n{user_summary or 'No additional context.'}\n\n"
            f"Financial Context:\n{financial_context}\n\n"
            f"Spending summary: {summary}\n\nRecent expenses:\n{expense_lines or 'No expenses yet.'}\n\n"
            f"Conversation:\n{transcript}\n\nUser message:\n{message}"
        )
        try:
            return await self.provider_chain.complete_text(system_prompt, prompt)
        except ProviderUnavailableError:
            return "I can track expenses and summarize your spending. Try: 'I spent 450 on lunch at Cafe Coffee Day'."

    async def update_user_summary(self, current_summary: str | None, message: str) -> str:
        system_prompt = (
            "You are a background agent responsible for maintaining a concise, long-term summary of the user's "
            "financial situation, goals, and personal details. You will be given the current summary and a new message. "
            "Update the summary with any new important facts. Keep it under 3 sentences. "
            "Do NOT include transient details like a single purchase of coffee. "
            "Do include things like: user is saving for a house, user has a dog, user works as a developer."
        )
        prompt = f"Current summary:\n{current_summary or 'None'}\n\nNew message:\n{message}"
        try:
            return await self.provider_chain.complete_text(system_prompt, prompt)
        except Exception:
            return current_summary or ""

    def _classify_with_rules(self, message: str) -> Intent:
        lowered = message.lower()
        analytics_terms = [
            "summary",
            "analytics",
            "most",
            "total",
            "where",
            "how much",
            "date-wise",
            "date wise",
            "daily",
            "spending",
            "spent recently",
        ]
        if "?" in message or any(word in lowered for word in analytics_terms):
            return Intent.analytics_query
        if any(word in lowered for word in ["spent", "paid", "bought", "expense", "transaction"]):
            return Intent.add_transaction
        if re.search(r"(rs\.?|inr|\u20b9|\$)\s*\d+|\d+\s*(rs|rupees|inr|dollars)", lowered):
            return Intent.add_transaction
        return Intent.general_chat

    async def _extract_with_rules(self, message: str) -> TransactionDraft:
        amount = self._extract_amount(message)
        merchant = self._extract_merchant(message)
        category = await self.categorizer.categorize(merchant, message)
        return TransactionDraft(
            amount=amount,
            currency=self._extract_currency(message),
            merchant=merchant,
            category=category.category,
            date=self._extract_date(message),
            notes=message,
        )

    def _extract_amount(self, message: str) -> float | None:
        patterns = [
            r"(?:rs\.?|inr|\u20b9)\s*(\d+(?:\.\d+)?)",
            r"(\d+(?:\.\d+)?)\s*(?:rs|rupees|inr)",
            r"\$\s*(\d+(?:\.\d+)?)",
            r"\b(\d+(?:\.\d+)?)\b",
        ]
        for pattern in patterns:
            match = re.search(pattern, message, flags=re.IGNORECASE)
            if match:
                return float(match.group(1))
        return None

    def _extract_currency(self, message: str) -> str:
        lowered = message.lower()
        if "$" in message or "dollar" in lowered or "usd" in lowered:
            return "USD"
        return "INR"

    def _extract_date(self, message: str) -> datetime:
        lowered = message.lower()
        now = app_now()
        iso_match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", message)
        if iso_match:
            return datetime.fromisoformat(iso_match.group(1)).replace(tzinfo=now.tzinfo)
        slash_match = re.search(r"\b(\d{1,2})/(\d{1,2})/(20\d{2})\b", message)
        if slash_match:
            day, month, year = (int(part) for part in slash_match.groups())
            return datetime(year, month, day, tzinfo=now.tzinfo)
        if "yesterday" in lowered:
            return now - timedelta(days=1)
        if "tomorrow" in lowered:
            return now + timedelta(days=1)
        if "last night" in lowered:
            return (now - timedelta(days=1)).replace(hour=21, minute=0, second=0, microsecond=0)
        return now

    def _extract_merchant(self, message: str) -> str | None:
        match = re.search(r"\b(?:at|to|from)\s+([A-Za-z0-9&.' -]{2,60})", message, flags=re.IGNORECASE)
        if not match:
            match = re.search(r"\bon\s+([A-Za-z0-9&.' -]{2,60})", message, flags=re.IGNORECASE)
        if not match:
            return None
        merchant = re.split(r"\b(?:for|yesterday|today|on|using)\b", match.group(1), flags=re.IGNORECASE)[0]
        merchant = merchant.strip(" .")
        return merchant or None
