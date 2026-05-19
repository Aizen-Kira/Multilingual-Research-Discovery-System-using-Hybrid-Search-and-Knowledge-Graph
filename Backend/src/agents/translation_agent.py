"""
Phase 2 — Selective Translation Agent

Key fix: ctx["query_variants"] is now List[Dict{"query": str, "lang": str}]
  instead of List[str], so FetchAgent can route variants by language:
  - English variants → all 5 sources
  - Non-English variants → only multilingual sources (crossref, europepmc, doaj)

For English queries  → translates to ZH, DE, FR, ES, JA, PT, AR, RU
For non-English queries → normalizes to English + keeps original + 4 key langs
"""
import asyncio
import json
from typing import Any, AsyncGenerator, Dict, List
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from src.agents.base_agent import BaseAgent

# Extended target languages for multilingual academic search
TARGET_LANGS = {
    "zh-CN": "zh",   # Chinese — high volume in CS/AI research
    "de":    "de",   # German — strong in engineering/science
    "fr":    "fr",   # French — widely used in life sciences
    "es":    "es",   # Spanish — growing AI research community
    "ja":    "ja",   # Japanese — robotics, electronics
    "pt":    "pt",   # Portuguese — Brazilian research output
    "ar":    "ar",   # Arabic — growing STEM publications
    "ru":    "ru",   # Russian — physics, mathematics
}


def _translate_sync(source: str, target: str, text: str) -> str:
    query = urlencode(
        {
            "client": "gtx",
            "sl": source,
            "tl": target,
            "dt": "t",
            "q": text,
        }
    )
    request = Request(
        f"https://translate.googleapis.com/translate_a/single?{query}",
        headers={"User-Agent": "PolyResearch/3.0"},
    )
    with urlopen(request, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return "".join(part[0] for part in payload[0] if part and part[0])


class TranslationAgent(BaseAgent):
    phase = 2
    name = "Query Translation"

    async def run(self, ctx: Dict[str, Any]) -> AsyncGenerator[Dict, None]:
        query: str = ctx["query"]
        src_lang: str = ctx.get("detected_language", {}).get("language", "en")

        # query_variants: List[Dict{"query": str, "lang": str}]
        # First variant is always the original query with its detected language
        variants: List[Dict[str, str]] = [{"query": query, "lang": src_lang}]
        translation_log: Dict[str, str] = {}

        loop = asyncio.get_event_loop()

        if src_lang == "en":
            # ── English query → translate to all 8 languages in parallel ──────
            translation_tasks = {
                lang_code: loop.run_in_executor(
                    None, _translate_sync, "en", target_code, query
                )
                for target_code, lang_code in TARGET_LANGS.items()
            }

            results = await asyncio.gather(
                *translation_tasks.values(), return_exceptions=True
            )

            for lang_code, result in zip(translation_tasks.keys(), results):
                if isinstance(result, Exception):
                    self.logger.warning(f"Translation to {lang_code} failed: {result}")
                    continue
                translated = (result or "").strip()
                if translated and translated != query:
                    variants.append({"query": translated, "lang": lang_code})
                    translation_log[lang_code.upper()] = translated[:50]
                    self.logger.debug(f"[{lang_code.upper()}] {translated[:50]}")

        elif src_lang != "en":
            # ── Non-English query → normalize to EN, then expand ──────────────
            try:
                en_query = await loop.run_in_executor(
                    None, _translate_sync, "auto", "en", query
                )
                en_query = (en_query or "").strip()

                if en_query and en_query != query:
                    variants.append({"query": en_query, "lang": "en"})
                    translation_log["EN"] = en_query[:50]
                    self.logger.info(f"Normalized to EN: {en_query[:60]}")

                    # Expand to 4 key languages from the English form
                    limited_targets = list(TARGET_LANGS.items())[:4]
                    for target_code, lang_code in limited_targets:
                        try:
                            t = await loop.run_in_executor(
                                None, _translate_sync, "en", target_code, en_query
                            )
                            t = (t or "").strip()
                            # Deduplicate — don't add if already present
                            existing_queries = {v["query"] for v in variants}
                            if t and t not in existing_queries:
                                variants.append({"query": t, "lang": lang_code})
                                translation_log[lang_code.upper()] = t[:50]
                        except Exception as e:
                            self.logger.warning(
                                f"Re-translation to {lang_code} failed: {e}"
                            )
            except Exception as e:
                self.logger.warning(f"EN normalization failed: {e}")

        ctx["query_variants"] = variants

        self.logger.info(
            f"Query variants generated: {len(variants)} "
            f"(original: '{query[:30]}' | translations: {list(translation_log.keys())})"
        )
        yield self._event(
            status="done",
            variants=len(variants),
            # Emit plain strings for SSE display only
            variant_list=[v["query"] for v in variants],
            translations=translation_log,
            source_language=src_lang,
        )
