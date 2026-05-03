import pytest

from app.categorization import MerchantCategorizer


@pytest.mark.asyncio
async def test_known_merchants_are_categorized_without_web():
    categorizer = MerchantCategorizer(web_search_enabled=False)

    assert (await categorizer.categorize("Starbucks", "spent at Starbucks")).category == "Food"
    assert (await categorizer.categorize("Myntra", "spent at Myntra")).category == "Shopping"


@pytest.mark.asyncio
async def test_context_overrides_large_marketplace_category():
    categorizer = MerchantCategorizer(web_search_enabled=False)

    result = await categorizer.categorize("Amazon", "I spent 800 rupees at Amazon for groceries")

    assert result.category == "Groceries"
    assert result.source == "context"


@pytest.mark.asyncio
async def test_fuzzy_merchant_match_handles_typo():
    categorizer = MerchantCategorizer(web_search_enabled=False)

    result = await categorizer.categorize("Amaaxzon", "I spent 900 at Amaaxzon")

    assert result.category == "Shopping"
