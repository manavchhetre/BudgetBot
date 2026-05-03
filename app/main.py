from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.config import get_settings
from app.database import mongo_manager
from app.routes_api import router as api_router
from app.routes_auth import router as auth_router


BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await mongo_manager.connect()
        from app.repositories import MongoBudgetRepository

        await MongoBudgetRepository(mongo_manager.db).ensure_indexes()
        yield
        await mongo_manager.close()

    app = FastAPI(title="Budget Bot", lifespan=lifespan)
    app.add_middleware(SessionMiddleware, secret_key=settings.session_secret, same_site="lax")
    app.include_router(auth_router)
    app.include_router(api_router)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/")
    async def index(request: Request):
        if request.session.get("user_id"):
            return RedirectResponse("/app")
        return RedirectResponse("/login")

    @app.get("/login")
    async def login_page():
        return FileResponse(STATIC_DIR / "login.html")

    @app.get("/favicon.ico")
    async def favicon():
        return FileResponse(STATIC_DIR / "favicon.svg", media_type="image/svg+xml")

    @app.get("/register")
    async def register_page():
        return FileResponse(STATIC_DIR / "register.html")

    @app.get("/app")
    async def app_page(request: Request):
        if not request.session.get("user_id"):
            return RedirectResponse("/login")
        return FileResponse(STATIC_DIR / "app.html")

    return app


app = create_app()
