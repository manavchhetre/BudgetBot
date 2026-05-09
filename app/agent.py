from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from app.budget_parser import BudgetTextInterpreter
from app.models import ChatResponse, Intent, TransactionCreate, TransactionDraft
from app.repositories import BudgetRepository


class BudgetAgentState(TypedDict, total=False):
    user_id: str
    conversation_id: str
    message: str
    user_message_id: str
    user_profile: dict[str, Any]
    budgets: list[dict[str, Any]]
    history: list[dict[str, Any]]
    transactions: list[dict[str, Any]]
    summary: dict[str, Any]
    intent: Intent
    extracted_data: dict[str, Any]
    drafts: list[TransactionDraft]
    response: str
    transaction_saved: bool
    transactions_saved_count: int
    needs_clarification: bool
    artifacts: list[dict[str, Any]]


class BudgetAgent:
    def __init__(self, repository: BudgetRepository, interpreter: BudgetTextInterpreter):
        self.repository = repository
        self.interpreter = interpreter
        self.graph = self._build_graph()

    async def handle_message(self, user_id: str, message: str, conversation_id: str | None = None) -> ChatResponse:
        conversation = None
        if conversation_id is None:
            conversation = await self.repository.create_conversation(user_id, self._title_from_message(message))
            conversation_id = conversation["id"]
        user_message = await self.repository.add_message(user_id, conversation_id, "user", message)
        state = await self.graph.ainvoke(
            {
                "user_id": user_id,
                "conversation_id": conversation_id,
                "message": message,
                "user_message_id": user_message["id"],
            }
        )
        await self.repository.add_message(user_id, conversation_id, "assistant", state["response"])
        return ChatResponse(
            conversation_id=conversation_id,
            message=state["response"],
            intent=state["intent"],
            transaction_saved=state.get("transaction_saved", False),
            transactions_saved_count=state.get("transactions_saved_count", 0),
            needs_clarification=state.get("needs_clarification", False),
            artifacts=state.get("artifacts", []),
        )

    def _build_graph(self):
        graph = StateGraph(BudgetAgentState)
        graph.add_node("load_history", self._load_history)
        graph.add_node("classify_intent", self._classify_intent)
        graph.add_node("extract_transaction", self._extract_transaction)
        graph.add_node("persist_transaction", self._persist_transaction)
        graph.add_node("clarify_transaction", self._clarify_transaction)
        graph.add_node("edit_transaction", self._edit_transaction)
        graph.add_node("delete_transaction", self._delete_transaction)
        graph.add_node("update_profile", self._update_profile)
        graph.add_node("answer_analytics", self._answer_analytics)
        graph.add_node("answer_general", self._answer_general)

        graph.set_entry_point("load_history")
        graph.add_edge("load_history", "classify_intent")
        graph.add_conditional_edges(
            "classify_intent",
            self._route_by_intent,
            {
                "extract_transaction": "extract_transaction",
                "edit_transaction": "edit_transaction",
                "delete_transaction": "delete_transaction",
                "update_profile": "update_profile",
                "answer_analytics": "answer_analytics",
                "answer_general": "answer_general",
            },
        )
        graph.add_conditional_edges(
            "extract_transaction",
            self._route_transaction,
            {
                "persist_transaction": "persist_transaction",
                "clarify_transaction": "clarify_transaction",
            },
        )
        graph.add_edge("persist_transaction", END)
        graph.add_edge("clarify_transaction", END)
        graph.add_edge("edit_transaction", END)
        graph.add_edge("delete_transaction", END)
        graph.add_edge("update_profile", END)
        graph.add_edge("answer_analytics", END)
        graph.add_edge("answer_general", END)
        return graph.compile()

    async def _load_history(self, state: BudgetAgentState) -> BudgetAgentState:
        state["user_profile"] = await self.repository.get_user_by_id(state["user_id"])
        state["budgets"] = await self.repository.get_category_budgets(state["user_id"])
        state["history"] = await self.repository.get_messages(state["user_id"], state["conversation_id"], limit=30)
        state["transactions"] = await self.repository.get_transactions(state["user_id"], limit=100)
        state["summary"] = await self.repository.analytics_summary(state["user_id"])
        return state

    async def _classify_intent(self, state: BudgetAgentState) -> BudgetAgentState:
        classification = await self.interpreter.classify_intent(state["message"])
        state["intent"] = classification["intent"]
        state["extracted_data"] = classification
        return state

    async def _extract_transaction(self, state: BudgetAgentState) -> BudgetAgentState:
        state["drafts"] = await self.interpreter.extract_transactions(state["message"])
        return state

    async def _persist_transaction(self, state: BudgetAgentState) -> BudgetAgentState:
        drafts = state["drafts"]
        saved_items = []
        for draft in drafts:
            transaction = TransactionCreate(
                amount=draft.amount or 0,
                currency=draft.currency,
                merchant=draft.merchant or "Unknown",
                category=draft.category or "Uncategorized",
                date=draft.date,
                notes=draft.notes,
                source_message_id=state["user_message_id"],
            )
            saved = await self.repository.create_transaction(state["user_id"], transaction)
            saved_items.append(saved)

        state["transaction_saved"] = True
        state["transactions_saved_count"] = len(saved_items)
        state["needs_clarification"] = False

        if len(saved_items) == 1:
            s = saved_items[0]
            updated_summary = await self.repository.analytics_summary(state["user_id"])
            remaining = updated_summary.get("remaining_budget")
            remaining_text = (
                f" Your updated remaining budget is {s['currency']} {remaining:.2f}."
                if remaining is not None
                else ""
            )
            state["response"] = (
                f"Recorded **{s['currency']} {s['amount']:.2f}** spent at **{s['merchant']}** "
                f"under **{s['category']}**.{remaining_text}"
            )
        else:
            lines = []
            for s in saved_items:
                lines.append(f"- **{s['merchant']}**: {s['currency']} {s['amount']:.2f} ({s['category']})")
            state["response"] = (
                f"Got it! I've recorded **{len(saved_items)} transactions**:\n\n"
                + "\n".join(lines)
            )
        state["artifacts"] = [self._transaction_artifact(saved_items, await self.repository.analytics_summary(state["user_id"]))]
        return state

    async def _clarify_transaction(self, state: BudgetAgentState) -> BudgetAgentState:
        drafts = state["drafts"]
        # Save any complete drafts, clarify incomplete ones
        valid_drafts = [d for d in drafts if not d.missing_required_fields()]
        invalid_drafts = [d for d in drafts if d.missing_required_fields()]

        saved_items = []
        for draft in valid_drafts:
            transaction = TransactionCreate(
                amount=draft.amount or 0,
                currency=draft.currency,
                merchant=draft.merchant or "Unknown",
                category=draft.category or "Uncategorized",
                date=draft.date,
                notes=draft.notes,
                source_message_id=state["user_message_id"],
            )
            saved = await self.repository.create_transaction(state["user_id"], transaction)
            saved_items.append(saved)

        state["transaction_saved"] = len(saved_items) > 0
        state["transactions_saved_count"] = len(saved_items)
        state["needs_clarification"] = True

        parts = []
        if saved_items:
            if len(saved_items) == 1:
                s = saved_items[0]
                parts.append(f"Recorded {s['currency']} {s['amount']:.2f} at {s['merchant']} ({s['category']}).")
            else:
                lines = [f"- **{s['merchant']}**: {s['currency']} {s['amount']:.2f} ({s['category']})" for s in saved_items]
                parts.append(f"Recorded **{len(saved_items)} transactions**:\n" + "\n".join(lines))

        for draft in invalid_drafts:
            missing = draft.missing_required_fields()
            readable = " and ".join(missing)
            merchant_hint = f" for the '{draft.merchant}' expense" if draft.merchant else ""
            parts.append(f"I still need the **{readable}**{merchant_hint}. Could you tell me?")

        state["response"] = "\n\n".join(parts)
        artifacts = []
        if saved_items:
            artifacts.append(self._transaction_artifact(saved_items, await self.repository.analytics_summary(state["user_id"])))
        if invalid_drafts:
            artifacts.append(
                {
                    "type": "clarification",
                    "title": "Missing details",
                    "data": [
                        {
                            "merchant": draft.merchant,
                            "missing": draft.missing_required_fields(),
                            "suggested_prompt": self._clarification_prompt(draft),
                        }
                        for draft in invalid_drafts
                    ],
                }
            )
        state["artifacts"] = artifacts
        return state

    async def _edit_transaction(self, state: BudgetAgentState) -> BudgetAgentState:
        data = state.get("extracted_data", {})
        amount = data.get("amount")
        merchant = data.get("merchant")
        category = data.get("category")
        match_merchant = merchant if amount is not None else None
        match_category = category if amount is not None and not match_merchant else None
        success = await self.repository.update_transaction(
            state["user_id"],
            amount=amount,
            category=None if amount is not None else category,
            merchant=None if amount is not None else merchant,
            match_category=match_category,
            match_merchant=match_merchant,
        )
        if success:
            state["response"] = "I've successfully updated that recent transaction for you. ✅"
            state["artifacts"] = [self._analytics_artifact(await self.repository.analytics_summary(state["user_id"]))]
        else:
            state["response"] = "I couldn't find a recent transaction matching that description to update. Try being more specific about the merchant name."
        return state

    async def _delete_transaction(self, state: BudgetAgentState) -> BudgetAgentState:
        data = state.get("extracted_data", {})
        success = await self.repository.delete_transaction(
            state["user_id"],
            category=data.get("category"),
            merchant=data.get("merchant")
        )
        if success:
            state["response"] = "I've successfully deleted that recent transaction. 🗑️"
            state["artifacts"] = [self._analytics_artifact(await self.repository.analytics_summary(state["user_id"]))]
        else:
            state["response"] = "I couldn't find a recent transaction matching that description to delete."
        return state

    async def _update_profile(self, state: BudgetAgentState) -> BudgetAgentState:
        profile_data = await self.interpreter.extract_profile_update(state["message"])
        if profile_data:
            await self.repository.update_user_profile(
                state["user_id"],
                name=profile_data.get("name"),
                avatar=profile_data.get("avatar"),
                monthly_income=profile_data.get("monthly_income")
            )
            updated_user = await self.repository.get_user_by_id(state["user_id"])
            updates = []
            if profile_data.get("name"): updates.append(f"name to **{profile_data['name']}**")
            if profile_data.get("monthly_income"): updates.append(f"monthly income to **INR {profile_data['monthly_income']}**")
            if profile_data.get("avatar"): updates.append(f"avatar to **{profile_data['avatar']}**")
            
            if updates:
                state["response"] = f"Got it! I've updated your {', '.join(updates)}. All set! 👍"
            else:
                state["response"] = "I heard you mention your profile, but I couldn't catch the exact details. What would you like to update?"
            state["artifacts"] = [
                {
                    "type": "profile",
                    "title": "Profile updated",
                    "data": {
                        "name": updated_user.get("name") if updated_user else None,
                        "monthly_income": updated_user.get("monthly_income") if updated_user else None,
                        "avatar": updated_user.get("avatar") if updated_user else None,
                    },
                }
            ]
        else:
            state["response"] = "I couldn't extract the profile details. Could you tell me your income or name again?"
        return state

    async def _answer_analytics(self, state: BudgetAgentState) -> BudgetAgentState:
        summary = await self.repository.analytics_summary(state["user_id"])
        lowered = state["message"].lower()
        if "salary" in lowered or "income" in lowered:
            monthly_income = summary.get("monthly_income")
            if monthly_income:
                state["response"] = f"Your monthly income is INR {monthly_income:.2f}."
                state["artifacts"] = [
                    {
                        "type": "profile",
                        "title": "Income",
                        "data": {"monthly_income": monthly_income, "remaining_budget": summary.get("remaining_budget")},
                    }
                ]
            else:
                state["response"] = "I don't have your monthly income saved yet. Tell me something like: my monthly income is 32000."
            return state
        if "budget" in lowered:
            monthly_income = summary.get("monthly_income")
            remaining = summary.get("remaining_budget")
            if monthly_income:
                state["response"] = (
                    f"Your monthly budget baseline is your saved income: **INR {monthly_income:.2f}**.\n\n"
                    f"You have **INR {remaining or 0:.2f}** remaining this month after recorded expenses."
                )
                state["artifacts"] = [self._analytics_artifact(summary)]
            else:
                state["response"] = "I don't have your monthly budget baseline yet. Tell me your monthly income or add category budgets first."
                state["artifacts"] = [
                    {
                        "type": "suggestions",
                        "title": "Set up your budget",
                        "data": ["My monthly income is 32000", "Set Food budget to 8000"],
                    }
                ]
            return state
        if summary["transaction_count"] == 0:
            state["response"] = "I don't have any transactions for you yet. Once you add some, I can show you detailed analytics! 📊"
            state["artifacts"] = [
                {
                    "type": "suggestions",
                    "title": "Try asking",
                    "data": [
                        "I spent 500 on coffee at Starbucks",
                        "My monthly income is 32000",
                        "Set Food budget to 8000",
                    ],
                }
            ]
            return state
        top_category = summary["top_category"] or "Uncategorized"
        top_merchant = summary["top_merchant"] or "Unknown"
        daily_rows = "\n".join(
            f"| {item['date']} | INR {item['amount']:.2f} |"
            for item in summary.get("daily_breakdown", [])[:7]
        )
        daily_table = ""
        if daily_rows:
            daily_table = f"\n\n| Date | Spend |\n| --- | ---: |\n{daily_rows}"
        state["response"] = (
            f"**Total spend:** INR {summary['total_spend']:.2f}\n\n"
            f"**Transactions:** {summary['transaction_count']}\n\n"
            f"**Highest category:** {top_category}\n\n"
            f"**Top merchant:** {top_merchant}"
            f"{daily_table}"
        )
        state["artifacts"] = [self._analytics_artifact(summary)]
        return state

    async def _answer_general(self, state: BudgetAgentState) -> BudgetAgentState:
        state["response"] = await self.interpreter.answer_general(
            state["message"],
            state["history"],
            state["transactions"],
            state["summary"],
            state["user_profile"],
            state["budgets"],
        )
        return state

    def _route_by_intent(self, state: BudgetAgentState) -> str:
        if state["intent"] == Intent.add_transaction:
            return "extract_transaction"
        if state["intent"] == Intent.edit_transaction:
            return "edit_transaction"
        if state["intent"] == Intent.delete_transaction:
            return "delete_transaction"
        if state["intent"] == Intent.update_profile:
            return "update_profile"
        if state["intent"] == Intent.analytics_query:
            return "answer_analytics"
        return "answer_general"

    def _route_transaction(self, state: BudgetAgentState) -> str:
        drafts = state["drafts"]
        all_valid = all(not d.missing_required_fields() for d in drafts)
        if all_valid:
            return "persist_transaction"
        return "clarify_transaction"

    def _title_from_message(self, message: str) -> str:
        return message.strip().splitlines()[0][:80] or "New chat"

    def _transaction_artifact(self, transactions: list[dict[str, Any]], summary: dict[str, Any]) -> dict[str, Any]:
        return {
            "type": "transaction_receipt",
            "title": "Recorded transactions",
            "data": {
                "transactions": [
                    {
                        "merchant": item.get("merchant"),
                        "amount": item.get("amount"),
                        "currency": item.get("currency"),
                        "category": item.get("category"),
                        "date": item.get("date").isoformat() if hasattr(item.get("date"), "isoformat") else item.get("date"),
                    }
                    for item in transactions
                ],
                "summary": self._summary_snapshot(summary),
            },
        }

    def _analytics_artifact(self, summary: dict[str, Any]) -> dict[str, Any]:
        return {
            "type": "analytics",
            "title": "Spending analysis",
            "data": {
                "summary": self._summary_snapshot(summary),
                "category_breakdown": summary.get("category_breakdown", [])[:8],
                "daily_breakdown": summary.get("daily_breakdown", [])[-14:],
                "recent_transactions": [
                    {
                        "merchant": item.get("merchant"),
                        "amount": item.get("amount"),
                        "currency": item.get("currency"),
                        "category": item.get("category"),
                        "date": item.get("date").isoformat() if hasattr(item.get("date"), "isoformat") else item.get("date"),
                    }
                    for item in summary.get("recent_transactions", [])[:6]
                ],
                "budget_tracking": summary.get("budget_tracking", []),
            },
        }

    def _summary_snapshot(self, summary: dict[str, Any]) -> dict[str, Any]:
        return {
            "total_spend": summary.get("total_spend", 0),
            "monthly_income": summary.get("monthly_income"),
            "remaining_budget": summary.get("remaining_budget"),
            "transaction_count": summary.get("transaction_count", 0),
            "top_category": summary.get("top_category"),
            "top_merchant": summary.get("top_merchant"),
        }

    def _clarification_prompt(self, draft: TransactionDraft) -> str:
        missing = draft.missing_required_fields()
        if missing == ["amount"] and draft.merchant:
            return f"It was 250 at {draft.merchant}"
        if missing == ["merchant"] and draft.amount is not None:
            return f"It was at Starbucks"
        return "It was 250 at Starbucks"
