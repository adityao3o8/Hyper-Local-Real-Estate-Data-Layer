"""Lazy Supabase client built from environment variables.

Required env vars (root .env):
    SUPABASE_URL   - project URL, e.g. https://xxxx.supabase.co
    SUPABASE_KEY   - service_role key (server-side) or anon key

Falls back gracefully: if neither is set, ``get_supabase()`` returns None and
callers use the local JSON files instead.
"""

from __future__ import annotations

import os
from functools import lru_cache

try:
    from supabase import Client, create_client
except ImportError:  # supabase-py not installed yet
    Client = None  # type: ignore[assignment]
    create_client = None  # type: ignore[assignment]


def _resolve_key() -> str | None:
    for name in ("SUPABASE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"):
        value = os.getenv(name)
        if value:
            return value
    return None


@lru_cache(maxsize=1)
def get_supabase() -> "Client | None":
    """Return a memoized Supabase client, or None when not configured."""
    if create_client is None:
        return None
    url = os.getenv("SUPABASE_URL")
    key = _resolve_key()
    if not url or not key:
        return None
    return create_client(url, key)


def supabase_enabled() -> bool:
    return get_supabase() is not None
