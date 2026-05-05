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
    if settings.allowed_origin_list or settings.debug:
        allowed = settings.allowed_origin_list if settings.allowed_origin_list else ["http://localhost:3000"]
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed,
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

    # --- Next.js Static Serving ---------------------------------------------
    import os
    if os.path.exists(STATIC_DIR / "_next"):
        app.mount("/_next", StaticFiles(directory=STATIC_DIR / "_next"), name="next_static")
        
    if os.path.exists(STATIC_DIR / "assets"):
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets_static")

    # Catch-all route for Next.js App Router (Client-side routing)
    @app.get("/{full_path:path}")
    async def catch_all(request: Request, full_path: str):
        if full_path.startswith("api/") or full_path.startswith("static/"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        
        # First check if the path maps to an actual file (images, icons, etc.)
        if full_path:
            direct_file = STATIC_DIR / full_path
            if direct_file.exists() and direct_file.is_file():
                return FileResponse(direct_file)

        if not full_path or full_path == "/":
            file_path = STATIC_DIR / "index.html"
        else:
            clean_path = full_path.rstrip("/")
            file_path = STATIC_DIR / f"{clean_path}.html"
            if not file_path.exists():
                file_path = STATIC_DIR / clean_path / "index.html"
            if not file_path.exists():
                file_path = STATIC_DIR / "index.html"

        if not file_path.exists():
            return JSONResponse(status_code=404, content={"detail": "Frontend not built yet. Run npm run build in frontend/."})
        return FileResponse(file_path)

    return app


app = create_app()

