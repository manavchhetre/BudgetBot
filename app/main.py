import logging
import sys
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from starlette.middleware.sessions import SessionMiddleware

from app.config import get_settings
from app.database import mongo_manager
from app.routes_api import router as api_router
from app.routes_auth import router as auth_router


BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"


def setup_logging(debug: bool = False) -> None:
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(format=LOG_FORMAT, level=level, stream=sys.stdout, force=True)
    # Quiet down noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


logger = logging.getLogger("jerry")

# ---------------------------------------------------------------------------
# Rate limiter (imported from dedicated module to avoid circular imports)
# ---------------------------------------------------------------------------
from app.rate_limit import limiter  # noqa: E402


def create_app() -> FastAPI:
    settings = get_settings()
    setup_logging(settings.debug)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings.validate_for_production()
        logger.info("Connecting to MongoDB …")
        await mongo_manager.connect()
        from app.repositories import MongoBudgetRepository

        await MongoBudgetRepository(mongo_manager.db).ensure_indexes()
        logger.info("Jerry is ready 🚀")
        yield
        logger.info("Shutting down …")
        await mongo_manager.close()

    app = FastAPI(
        title="Jerry — Budget Assistant",
        version="1.0.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # --- Rate-limit state ---------------------------------------------------
    app.state.limiter = limiter

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please slow down."},
        )

    # --- Middleware (order matters – outermost first) ------------------------
    if settings.allowed_origin_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.allowed_origin_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.add_middleware(GZipMiddleware, minimum_size=500)

    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        same_site="lax",
        https_only=not settings.debug,
        max_age=60 * 60 * 24 * 7,  # 7 days
    )

    # --- Global exception handler -------------------------------------------
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    # --- Routers & static ---------------------------------------------------
    app.include_router(auth_router)
    app.include_router(api_router)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    # --- Health check -------------------------------------------------------
    @app.get("/health")
    async def health():
        try:
            await mongo_manager.client.admin.command("ping")
            return {"status": "healthy", "db": "connected"}
        except Exception:
            return JSONResponse(
                status_code=503,
                content={"status": "unhealthy", "db": "disconnected"},
            )

    # --- Page routes --------------------------------------------------------
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

