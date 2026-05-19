"""
Training Data Collector
Saves LLM prompt+output pairs for future fine-tuning.
Runs asynchronously, never blocks pipeline.
"""
import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Dict
from src.config.settings import settings

logger = logging.getLogger(__name__)


class TrainingCollector:
    def __init__(self):
        os.makedirs(settings.TRAINING_DATA_DIR, exist_ok=True)

    async def save(self, prompt: str, output: str, source: str, quality_score: float):
        """Non-blocking append to JSONL file."""
        if quality_score < settings.MIN_QUALITY_FOR_TRAINING:
            return
        if source not in ("gemini", "groq"):
            return
        try:
            record = {
                "instruction": "Analyze this research paper and return structured JSON.",
                "input": prompt,
                "output": output,
                "meta": {
                    "source": source,
                    "quality_score": quality_score,
                    "timestamp": datetime.now().isoformat(),
                },
            }
            path = os.path.join(settings.TRAINING_DATA_DIR, f"{source}.jsonl")
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._append, path, record)
        except Exception as e:
            logger.warning(f"Training save failed: {e}")

    def _append(self, path: str, record: Dict):
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")


training_collector = TrainingCollector()
