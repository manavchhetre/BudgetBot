from datetime import UTC, datetime
from typing import Any, Protocol

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from app.models import TransactionCreate


def serialize_value(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {key: serialize_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    return value


def serialize_id(document: dict[str, Any]) -> dict[str, Any]:
    result = serialize_value(dict(document))
    if "_id" in result:
        result["id"] = str(result.pop("_id"))
    return result


class BudgetRepository(Protocol):
    async def ensure_indexes(self) -> None: ...
    async def create_user(self, name: str, email: str, password_hash: str) -> dict[str, Any]: ...
    async def get_user_by_email(self, email: str) -> dict[str, Any] | None: ...
    async def get_user_by_id(self, user_id: str) -> dict[str, Any] | None: ...
    async def create_conversation(self, user_id: str, title: str) -> dict[str, Any]: ...
    async def get_conversations(self, user_id: str) -> list[dict[str, Any]]: ...
    async def add_message(self, user_id: str, conversation_id: str, role: str, content: str) -> dict[str, Any]: ...
    async def get_messages(self, user_id: str, conversation_id: str, limit: int = 30) -> list[dict[str, Any]]: ...
    async def create_transaction(self, user_id: str, transaction: TransactionCreate) -> dict[str, Any]: ...
    async def get_transactions(self, user_id: str, limit: int = 100) -> list[dict[str, Any]]: ...
    async def analytics_summary(self, user_id: str) -> dict[str, Any]: ...


class MongoBudgetRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def ensure_indexes(self) -> None:
        await self.db.users.create_index("email", unique=True)
        await self.db.conversations.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
        await self.db.messages.create_index([("conversation_id", ASCENDING), ("created_at", ASCENDING)])
        await self.db.transactions.create_index([("user_id", ASCENDING), ("date", DESCENDING)])

    async def create_user(self, name: str, email: str, password_hash: str) -> dict[str, Any]:
        now = datetime.now(UTC)
        document = {
            "name": name.strip(),
            "email": email.lower(),
            "password_hash": password_hash,
            "created_at": now,
        }
        result = await self.db.users.insert_one(document)
        document["_id"] = result.inserted_id
        return serialize_id(document)

    async def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        document = await self.db.users.find_one({"email": email.lower()})
        return serialize_id(document) if document else None

    async def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(user_id):
            return None
        document = await self.db.users.find_one({"_id": ObjectId(user_id)})
        return serialize_id(document) if document else None

    async def create_conversation(self, user_id: str, title: str) -> dict[str, Any]:
        now = datetime.now(UTC)
        document = {
            "user_id": ObjectId(user_id),
            "title": title[:80] or "New chat",
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.conversations.insert_one(document)
        document["_id"] = result.inserted_id
        return serialize_id(document)

    async def get_conversations(self, user_id: str) -> list[dict[str, Any]]:
        cursor = self.db.conversations.find({"user_id": ObjectId(user_id)}).sort("updated_at", DESCENDING)
        return [serialize_id(document) async for document in cursor]

    async def add_message(self, user_id: str, conversation_id: str, role: str, content: str) -> dict[str, Any]:
        now = datetime.now(UTC)
        document = {
            "user_id": ObjectId(user_id),
            "conversation_id": ObjectId(conversation_id),
            "role": role,
            "content": content,
            "created_at": now,
        }
        result = await self.db.messages.insert_one(document)
        await self.db.conversations.update_one(
            {"_id": ObjectId(conversation_id), "user_id": ObjectId(user_id)},
            {"$set": {"updated_at": now}},
        )
        document["_id"] = result.inserted_id
        return serialize_id(document)

    async def get_messages(self, user_id: str, conversation_id: str, limit: int = 30) -> list[dict[str, Any]]:
        cursor = (
            self.db.messages.find({"user_id": ObjectId(user_id), "conversation_id": ObjectId(conversation_id)})
            .sort("created_at", DESCENDING)
            .limit(limit)
        )
        messages = [serialize_id(document) async for document in cursor]
        return list(reversed(messages))

    async def create_transaction(self, user_id: str, transaction: TransactionCreate) -> dict[str, Any]:
        now = datetime.now(UTC)
        document = transaction.model_dump()
        document.update(
            {
                "user_id": ObjectId(user_id),
                "category": transaction.category or "Uncategorized",
                "date": transaction.date or now,
                "created_at": now,
            }
        )
        result = await self.db.transactions.insert_one(document)
        document["_id"] = result.inserted_id
        return serialize_id(document)

    async def get_transactions(self, user_id: str, limit: int = 100) -> list[dict[str, Any]]:
        cursor = self.db.transactions.find({"user_id": ObjectId(user_id)}).sort("date", DESCENDING).limit(limit)
        return [serialize_id(document) async for document in cursor]

    async def analytics_summary(self, user_id: str) -> dict[str, Any]:
        object_user_id = ObjectId(user_id)
        transactions = await self.get_transactions(user_id, limit=500)
        total_spend = sum(float(item["amount"]) for item in transactions)

        category_totals: dict[str, float] = {}
        merchant_totals: dict[str, float] = {}
        daily_totals: dict[str, float] = {}
        monthly_totals: dict[str, float] = {}
        for item in transactions:
            amount = float(item["amount"])
            category = item.get("category") or "Uncategorized"
            merchant = item.get("merchant") or "Unknown"
            day = item["date"].strftime("%Y-%m-%d")
            month = item["date"].strftime("%Y-%m")
            category_totals[category] = category_totals.get(category, 0.0) + amount
            merchant_totals[merchant] = merchant_totals.get(merchant, 0.0) + amount
            daily_totals[day] = daily_totals.get(day, 0.0) + amount
            monthly_totals[month] = monthly_totals.get(month, 0.0) + amount

        top_category = max(category_totals, key=category_totals.get) if category_totals else None
        top_merchant = max(merchant_totals, key=merchant_totals.get) if merchant_totals else None
        return {
            "total_spend": total_spend,
            "transaction_count": await self.db.transactions.count_documents({"user_id": object_user_id}),
            "top_category": top_category,
            "top_merchant": top_merchant,
            "category_breakdown": [
                {"category": key, "amount": value}
                for key, value in sorted(category_totals.items(), key=lambda pair: pair[1], reverse=True)
            ],
            "daily_breakdown": [
                {"date": key, "amount": daily_totals[key]}
                for key in sorted(daily_totals, reverse=True)
            ],
            "monthly_trend": [
                {"month": key, "amount": monthly_totals[key]}
                for key in sorted(monthly_totals)
            ],
            "recent_transactions": transactions[:8],
        }
