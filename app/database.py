from collections.abc import AsyncIterator

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import Settings, get_settings


class MongoClientManager:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client: AsyncIOMotorClient | None = None

    async def connect(self) -> None:
        self.client = AsyncIOMotorClient(self.settings.mongodb_uri)
        await self.client.admin.command("ping")

    async def close(self) -> None:
        if self.client:
            self.client.close()

    @property
    def db(self) -> AsyncIOMotorDatabase:
        if self.client is None:
            raise RuntimeError("MongoDB client is not connected")
        return self.client[self.settings.mongodb_db_name]


mongo_manager = MongoClientManager(get_settings())


async def get_database() -> AsyncIterator[AsyncIOMotorDatabase]:
    yield mongo_manager.db
