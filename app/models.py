from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class Intent(str, Enum):
    add_transaction = "add_transaction"
    edit_transaction = "edit_transaction"
    delete_transaction = "delete_transaction"
    analytics_query = "analytics_query"
    general_chat = "general_chat"


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    avatar: str | None = None
    monthly_income: float | None = None
    user_summary: str | None = None


class UserProfileUpdate(BaseModel):
    name: str | None = None
    avatar: str | None = None
    monthly_income: float | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    conversation_id: str
    message: str
    intent: Intent
    transaction_saved: bool = False
    transactions_saved_count: int = 0
    needs_clarification: bool = False


class TransactionDraft(BaseModel):
    amount: float | None = None
    currency: str = "INR"
    merchant: str | None = None
    category: str | None = None
    date: datetime | None = None
    notes: str | None = None

    def missing_required_fields(self) -> list[str]:
        missing: list[str] = []
        if self.amount is None:
            missing.append("amount")
        if not self.merchant:
            missing.append("merchant")
        return missing


class TransactionCreate(TransactionDraft):
    amount: float
    merchant: str
    source_message_id: str


class TransactionPublic(BaseModel):
    id: str
    amount: float
    currency: str
    merchant: str
    category: str
    date: datetime
    notes: str | None = None
    created_at: datetime


class CategoryBudgetCreate(BaseModel):
    category: str
    limit_amount: float

class CategoryBudget(BaseModel):
    category: str
    limit_amount: float
    spent_amount: float = 0.0
    remaining_amount: float = 0.0

class AnalyticsSummary(BaseModel):
    total_spend: float
    monthly_income: float | None = None
    remaining_budget: float | None = None
    transaction_count: int
    top_category: str | None
    top_merchant: str | None
    category_breakdown: list[dict[str, Any]]
    daily_breakdown: list[dict[str, Any]]
    budget_tracking: list[CategoryBudget] = []
    monthly_trend: list[dict[str, Any]]
    recent_transactions: list[TransactionPublic]
