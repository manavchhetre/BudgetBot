import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pymongo.errors import DuplicateKeyError

from app.dependencies import get_repository, require_user
from app.rate_limit import limiter
from app.models import UserCreate, UserLogin, UserPublic
from app.repositories import BudgetRepository
from app.security import hash_password, verify_password

logger = logging.getLogger("jerry.auth")

router = APIRouter()


@router.post("/auth/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    payload: UserCreate,
    repository: Annotated[BudgetRepository, Depends(get_repository)],
) -> UserPublic:
    try:
        user = await repository.create_user(payload.name, payload.email, hash_password(payload.password))
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Email is already registered") from exc
    request.session["user_id"] = user["id"]
    logger.info("New user registered: %s", payload.email)
    return UserPublic(id=user["id"], name=user["name"], email=user["email"])


@router.post("/auth/login", response_model=UserPublic)
@limiter.limit("10/minute")
async def login(
    request: Request,
    payload: UserLogin,
    repository: Annotated[BudgetRepository, Depends(get_repository)],
) -> UserPublic:
    user = await repository.get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        logger.warning("Failed login attempt for %s", payload.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    request.session["user_id"] = user["id"]
    logger.info("User logged in: %s", payload.email)
    return UserPublic(id=user["id"], name=user["name"], email=user["email"])


@router.post("/auth/logout")
async def logout(request: Request) -> dict[str, str]:
    request.session.clear()
    return {"status": "ok"}


@router.get("/api/me", response_model=UserPublic)
async def me(user: Annotated[dict, Depends(require_user)]) -> UserPublic:
    return UserPublic(id=user["id"], name=user["name"], email=user["email"])

