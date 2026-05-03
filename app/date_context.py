from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import Settings


def app_now(settings: Settings | None = None) -> datetime:
    timezone = getattr(settings, "app_timezone", "Asia/Kolkata") if settings else "Asia/Kolkata"
    return datetime.now(ZoneInfo(timezone))


def current_date_context(settings: Settings | None = None) -> str:
    now = app_now(settings)
    return (
        f"Current date: {now.date().isoformat()}. "
        f"Current local time: {now.strftime('%Y-%m-%d %H:%M %Z')}. "
        f"Timezone: {now.tzinfo}."
    )
