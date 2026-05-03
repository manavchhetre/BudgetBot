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
