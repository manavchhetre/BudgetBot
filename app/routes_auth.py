from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pymongo.errors import DuplicateKeyError

from app.dependencies import get_repository, require_user
from app.models import UserCreate, UserLogin, UserPublic
from app.repositories import BudgetRepository
from app.security import hash_password, verify_password


router = APIRouter()


@router.post("/auth/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    request: Request,
    repository: Annotated[BudgetRepository, Depends(get_repository)],
) -> UserPublic:
    try:
        user = await repository.create_user(payload.name, payload.email, hash_password(payload.password))
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Email is already registered") from exc
    request.session["user_id"] = user["id"]
    return UserPublic(id=user["id"], name=user["name"], email=user["email"])


@router.post("/auth/login", response_model=UserPublic)
async def login(
    payload: UserLogin,
    request: Request,
    repository: Annotated[BudgetRepository, Depends(get_repository)],
) -> UserPublic:
    user = await repository.get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    request.session["user_id"] = user["id"]
    return UserPublic(id=user["id"], name=user["name"], email=user["email"])


@router.post("/auth/logout")
async def logout(request: Request) -> dict[str, str]:
    request.session.clear()
    return {"status": "ok"}


@router.get("/api/me", response_model=UserPublic)
async def me(user: Annotated[dict, Depends(require_user)]) -> UserPublic:
    return UserPublic(id=user["id"], name=user["name"], email=user["email"])
