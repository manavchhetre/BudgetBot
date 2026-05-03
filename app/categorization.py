import re
from dataclasses import dataclass
from difflib import get_close_matches

import httpx


CATEGORY_KEYWORDS = {
    "Food": ["food", "lunch", "dinner", "breakfast", "restaurant", "cafe", "coffee", "starbucks", "zomato", "swiggy"],
    "Groceries": ["grocery", "groceries", "supermarket", "vegetables", "fruits", "dmart", "bigbasket", "blinkit", "zepto"],
    "Transport": ["uber", "ola", "taxi", "cab", "metro", "bus", "fuel", "petrol", "diesel"],
    "Shopping": ["shopping", "amazon", "flipkart", "myntra", "ajio", "clothes", "shoes", "mall"],
    "Bills": ["electricity", "water", "internet", "phone", "rent", "bill"],
    "Entertainment": ["movie", "netflix", "spotify", "game", "concert"],
    "Health": ["medicine", "doctor", "hospital", "pharmacy"],
}

MERCHANT_CATEGORY = {
    "starbucks": "Food",
    "cafe coffee day": "Food",
    "ccd": "Food",
    "zomato": "Food",
    "swiggy": "Food",
    "mcdonalds": "Food",
    "dominos": "Food",
    "pizza hut": "Food",
    "amazon": "Shopping",
    "amazon.in": "Shopping",
    "flipkart": "Shopping",
    "myntra": "Shopping",
    "ajio": "Shopping",
    "nykaa": "Shopping",
    "dmart": "Groceries",
    "d-mart": "Groceries",
    "bigbasket": "Groceries",
    "blinkit": "Groceries",
    "zepto": "Groceries",
    "instamart": "Groceries",
    "uber": "Transport",
    "ola": "Transport",
    "rapido": "Transport",
    "netflix": "Entertainment",
    "spotify": "Entertainment",
    "bookmyshow": "Entertainment",
    "apollo pharmacy": "Health",
    "pharmeasy": "Health",
}

CONTEXT_OVERRIDES = [
    ("Groceries", ["grocery", "groceries", "supermarket", "vegetables", "fruits", "milk", "bread", "eggs"]),
    ("Food", ["lunch", "dinner", "breakfast", "coffee", "snack", "meal", "restaurant", "cafe"]),
    ("Transport", ["ride", "cab", "taxi", "fuel", "petrol", "diesel"]),
    ("Shopping", ["clothes", "shirt", "shoes", "jeans", "dress", "electronics"]),
]


@dataclass
class CategoryResult:
    category: str
    source: str


class MerchantCategorizer:
    def __init__(self, web_search_enabled: bool = False):
        self.web_search_enabled = web_search_enabled

    async def categorize(self, merchant: str | None, message: str, llm_category: str | None = None) -> CategoryResult:
        context_category = self._category_from_context(message)
        if context_category:
            return CategoryResult(context_category, "context")

        merchant_category = self._category_from_merchant(merchant)
        if merchant_category:
            return CategoryResult(merchant_category, "merchant")

        keyword_category = self._category_from_keywords(f"{llm_category or ''} {message}")
        if keyword_category:
            return CategoryResult(keyword_category, "keyword")

        canonical_llm_category = self._canonical_category(llm_category)
        if canonical_llm_category:
            return CategoryResult(canonical_llm_category, "llm")

        if self.web_search_enabled and merchant:
            web_category = await self._category_from_web(merchant)
            if web_category:
                return CategoryResult(web_category, "web")

        return CategoryResult("Uncategorized", "fallback")

    def _category_from_context(self, message: str) -> str | None:
        lowered = message.lower()
        for category, terms in CONTEXT_OVERRIDES:
            if any(term in lowered for term in terms):
                return category
        return None

    def _category_from_merchant(self, merchant: str | None) -> str | None:
        if not merchant:
            return None
        normalized = self._normalize_text(merchant)
        if normalized in MERCHANT_CATEGORY:
            return MERCHANT_CATEGORY[normalized]

        compact = normalized.replace(" ", "")
        compact_map = {key.replace(" ", ""): value for key, value in MERCHANT_CATEGORY.items()}
        if compact in compact_map:
            return compact_map[compact]

        match = get_close_matches(normalized, MERCHANT_CATEGORY.keys(), n=1, cutoff=0.78)
        if match:
            return MERCHANT_CATEGORY[match[0]]

        compact_match = get_close_matches(compact, compact_map.keys(), n=1, cutoff=0.78)
        if compact_match:
            return compact_map[compact_match[0]]
        return None

    def _category_from_keywords(self, text: str) -> str | None:
        lowered = text.lower()
        for category, keywords in CATEGORY_KEYWORDS.items():
            if any(keyword in lowered for keyword in keywords):
                return category
        return None

    def _canonical_category(self, category: str | None) -> str | None:
        if not category:
            return None
        normalized = category.strip().lower()
        for canonical in CATEGORY_KEYWORDS:
            if normalized == canonical.lower():
                return canonical
        return None

    async def _category_from_web(self, merchant: str) -> str | None:
        query = f"{merchant} store category"
        try:
            async with httpx.AsyncClient(timeout=4, follow_redirects=True) as client:
                response = await client.get("https://duckduckgo.com/html/", params={"q": query})
                response.raise_for_status()
        except httpx.HTTPError:
            return None
        text = re.sub(r"<[^>]+>", " ", response.text)
        return self._category_from_keywords(text)

    def _normalize_text(self, value: str) -> str:
        return re.sub(r"[^a-z0-9.]+", " ", value.lower()).strip()
