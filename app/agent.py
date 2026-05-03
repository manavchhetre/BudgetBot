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
    history: list[dict[str, Any]]
    transactions: list[dict[str, Any]]
    summary: dict[str, Any]
    intent: Intent
    draft: TransactionDraft
    response: str
    transaction_saved: bool
    needs_clarification: bool


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
            needs_clarification=state.get("needs_clarification", False),
        )

    def _build_graph(self):
        graph = StateGraph(BudgetAgentState)
        graph.add_node("load_history", self._load_history)
        graph.add_node("classify_intent", self._classify_intent)
        graph.add_node("extract_transaction", self._extract_transaction)
        graph.add_node("persist_transaction", self._persist_transaction)
        graph.add_node("clarify_transaction", self._clarify_transaction)
        graph.add_node("answer_analytics", self._answer_analytics)
        graph.add_node("answer_general", self._answer_general)

        graph.set_entry_point("load_history")
        graph.add_edge("load_history", "classify_intent")
        graph.add_conditional_edges(
            "classify_intent",
            self._route_by_intent,
            {
                "extract_transaction": "extract_transaction",
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
        graph.add_edge("answer_analytics", END)
        graph.add_edge("answer_general", END)
        return graph.compile()

    async def _load_history(self, state: BudgetAgentState) -> BudgetAgentState:
        state["history"] = await self.repository.get_messages(state["user_id"], state["conversation_id"], limit=30)
        state["transactions"] = await self.repository.get_transactions(state["user_id"], limit=100)
        state["summary"] = await self.repository.analytics_summary(state["user_id"])
        return state

    async def _classify_intent(self, state: BudgetAgentState) -> BudgetAgentState:
        state["intent"] = await self.interpreter.classify_intent(state["message"])
        return state

    async def _extract_transaction(self, state: BudgetAgentState) -> BudgetAgentState:
        state["draft"] = await self.interpreter.extract_transaction(state["message"])
        return state

    async def _persist_transaction(self, state: BudgetAgentState) -> BudgetAgentState:
        draft = state["draft"]
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
        state["transaction_saved"] = True
        state["needs_clarification"] = False
        state["response"] = (
            f"Recorded {saved['currency']} {saved['amount']:.2f} spent at {saved['merchant']} "
            f"under {saved['category']}."
        )
        return state

    async def _clarify_transaction(self, state: BudgetAgentState) -> BudgetAgentState:
        missing = state["draft"].missing_required_fields()
        readable = " and ".join(missing)
        state["transaction_saved"] = False
        state["needs_clarification"] = True
        state["response"] = f"I can record that expense, but I need the {readable}. Could you send it?"
        return state

    async def _answer_analytics(self, state: BudgetAgentState) -> BudgetAgentState:
        summary = await self.repository.analytics_summary(state["user_id"])
        if summary["transaction_count"] == 0:
            state["response"] = "I do not have any transactions for you yet. Add an expense and I can summarize it."
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
        return state

    async def _answer_general(self, state: BudgetAgentState) -> BudgetAgentState:
        state["response"] = await self.interpreter.answer_general(
            state["message"],
            state["history"],
            state["transactions"],
            state["summary"],
        )
        return state

    def _route_by_intent(self, state: BudgetAgentState) -> str:
        if state["intent"] == Intent.add_transaction:
            return "extract_transaction"
        if state["intent"] == Intent.analytics_query:
            return "answer_analytics"
        return "answer_general"

    def _route_transaction(self, state: BudgetAgentState) -> str:
        if state["draft"].missing_required_fields():
            return "clarify_transaction"
        return "persist_transaction"

    def _title_from_message(self, message: str) -> str:
        return message.strip().splitlines()[0][:80] or "New chat"
