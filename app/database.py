import asyncio
import logging
from collections.abc import AsyncIterator

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import Settings, get_settings

logger = logging.getLogger("jerry.db")

MAX_CONNECT_RETRIES = 5
RETRY_BASE_DELAY = 1.0  # seconds


class MongoClientManager:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client: AsyncIOMotorClient | None = None

    async def connect(self) -> None:
        self.client = AsyncIOMotorClient(
            self.settings.mongodb_uri,
            maxPoolSize=50,
            minPoolSize=5,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
        for attempt in range(1, MAX_CONNECT_RETRIES + 1):
            try:
                await self.client.admin.command("ping")
                logger.info("MongoDB connected (attempt %d)", attempt)
                return
            except Exception:
                if attempt == MAX_CONNECT_RETRIES:
                    logger.critical("MongoDB unreachable after %d attempts", MAX_CONNECT_RETRIES)
                    raise
                delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
                logger.warning("MongoDB connection attempt %d failed, retrying in %.1fs …", attempt, delay)
                await asyncio.sleep(delay)

    async def close(self) -> None:
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")

    @property
    def db(self) -> AsyncIOMotorDatabase:
        if self.client is None:
            raise RuntimeError("MongoDB client is not connected")
        return self.client[self.settings.mongodb_db_name]


mongo_manager = MongoClientManager(get_settings())


async def get_database() -> AsyncIterator[AsyncIOMotorDatabase]:
    yield mongo_manager.db

