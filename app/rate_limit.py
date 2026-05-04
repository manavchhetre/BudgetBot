"""Rate limiter — extracted to avoid circular imports between main and route modules."""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
