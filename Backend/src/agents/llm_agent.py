"""
Phase 5 - LLM Analysis Agent
5-layer fallback chain:
  Layer 0: HuggingFace fine-tuned (future, after 300 training samples)
  Layer 1: Gemini 2.0 Flash-Lite
  Layer 2: Groq llama-3.3-70b
  Layer 3: OpenRouter meta-llama/llama-3.1-8b-instruct:free
  Layer 4: Rule-based extraction (zero API, always available)
"""
import asyncio
import json
import logging
import re
from typing import Any, AsyncGenerator, Dict, List, Optional

from src.agents.base_agent import BaseAgent
from src.config.settings import settings
from src.core.training_collector import training_collector

logger = logging.getLogger(__name__)


ANALYSIS_PROMPT_TEMPLATE = """Analyze this research paper and return ONLY a JSON object.

Title: {title}
Abstract: {abstract}

Return ONLY this JSON (no markdown, no extra text):
{{
  "research_domain": "e.g. Machine Learning",
  "methodology": "brief description",
  "key_findings": ["finding1", "finding2", "finding3"],
  "innovations": ["innovation1"],
  "limitations": ["limitation1"],
  "contributions": ["contribution1"],
  "context_summary": "2-3 sentence summary",
  "quality_score": 0.0
}}"""

RELATIONSHIP_PROMPT_TEMPLATE = """Analyze the semantic relationship between these two research papers.

Paper 1: {title1}
Summary 1: {summary1}

Paper 2: {title2}
Summary 2: {summary2}

Return ONLY this JSON:
{{
  "relationship_type": "builds_upon|extends|complements|applies|related|cites",
  "relationship_strength": 0.0,
  "relationship_context": "brief explanation",
  "connection_reasoning": "why they are related"
}}"""


def _parse_json(text: str) -> Optional[Dict]:
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    return None


def _rule_based_analysis(paper: Dict) -> Dict:
    title = (paper.get("title") or "").lower()
    abstract = (paper.get("abstract") or "").lower()
    text = f"{title} {abstract}"
    domains = {
        "Machine Learning": ["machine learning", "neural network", "deep learning", "gradient", "backprop"],
        "Computer Vision": ["image", "vision", "detection", "segmentation", "object"],
        "Natural Language Processing": ["language model", "nlp", "text", "sentiment", "translation", "bert", "gpt"],
        "Healthcare": ["medical", "clinical", "patient", "disease", "drug", "health"],
        "Robotics": ["robot", "autonomous", "navigation", "manipulation"],
        "Data Science": ["data mining", "analytics", "big data", "statistics"],
    }
    domain = "General Research"
    for candidate, keywords in domains.items():
        if any(keyword in text for keyword in keywords):
            domain = candidate
            break
    abstract_text = paper.get("abstract") or ""
    return {
        "research_domain": domain,
        "methodology": "Extracted from abstract",
        "key_findings": [abstract_text[:120] + "..." if len(abstract_text) > 120 else abstract_text],
        "innovations": [],
        "limitations": [],
        "contributions": [],
        "context_summary": abstract_text[:200],
        "quality_score": 0.45,
        "ai_agent_used": "rule_based",
        "analysis_method": "rule_based",
    }


