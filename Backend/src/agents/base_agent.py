"""
Base Agent — all pipeline agents extend this.
Each agent receives the shared PipelineContext dict and mutates it.
Uses SSEEmitter for standardised event output.
"""
import logging
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Dict

from src.pipeline.sse_emitter import sse, SSEEmitter


class BaseAgent(ABC):
    """
    Abstract base for all PolyResearch pipeline agents.

    Convention:
      - Read inputs  from ctx
      - Write outputs into ctx
      - Yield SSE event dicts via self.sse helper
    """

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.sse: SSEEmitter = sse  # Shared singleton

    @property
    @abstractmethod
    def phase(self) -> Any:
        """Phase identifier (int or str like '4A')."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable phase name."""

    @abstractmethod
    async def run(
        self, ctx: Dict[str, Any]
    ) -> AsyncGenerator[Dict, None]:
        """
        Execute agent logic.
        Must be an async generator that yields SSE event dicts.
        """
        ...

    def _event(self, **kwargs) -> Dict:
        """
        Build a raw event dict (for agents that don't use
        a named SSEEmitter method).
        """
        return {
            "phase": self.phase,
            "name": self.name,
            **kwargs,
        }

    def _error_event(self, message: str) -> Dict:
        """Build an error SSE event for this phase."""
        return self.sse.error(self.phase, self.name, message)
