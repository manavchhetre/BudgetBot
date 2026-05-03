from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_database
from app.repositories import BudgetRepository, MongoBudgetRepository


async def get_repository(db: Annotated[AsyncIOMotorDatabase, Depends(get_database)]) -> BudgetRepository:
    return MongoBudgetRepository(db)


async def require_user(request: Request, repository: Annotated[BudgetRepository, Depends(get_repository)]) -> dict:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    user = await repository.get_user_by_id(user_id)
    if not user:
        request.session.clear()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user
