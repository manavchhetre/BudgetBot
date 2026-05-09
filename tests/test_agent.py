import pytest

from app.agent import BudgetAgent
from app.budget_parser import BudgetTextInterpreter
from app.providers import ProviderChain
from tests.fakes import InMemoryBudgetRepository


@pytest.mark.asyncio
async def test_agent_saves_complete_transaction():
    repository = InMemoryBudgetRepository()
    user = await repository.create_user("Omkar", "omkar@example.com", "hash")
    agent = BudgetAgent(repository, BudgetTextInterpreter(ProviderChain([])))

    response = await agent.handle_message(user["id"], "I spent 450 rupees on lunch at Cafe Coffee Day")
    transactions = await repository.get_transactions(user["id"])

    assert response.transaction_saved is True
    assert transactions[0]["amount"] == 450
    assert transactions[0]["merchant"] == "Cafe Coffee Day"


@pytest.mark.asyncio
async def test_agent_asks_clarification_for_incomplete_transaction():
    repository = InMemoryBudgetRepository()
    user = await repository.create_user("Omkar", "omkar@example.com", "hash")
    agent = BudgetAgent(repository, BudgetTextInterpreter(ProviderChain([])))

    response = await agent.handle_message(user["id"], "I spent at Starbucks")
    transactions = await repository.get_transactions(user["id"])

    assert response.transaction_saved is False
    assert response.needs_clarification is True
    assert transactions == []


@pytest.mark.asyncio
async def test_agent_saves_multiple_rule_based_transactions():
    repository = InMemoryBudgetRepository()
    user = await repository.create_user("Omkar", "omkar@example.com", "hash")
    agent = BudgetAgent(repository, BudgetTextInterpreter(ProviderChain([])))

    response = await agent.handle_message(user["id"], "I also spend 100 on paneer yesterday and today spent 300 on Zepto")
    transactions = await repository.get_transactions(user["id"])

    assert response.transaction_saved is True
    assert response.transactions_saved_count == 2
    assert {item["merchant"] for item in transactions} == {"paneer", "Zepto"}
    assert response.artifacts[0]["type"] == "transaction_receipt"


@pytest.mark.asyncio
async def test_agent_updates_and_answers_monthly_income_without_provider():
    repository = InMemoryBudgetRepository()
    user = await repository.create_user("Omkar", "omkar@example.com", "hash")
    agent = BudgetAgent(repository, BudgetTextInterpreter(ProviderChain([])))

    update = await agent.handle_message(user["id"], "No no my monthly income is 32k")
    answer = await agent.handle_message(user["id"], "How much is my salary?")
    saved_user = await repository.get_user_by_id(user["id"])

    assert update.intent.value == "update_profile"
    assert saved_user["monthly_income"] == 32000
    assert "INR 32000.00" in answer.message
    assert answer.artifacts[0]["type"] == "profile"


@pytest.mark.asyncio
async def test_agent_edits_recent_transaction_amount_with_merchant_match():
    repository = InMemoryBudgetRepository()
    user = await repository.create_user("Omkar", "omkar@example.com", "hash")
    agent = BudgetAgent(repository, BudgetTextInterpreter(ProviderChain([])))

    await agent.handle_message(user["id"], "I spent 100 rupees at Starbucks")
    response = await agent.handle_message(user["id"], "Update Starbucks to 120 rupees")
    transactions = await repository.get_transactions(user["id"])

    assert response.intent.value == "edit_transaction"
    assert transactions[0]["amount"] == 120
    assert response.artifacts[0]["type"] == "analytics"


@pytest.mark.asyncio
async def test_agent_answers_budget_question_with_budget_not_generic_spend_summary():
    repository = InMemoryBudgetRepository()
    user = await repository.create_user("Omkar", "omkar@example.com", "hash")
    await repository.update_user_profile(user["id"], monthly_income=32000)
    agent = BudgetAgent(repository, BudgetTextInterpreter(ProviderChain([])))

    await agent.handle_message(user["id"], "I spent 900 rupees on shoes at Amazon")
    response = await agent.handle_message(user["id"], "What's my actual budget?")

    assert response.intent.value == "analytics_query"
    assert "monthly budget baseline" in response.message
    assert "INR 32000.00" in response.message
    assert response.artifacts[0]["type"] == "analytics"
