import signal
import time
import sys
from django.core.management.base import BaseCommand
from crash.engine import create_new_round, run_single_round
from crash.models import RiskSettings
from crash.redis_lock import RedisEngineLock, LockHeartbeat
import os

# Prevent Django autoreloader / double execution on Windows
os.environ["DJANGO_ALLOW_ASYNC_UNSAFE"] = "true"

class Command(BaseCommand):
    help = "Run crash game engine with Redis single-instance lock"

    def add_arguments(self, parser):
        parser.add_argument(
            "--mode",
            choices=["real", "demo"],
            default="real",
            help="Run engine in real or demo mode",
        )
        parser.add_argument(
            "--lock-ttl",
            type=int,
            default=30,
            help="Lock TTL in seconds (default: 30)",
        )
        parser.add_argument(
            "--heartbeat-interval",
            type=float,
            default=10,
            help="Heartbeat interval in seconds (default: 10)",
        )

    def handle(self, *args, **options):
        mode = options["mode"]
        is_demo = mode == "demo"
        lock_ttl = options["lock_ttl"]
        heartbeat_interval = options["heartbeat_interval"]

        lock_key = f"crash:engine:{mode}"
        
        self.stdout.write(f"[ENGINE:{mode}] Starting with lock TTL: {lock_ttl}s, heartbeat: {heartbeat_interval}s")

        lock = RedisEngineLock(lock_key, lock_ttl)

        if not lock.acquire():
            self.stdout.write(
                self.style.WARNING(
                    f"[ENGINE:{mode}] Another engine already running. Exiting."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(f"[ENGINE:{mode}] Lock acquired. Engine starting.")
        )

        heartbeat = LockHeartbeat(lock, every_seconds=heartbeat_interval)
        
        running = True

        def shutdown(*_):
            nonlocal running
            running = False
            self.stdout.write(
                self.style.WARNING(f"[ENGINE:{mode}] Shutdown requested.")
            )

        signal.signal(signal.SIGINT, shutdown)
        signal.signal(signal.SIGTERM, shutdown)

        try:
            # ensure singleton exists (table must already exist)
            RiskSettings.get()

            while running:
                heartbeat.tick()  # 🔒 renew lock before starting round
                
                round_start = time.time()
                round_obj = create_new_round(is_demo=is_demo)
                
                # PASS heartbeat to run_single_round
                run_single_round(round_obj, heartbeat=heartbeat)
                
                round_duration = time.time() - round_start
                self.stdout.write(
                    self.style.SUCCESS(f"[ENGINE:{mode}] Round completed in {round_duration:.2f} seconds")
                )

        except RuntimeError as e:
            if "Lost engine lock" in str(e):
                self.stdout.write(
                    self.style.ERROR(f"[ENGINE:{mode}] Engine lock lost. Another instance may have taken over.")
                )
            else:
                self.stdout.write(self.style.ERROR(f"[ENGINE:{mode}] {e}"))
                import traceback
                traceback.print_exc()
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"[ENGINE:{mode}] {e}"))
            import traceback
            traceback.print_exc()
            raise

        finally:
            try:
                lock.release()
                self.stdout.write(
                    self.style.SUCCESS(f"[ENGINE:{mode}] Lock released. Engine stopped.")
                )
            except:
                pass  # Ignore errors during cleanup