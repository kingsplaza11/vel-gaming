# fortune/abuse.py
from __future__ import annotations

import time
from dataclasses import dataclass
from django.core.cache import cache

class AbuseError(Exception):
    pass


@dataclass
class RateLimit:
    key: str
    limit: int
    window_sec: int


def hit_rate_limit(rl: RateLimit) -> None:
    """
    Simple fixed-window counter.
    """
    now_bucket = int(time.time()) // rl.window_sec
    cache_key = f"rl:{rl.key}:{now_bucket}"
    n = cache.get(cache_key, 0)
    if n >= rl.limit:
        raise AbuseError("Rate limit exceeded")
    cache.set(cache_key, n + 1, timeout=rl.window_sec + 2)


def tap_speed_check(user_id: int, session_id: str, client_ts_ms: int) -> None:
    """
    Detect impossible step cadence (bots). We store last timestamp and compute delta.
    """
    key = f"speed:{user_id}:{session_id}"
    last = cache.get(key)
    cache.set(key, client_ts_ms, timeout=3600)
    if last is None:
        return
    delta = client_ts_ms - int(last)
    # Under 80ms per action is usually bot-level for mobile web
    if delta < 80:
        raise AbuseError("Suspicious tap speed")
