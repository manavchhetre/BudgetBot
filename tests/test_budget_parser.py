import pytest

from app.budget_parser import BudgetTextInterpreter
from app.models import Intent
from app.providers import ProviderChain
from app.providers import clean_model_text, parse_json_response


@pytest.mark.asyncio
async def test_rule_based_transaction_extraction_without_provider():
    interpreter = BudgetTextInterpreter(ProviderChain([]))

    intent = await interpreter.classify_intent("I spent 450 rupees on lunch at Cafe Coffee Day")
    draft = await interpreter.extract_transaction("I spent 450 rupees on lunch at Cafe Coffee Day")

    assert intent == Intent.add_transaction
    assert draft.amount == 450
    assert draft.currency == "INR"
    assert draft.merchant == "Cafe Coffee Day"
    assert draft.category == "Food"


@pytest.mark.asyncio
async def test_rule_based_transaction_extraction_uses_merchant_context():
    interpreter = BudgetTextInterpreter(ProviderChain([]))

    groceries = await interpreter.extract_transaction("I spent 800 rupees at Amazon for groceries")
    typo = await interpreter.extract_transaction("I spent 900 rupees at Amaaxzon")
    fashion = await interpreter.extract_transaction("I spent 1200 rupees at Myntra")

    assert groceries.category == "Groceries"
    assert typo.category == "Shopping"
    assert fashion.category == "Shopping"


@pytest.mark.asyncio
async def test_clarification_needed_for_missing_amount():
    interpreter = BudgetTextInterpreter(ProviderChain([]))

    draft = await interpreter.extract_transaction("I bought lunch at the office cafe")

    assert "amount" in draft.missing_required_fields()


@pytest.mark.asyncio
async def test_analytics_question_routes_to_analytics_intent():
    interpreter = BudgetTextInterpreter(ProviderChain([]))

    intent = await interpreter.classify_intent("How much have I spent recently?")

    assert intent == Intent.analytics_query


@pytest.mark.asyncio
async def test_date_wise_spending_routes_to_analytics_intent():
    interpreter = BudgetTextInterpreter(ProviderChain([]))

    intent = await interpreter.classify_intent("Show me my date-wise spending")

    assert intent == Intent.analytics_query


@pytest.mark.asyncio
async def test_rule_based_extraction_resolves_explicit_dates():
    interpreter = BudgetTextInterpreter(ProviderChain([]))

    draft = await interpreter.extract_transaction("I spent 300 rupees at Big Bazaar on 2026-05-01")

    assert draft.date.date().isoformat() == "2026-05-01"


def test_provider_json_parser_handles_thinking_noise():
    raw = '<think>private notes</think>\n{"intent": "analytics_query"}'

    assert parse_json_response(raw)["intent"] == "analytics_query"
    assert clean_model_text("<think>private</think>\nVisible answer") == "Visible answer"
