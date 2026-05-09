import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_repository
from app.main import create_app
from tests.fakes import InMemoryBudgetRepository


@pytest.mark.asyncio
async def test_register_login_chat_and_analytics_flow():
    repository = InMemoryBudgetRepository()
    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repository

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://testserver") as client:
        register = await client.post(
            "/auth/register",
            json={"name": "Omkar", "email": "omkar@example.com", "password": "password123"},
        )
        assert register.status_code == 201

        chat = await client.post("/api/chat", json={"message": "I spent 900 rupees on shoes at Amazon"})
        assert chat.status_code == 200
        assert chat.json()["transaction_saved"] is True

        summary = await client.get("/api/analytics/summary")
        assert summary.status_code == 200
        assert summary.json()["total_spend"] == 900
        assert summary.json()["top_category"] == "Shopping"
        assert summary.json()["daily_breakdown"]
        assert "date" in summary.json()["daily_breakdown"][0]

        transactions = await client.get("/api/transactions")
        assert transactions.status_code == 200
        assert len(transactions.json()) == 1

        stream = await client.post("/api/chat/stream", json={"message": "Show me my date-wise spending"})
        assert stream.status_code == 200
        assert '"type": "meta"' in stream.text
        assert '"type": "chunk"' in stream.text


@pytest.mark.asyncio
async def test_authenticated_data_is_isolated_between_users():
    repository = InMemoryBudgetRepository()
    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repository

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as first:
        await first.post("/auth/register", json={"name": "A", "email": "a@example.com", "password": "password123"})
        await first.post("/api/chat", json={"message": "I spent 100 rupees on coffee at Starbucks"})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as second:
        await second.post("/auth/register", json={"name": "B", "email": "b@example.com", "password": "password123"})
        summary = await second.get("/api/analytics/summary")

    assert summary.json()["total_spend"] == 0
    assert summary.json()["transaction_count"] == 0


@pytest.mark.asyncio
async def test_unauthenticated_api_is_rejected():
    repository = InMemoryBudgetRepository()
    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repository

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as client:
        response = await client.get("/api/analytics/summary")

    assert response.status_code == 401
