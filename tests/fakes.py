from collections import defaultdict
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from pymongo.errors import DuplicateKeyError

from app.models import TransactionCreate
from app.repositories import BudgetRepository


class InMemoryBudgetRepository(BudgetRepository):
    def __init__(self):
        self.users: dict[str, dict[str, Any]] = {}
        self.conversations: dict[str, dict[str, Any]] = {}
        self.messages: dict[str, dict[str, Any]] = {}
        self.transactions: dict[str, dict[str, Any]] = {}

    async def ensure_indexes(self) -> None:
        return None

    async def create_user(self, name: str, email: str, password_hash: str) -> dict[str, Any]:
        if await self.get_user_by_email(email):
            raise DuplicateKeyError("duplicate email")
        user = {
            "id": str(uuid4()),
            "name": name,
            "email": email.lower(),
            "password_hash": password_hash,
            "created_at": datetime.now(UTC),
        }
        self.users[user["id"]] = user
        return dict(user)

    async def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        for user in self.users.values():
            if user["email"] == email.lower():
                return dict(user)
        return None

    async def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        user = self.users.get(user_id)
        return dict(user) if user else None

    async def create_conversation(self, user_id: str, title: str) -> dict[str, Any]:
        now = datetime.now(UTC)
        conversation = {
            "id": str(uuid4()),
            "user_id": user_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
        }
        self.conversations[conversation["id"]] = conversation
        return dict(conversation)

    async def get_conversations(self, user_id: str) -> list[dict[str, Any]]:
        rows = [item for item in self.conversations.values() if item["user_id"] == user_id]
        return [dict(item) for item in sorted(rows, key=lambda row: row["updated_at"], reverse=True)]

    async def add_message(self, user_id: str, conversation_id: str, role: str, content: str) -> dict[str, Any]:
        now = datetime.now(UTC)
        message = {
            "id": str(uuid4()),
            "user_id": user_id,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "created_at": now,
        }
        self.messages[message["id"]] = message
        if conversation_id in self.conversations:
            self.conversations[conversation_id]["updated_at"] = now
        return dict(message)

    async def get_messages(self, user_id: str, conversation_id: str, limit: int = 30) -> list[dict[str, Any]]:
        rows = [
            item
            for item in self.messages.values()
            if item["user_id"] == user_id and item["conversation_id"] == conversation_id
        ]
        return [dict(item) for item in sorted(rows, key=lambda row: row["created_at"])][-limit:]

    async def create_transaction(self, user_id: str, transaction: TransactionCreate) -> dict[str, Any]:
        now = datetime.now(UTC)
        row = transaction.model_dump()
        row.update(
            {
                "id": str(uuid4()),
                "user_id": user_id,
                "category": transaction.category or "Uncategorized",
                "date": transaction.date or now,
                "created_at": now,
            }
        )
        self.transactions[row["id"]] = row
        return dict(row)

    async def get_transactions(self, user_id: str, limit: int = 100) -> list[dict[str, Any]]:
        rows = [item for item in self.transactions.values() if item["user_id"] == user_id]
        return [dict(item) for item in sorted(rows, key=lambda row: row["date"], reverse=True)][:limit]

    async def analytics_summary(self, user_id: str) -> dict[str, Any]:
        transactions = await self.get_transactions(user_id, limit=500)
        total_spend = sum(float(item["amount"]) for item in transactions)
        category_totals: defaultdict[str, float] = defaultdict(float)
        merchant_totals: defaultdict[str, float] = defaultdict(float)
        daily_totals: defaultdict[str, float] = defaultdict(float)
        monthly_totals: defaultdict[str, float] = defaultdict(float)
        for item in transactions:
            category_totals[item.get("category") or "Uncategorized"] += float(item["amount"])
            merchant_totals[item.get("merchant") or "Unknown"] += float(item["amount"])
            daily_totals[item["date"].strftime("%Y-%m-%d")] += float(item["amount"])
            monthly_totals[item["date"].strftime("%Y-%m")] += float(item["amount"])
        return {
            "total_spend": total_spend,
            "transaction_count": len(transactions),
            "top_category": max(category_totals, key=category_totals.get) if category_totals else None,
            "top_merchant": max(merchant_totals, key=merchant_totals.get) if merchant_totals else None,
            "category_breakdown": [
                {"category": key, "amount": value}
                for key, value in sorted(category_totals.items(), key=lambda pair: pair[1], reverse=True)
            ],
            "daily_breakdown": [{"date": key, "amount": daily_totals[key]} for key in sorted(daily_totals, reverse=True)],
            "monthly_trend": [{"month": key, "amount": monthly_totals[key]} for key in sorted(monthly_totals)],
            "recent_transactions": transactions[:8],
        }
