import asyncio
import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Request, BackgroundTasks
from fastapi.responses import StreamingResponse

from app.agent import BudgetAgent
from app.budget_parser import BudgetTextInterpreter
from app.categorization import MerchantCategorizer
from app.config import Settings, get_settings
from app.dependencies import get_repository, require_user
from app.rate_limit import limiter
from app.models import AnalyticsSummary, ChatRequest, ChatResponse, TransactionPublic, UserProfileUpdate, CategoryBudgetCreate, CategoryBudget
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

async def run_summary_agent(user_id: str, message: str, agent: BudgetAgent):
    user_profile = await agent.repository.get_user_by_id(user_id)
    if not user_profile:
        return
    current_summary = user_profile.get("user_summary")
    new_summary = await agent.interpreter.update_user_summary(current_summary, message)
    if new_summary != current_summary:
        await agent.repository.update_user_profile(user_id, user_summary=new_summary)


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
    background_tasks: BackgroundTasks,
    user: Annotated[dict, Depends(require_user)],
    agent: Annotated[BudgetAgent, Depends(get_agent)],
) -> ChatResponse:
    logger.info("Chat from user %s: %.60s…", user["id"], payload.message)
    response = await agent.handle_message(user["id"], payload.message, payload.conversation_id)
    background_tasks.add_task(run_summary_agent, user["id"], payload.message, agent)
    return response


@router.post("/chat/stream")
@limiter.limit("30/minute")
async def chat_stream(
    request: Request,
    payload: ChatRequest,
    background_tasks: BackgroundTasks,
    user: Annotated[dict, Depends(require_user)],
    agent: Annotated[BudgetAgent, Depends(get_agent)],
) -> StreamingResponse:
    logger.info("Stream chat from user %s: %.60s…", user["id"], payload.message)
    background_tasks.add_task(run_summary_agent, user["id"], payload.message, agent)

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


@router.put("/user/profile")
async def update_profile(
    payload: UserProfileUpdate,
    user: Annotated[dict, Depends(require_user)],
    repository: Annotated[BudgetRepository, Depends(get_repository)],
) -> dict:
    await repository.update_user_profile(
        user["id"],
        name=payload.name,
        avatar=payload.avatar,
        monthly_income=payload.monthly_income,
    )
    return {"status": "success", "profile": payload.model_dump(exclude_unset=True)}


@router.get("/budgets", response_model=list[CategoryBudget])
async def get_budgets(
    user: Annotated[dict, Depends(require_user)],
    repository: Annotated[BudgetRepository, Depends(get_repository)],
) -> list[CategoryBudget]:
    return await repository.get_category_budgets(user["id"])


@router.post("/budgets")
async def create_budget(
    payload: CategoryBudgetCreate,
    user: Annotated[dict, Depends(require_user)],
    repository: Annotated[BudgetRepository, Depends(get_repository)],
) -> dict:
    budget = await repository.set_category_budget(user["id"], payload.category, payload.limit_amount)
    return {"status": "success", "budget": budget}


@router.delete("/budgets/{category}")
async def delete_budget(
    category: str,
    user: Annotated[dict, Depends(require_user)],
    repository: Annotated[BudgetRepository, Depends(get_repository)],
) -> dict:
    deleted = await repository.delete_category_budget(user["id"], category)
    return {"status": "success", "deleted": deleted}

