"""Automated Cleanup Manager — APScheduler cron @ 3AM UTC."""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from src.config.settings import settings
from src.database.supabase_client import supabase_client

logger = logging.getLogger(__name__)


class CleanupManager:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_running = False

    async def start(self):
        if self.is_running:
            return
        self.scheduler.add_job(
            self._cleanup,
            CronTrigger(hour=settings.CLEANUP_SCHEDULE_HOUR, minute=0),
            id="daily_cleanup", replace_existing=True,
        )
        self.scheduler.add_job(
            self._size_check,
            "interval", hours=6,
            id="size_check", replace_existing=True,
        )
        self.scheduler.start()
        self.is_running = True
        logger.info(f"🧹 Cleanup scheduler started (daily @{settings.CLEANUP_SCHEDULE_HOUR}:00 UTC)")

    async def stop(self):
        if self.is_running:
            self.scheduler.shutdown(wait=False)
            self.is_running = False

    async def _cleanup(self):
        deleted = await supabase_client.cleanup_old_papers(settings.CLEANUP_DAYS_OLD)
        logger.info(f"🧹 Cleanup: deleted {deleted} papers older than {settings.CLEANUP_DAYS_OLD}d")

    async def _size_check(self):
        stats = await supabase_client.get_database_stats()
        total = stats.get("total_papers", 0)
        if total > settings.MAX_PAPERS_LIMIT:
            logger.warning(f"⚠️ DB size {total} > {settings.MAX_PAPERS_LIMIT}, emergency cleanup")
            await supabase_client.cleanup_old_papers(days_old=14)

    async def trigger_manual_cleanup(self, days_old: int = None) -> dict:
        days_old = days_old or settings.CLEANUP_DAYS_OLD
        deleted = await supabase_client.cleanup_old_papers(days_old)
        stats = await supabase_client.get_database_stats()
        return {"success": True, "deleted_papers": deleted, "current_total": stats.get("total_papers", 0)}


cleanup_manager = CleanupManager()
