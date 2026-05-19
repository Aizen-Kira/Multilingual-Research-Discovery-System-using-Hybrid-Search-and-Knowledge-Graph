"""
Phase 1 — Language Detection Agent

Key fixes:
  - Confidence threshold of 0.50: below this, force "en" to prevent
    short English queries (e.g. "Lung cancer") being misclassified
    as Tagalog/other with low confidence, which kills multilingual expansion
  - lingua used as primary detector when available (much more accurate than langdetect)
  - langdetect used as fallback with detect_langs() for confidence scores
"""
from typing import Any, AsyncGenerator, Dict

from src.agents.base_agent import BaseAgent

# ── lingua (preferred — much more accurate than langdetect) ──────────────────
try:
    from lingua import Language, LanguageDetectorBuilder
    _lingua = LanguageDetectorBuilder.from_all_languages().with_minimum_relative_distance(0.1).build()
    _LINGUA_OK = True
except Exception:
    _lingua = None
    _LINGUA_OK = False

# ── langdetect (fallback) ─────────────────────────────────────────────────────
try:
    from langdetect import detect_langs as _detect_langs_fn
    _LANGDETECT_OK = True
except Exception:
    _LANGDETECT_OK = False

# Minimum confidence to trust detection; below this → default to English
CONFIDENCE_THRESHOLD = 0.50

# Minimum query length below which detection is unreliable → default to English
MIN_QUERY_LENGTH = 8

LANG_NAMES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "zh": "Chinese", "ja": "Japanese", "ko": "Korean", "ru": "Russian",
    "ar": "Arabic", "hi": "Hindi", "pt": "Portuguese", "it": "Italian",
    "nl": "Dutch", "sv": "Swedish", "pl": "Polish", "tr": "Turkish",
    "ta": "Tamil", "te": "Telugu",
}

_ENGLISH_DEFAULT = {"language": "en", "language_name": "English", "confidence": 1.0}


class LanguageAgent(BaseAgent):
    phase = 1
    name = "Language Detection"

    async def run(self, ctx: Dict[str, Any]) -> AsyncGenerator[Dict, None]:
        query: str = ctx["query"]
        result = _ENGLISH_DEFAULT.copy()

        # Very short queries are unreliable — always treat as English
        if len(query.strip()) < MIN_QUERY_LENGTH:
            self.logger.info(
                f"Query too short ({len(query.strip())} chars) — defaulting to English"
            )
            ctx["detected_language"] = result
            yield self._event(status="done", **result)
            return

        try:
            if _LINGUA_OK and _lingua:
                result = self._detect_with_lingua(query)
            elif _LANGDETECT_OK:
                result = self._detect_with_langdetect(query)
            # else: result stays as English default
        except Exception as e:
            self.logger.warning(f"Language detection failed, defaulting to English: {e}")

        # Final confidence gate — if uncertain, force English
        # This prevents "Lung cancer" → Tagalog, "Deep learning" → Welsh, etc.
        if result["confidence"] < CONFIDENCE_THRESHOLD:
            self.logger.info(
                f"Low confidence ({result['confidence']:.2f}) for lang={result['language']} "
                f"— overriding to English"
            )
            result = _ENGLISH_DEFAULT.copy()

        ctx["detected_language"] = result
        self.logger.info(
            f"Detected: {result['language_name']} ({result['confidence']:.2f})"
        )
        yield self._event(status="done", **result)

    def _detect_with_lingua(self, query: str) -> Dict:
        detected = _lingua.detect_language_of(query)
        if not detected:
            return _ENGLISH_DEFAULT.copy()

        code = detected.iso_code_639_1.name.lower()
        conf = float(_lingua.compute_language_confidence(query, detected))
        return {
            "language": code,
            "language_name": LANG_NAMES.get(code, code),
            "confidence": conf,
        }

    def _detect_with_langdetect(self, query: str) -> Dict:
        results = _detect_langs_fn(query)
        if not results:
            return _ENGLISH_DEFAULT.copy()

        top = results[0]
        code = top.lang
        conf = float(top.prob)
        return {
            "language": code,
            "language_name": LANG_NAMES.get(code, code),
            "confidence": conf,
        }
