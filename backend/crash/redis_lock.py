import time
import uuid
import redis
from django.conf import settings

def get_redis():
    return redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

class RedisEngineLock:
    """
    Production-safe Redis lock using:
    - acquire: SET NX PX
    - renew:   SET XX PX
    - release: compare-and-delete (safe)
    """

    def __init__(self, key: str, ttl_seconds: int):
        self.key = key
        self.ttl_ms = int(ttl_seconds * 1000)
        self.token = uuid.uuid4().hex
        self.r = get_redis()

    def acquire(self) -> bool:
        # SET key token NX PX ttl
        return bool(
            self.r.set(
                self.key,
                self.token,
                nx=True,
                px=self.ttl_ms,
            )
        )

    def renew(self) -> bool:
        # Only renew if WE still own the lock
        current = self.r.get(self.key)
        if current != self.token:
            return False

        # SET key token XX PX ttl  (atomic renew)
        return bool(
            self.r.set(
                self.key,
                self.token,
                xx=True,
                px=self.ttl_ms,
            )
        )

    def release(self) -> bool:
        # Safe release: delete only if token matches
        pipe = self.r.pipeline()
        try:
            pipe.watch(self.key)
            if pipe.get(self.key) == self.token:
                pipe.multi()
                pipe.delete(self.key)
                pipe.execute()
                return True
            pipe.unwatch()
        except redis.WatchError:
            pass
        return False


class LockHeartbeat:
    def __init__(self, lock: RedisEngineLock, every_seconds: float = 5.0):
        self.lock = lock
        self.every = every_seconds
        self._next = time.monotonic() + self.every

    def tick(self):
        now = time.monotonic()
        if now >= self._next:
            if not self.lock.renew():
                raise RuntimeError("Lost engine lock")
            self._next = now + self.every