class LLMAgent(BaseAgent):
    @property
    def phase(self) -> int:
        return 5

    @property
    def name(self) -> str:
        return "LLM Analysis"

    def __init__(self):
        super().__init__()
        self._gemini = None
        self._groq = None
        self._openrouter = None

    def _get_gemini(self):
        if self._gemini is None and settings.GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._gemini = genai.GenerativeModel("gemini-2.0-flash-lite")
            except Exception as e:
                self.logger.warning(f"Gemini init failed: {e}")
        return self._gemini

    def _get_groq(self):
        if self._groq is None and settings.GROQ_API_KEY:
            try:
                from groq import AsyncGroq
                self._groq = AsyncGroq(api_key=settings.GROQ_API_KEY)
            except Exception as e:
                self.logger.warning(f"Groq init failed: {e}")
        return self._groq

    async def _call_gemini(self, prompt: str) -> Optional[str]:
        model = self._get_gemini()
        if not model:
            return None
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: model.generate_content(prompt))
            return response.text
        except Exception as e:
            err = str(e)
            if "GenerateRequestsPerDayPerProjectPerModel-FreeTier" in err:
                self.logger.debug("Gemini daily quota exhausted, falling back to Groq")
            else:
                self.logger.warning(f"Gemini call failed: {e}")
            return None

    async def _call_groq(self, prompt: str) -> Optional[str]:
        client = self._get_groq()
        if not client:
            return None
        try:
            response = await client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1500,
                temperature=0.3,
            )
            return response.choices[0].message.content
        except Exception as e:
            self.logger.warning(f"Groq call failed: {e}")
            return None

    async def _call_openrouter(self, prompt: str) -> Optional[str]:
        if not settings.OPENROUTER_API_KEY:
            return None
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(base_url="https://openrouter.ai/api/v1", api_key=settings.OPENROUTER_API_KEY)
            response = await client.chat.completions.create(
                model="meta-llama/llama-3.1-8b-instruct:free",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1200,
                temperature=0.3,
            )
            return response.choices[0].message.content
        except Exception as e:
            self.logger.warning(f"OpenRouter call failed: {e}")
            return None

    async def _call_llm(self, prompt: str) -> tuple[Optional[str], str]:
        if settings.HF_TOKEN and settings.HF_MODEL_REPO:
            pass

        text = await self._call_gemini(prompt)
        if text:
            return text, "gemini"

        text = await self._call_groq(prompt)
        if text:
            return text, "groq"

        text = await self._call_openrouter(prompt)
        if text:
            return text, "openrouter"

        return None, "rule_based"

    async def analyze_paper(self, paper: Dict) -> Dict:
        title = paper.get("title") or "Untitled"
        abstract = (paper.get("abstract") or "")[:1000]
        prompt = ANALYSIS_PROMPT_TEMPLATE.format(title=title, abstract=abstract)
        text, layer = await self._call_llm(prompt)
        if layer == "rule_based" or not text:
            result = _rule_based_analysis(paper)
            layer = "rule_based"
        else:
            parsed = _parse_json(text)
            if not parsed:
                result = _rule_based_analysis(paper)
                layer = "rule_based"
            else:
                result = {
                    "research_domain": parsed.get("research_domain", "General Research"),
                    "methodology": parsed.get("methodology", ""),
                    "key_findings": parsed.get("key_findings", []),
                    "innovations": parsed.get("innovations", []),
                    "limitations": parsed.get("limitations", []),
                    "contributions": parsed.get("contributions", []),
                    "context_summary": parsed.get("context_summary", ""),
                    "quality_score": min(1.0, max(0.0, float(parsed.get("quality_score", 0.6)))),
                    "ai_agent_used": layer,
                    "analysis_method": layer,
                }
        if layer in ("gemini", "groq") and result.get("quality_score", 0) >= settings.MIN_QUALITY_FOR_TRAINING:
            asyncio.create_task(training_collector.save(prompt, text, layer, result["quality_score"]))
        paper.update(result)
        return paper

    async def call_llm(self, prompt: str) -> tuple[Optional[str], str]:
        return await self._call_llm(prompt)

    async def analyze_relationship(self, paper1: Dict, paper2: Dict) -> Dict:
        summary1 = paper1.get("context_summary") or paper1.get("abstract") or ""
        summary2 = paper2.get("context_summary") or paper2.get("abstract") or ""
        prompt = RELATIONSHIP_PROMPT_TEMPLATE.format(
            title1=paper1.get("title") or "Untitled",
            summary1=summary1[:500],
            title2=paper2.get("title") or "Untitled",
            summary2=summary2[:500],
        )

        text, layer = await self._call_llm(prompt)
        if not text:
            return {
                "relationship_type": "related",
                "relationship_strength": 0.55,
                "relationship_context": "Relationship inferred from fallback semantic analysis.",
                "connection_reasoning": "Hosted model unavailable; using safe related fallback.",
                "analysis_method": "rule_based",
                "confidence_score": 0.55,
            }

        parsed = _parse_json(text)
        if not parsed:
            return {
                "relationship_type": "related",
                "relationship_strength": 0.55,
                "relationship_context": "Relationship inferred from fallback semantic analysis.",
                "connection_reasoning": "Model response was not valid JSON; using safe related fallback.",
                "analysis_method": "rule_based",
                "confidence_score": 0.55,
            }

        return {
            "relationship_type": parsed.get("relationship_type", "related"),
            "relationship_strength": min(1.0, max(0.0, float(parsed.get("relationship_strength", 0.6)))),
            "relationship_context": parsed.get("relationship_context", "Semantic relationship inferred from summaries."),
            "connection_reasoning": parsed.get("connection_reasoning", "The papers overlap in topic or method."),
            "analysis_method": layer,
            "confidence_score": min(1.0, max(0.0, float(parsed.get("relationship_strength", 0.6)))),
        }

    async def run(self, ctx: Dict[str, Any]) -> AsyncGenerator[Dict, None]:
        new_papers: List[Dict] = ctx.get("new_papers", [])
        if not new_papers:
            yield self._event(status="skip", analyzed=0, layer_used="none")
            return

        sem_gemini = asyncio.Semaphore(settings.GEMINI_CONCURRENCY)
        sem_groq = asyncio.Semaphore(settings.GROQ_CONCURRENCY)
        sem_openrouter = asyncio.Semaphore(settings.OPENROUTER_CONCURRENCY)

        analyzed: List[Dict] = []
        layer_counts: Dict[str, int] = {"gemini": 0, "groq": 0, "openrouter": 0, "rule_based": 0}

        async def _analyze_one(paper: Dict) -> Dict:
            title = paper.get("title") or "Untitled"
            abstract = (paper.get("abstract") or "")[:1000]

            async with sem_gemini:
                prompt = ANALYSIS_PROMPT_TEMPLATE.format(title=title, abstract=abstract)
                text = await self._call_gemini(prompt)
                if text:
                    parsed = _parse_json(text)
                    if parsed:
                        result = {
                            "research_domain": parsed.get("research_domain", "General Research"),
                            "methodology": parsed.get("methodology", ""),
                            "key_findings": parsed.get("key_findings", []),
                            "innovations": parsed.get("innovations", []),
                            "limitations": parsed.get("limitations", []),
                            "contributions": parsed.get("contributions", []),
                            "context_summary": parsed.get("context_summary", ""),
                            "quality_score": min(1.0, max(0.0, float(parsed.get("quality_score", 0.6)))),
                            "ai_agent_used": "gemini",
                            "analysis_method": "gemini",
                        }
                        if result["quality_score"] >= settings.MIN_QUALITY_FOR_TRAINING:
                            asyncio.create_task(training_collector.save(prompt, text, "gemini", result["quality_score"]))
                        layer_counts["gemini"] += 1
                        paper.update(result)
                        return paper

            async with sem_groq:
                prompt = ANALYSIS_PROMPT_TEMPLATE.format(title=title, abstract=abstract)
                text = await self._call_groq(prompt)
                if text:
                    parsed = _parse_json(text)
                    if parsed:
                        result = {
                            "research_domain": parsed.get("research_domain", "General Research"),
                            "methodology": parsed.get("methodology", ""),
                            "key_findings": parsed.get("key_findings", []),
                            "innovations": parsed.get("innovations", []),
                            "limitations": parsed.get("limitations", []),
                            "contributions": parsed.get("contributions", []),
                            "context_summary": parsed.get("context_summary", ""),
                            "quality_score": min(1.0, max(0.0, float(parsed.get("quality_score", 0.6)))),
                            "ai_agent_used": "groq",
                            "analysis_method": "groq",
                        }
                        if result["quality_score"] >= settings.MIN_QUALITY_FOR_TRAINING:
                            asyncio.create_task(training_collector.save(prompt, text, "groq", result["quality_score"]))
                        layer_counts["groq"] += 1
                        paper.update(result)
                        return paper
                await asyncio.sleep(settings.GROQ_INTER_BATCH_SLEEP)

            async with sem_openrouter:
                prompt = ANALYSIS_PROMPT_TEMPLATE.format(title=title, abstract=abstract)
                text = await self._call_openrouter(prompt)
                if text:
                    parsed = _parse_json(text)
                    if parsed:
                        result = {
                            "research_domain": parsed.get("research_domain", "General Research"),
                            "methodology": parsed.get("methodology", ""),
                            "key_findings": parsed.get("key_findings", []),
                            "innovations": parsed.get("innovations", []),
                            "limitations": parsed.get("limitations", []),
                            "contributions": parsed.get("contributions", []),
                            "context_summary": parsed.get("context_summary", ""),
                            "quality_score": min(1.0, max(0.0, float(parsed.get("quality_score", 0.6)))),
                            "ai_agent_used": "openrouter",
                            "analysis_method": "openrouter",
                        }
                        layer_counts["openrouter"] += 1
                        paper.update(result)
                        return paper

            fallback = _rule_based_analysis(paper)
            layer_counts["rule_based"] += 1
            paper.update(fallback)
            return paper

        batch_size = settings.GROQ_CONCURRENCY * 2
        self.logger.info(f"LLM Agent analysing {len(new_papers)} papers")

        for i in range(0, len(new_papers), batch_size):
            batch = new_papers[i:i + batch_size]
            results = await asyncio.gather(*[_analyze_one(paper) for paper in batch])
            analyzed.extend(results)

            dominant_layer = max(layer_counts, key=lambda key: layer_counts[key])

            if i + batch_size < len(new_papers):
                await asyncio.sleep(settings.GROQ_INTER_BATCH_SLEEP)

            yield self._event(
                status="progress",
                analyzed=len(analyzed),
                total=len(new_papers),
                layer_used=dominant_layer,
            )

        ctx["analyzed_papers"] = analyzed
        ctx["analyzed_new_papers"] = analyzed

        dominant_layer = max(layer_counts, key=lambda key: layer_counts[key])
        self.logger.info(
            f"LLM analysis complete: {len(analyzed)} papers | "
            f"layers {dict((key, value) for key, value in layer_counts.items() if value > 0)}"
        )
        yield self._event(
            status="done",
            analyzed=len(analyzed),
            layer_used=dominant_layer,
            layer_breakdown=layer_counts,
        )
