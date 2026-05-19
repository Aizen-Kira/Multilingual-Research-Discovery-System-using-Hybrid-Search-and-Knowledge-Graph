import logging
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.api.security import require_public_api_access
from src.agents.llm_agent import LLMAgent

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ContextPaper(BaseModel):
    title: str
    source: Optional[str] = None
    research_domain: Optional[str] = None
    citations: Optional[int | float] = None
    abstract: Optional[str] = None
    methodology: Optional[str] = None
    key_findings: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    contributions: List[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    context_paper: Optional[ContextPaper] = None
    workspace_query: Optional[str] = None
    history: List[ChatMessage] = Field(default_factory=list)


@router.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    _access: None = Depends(require_public_api_access),
):
    """
    RAG-enabled chat endpoint. It uses the LLMAgent to respond
    based on the provided context paper and conversation history.
    """
    try:
        agent = LLMAgent()

        prompt = (
            "You are an evidence-grounded research copilot.\n"
            "Your job is to answer like a strong analytical assistant: concise, structured, and explicit about uncertainty.\n\n"
            "RESPONSE RULES:\n"
            "- Use clear markdown sections when helpful.\n"
            "- Prefer short paragraphs and flat bullet lists.\n"
            "- Ground every claim in the provided context. Do not invent facts.\n"
            "- If the answer is not fully supported by the provided context, say so explicitly.\n"
            "- When summarizing a paper, prefer this structure when relevant:\n"
            "  1. Summary\n"
            "  2. Key Findings\n"
            "  3. Methodology\n"
            "  4. Limitations\n"
            "  5. Why It Matters\n"
            "- When the user asks for evidence, cite the evidence as bullets under a heading like 'Evidence from current context'.\n"
            "- When information is missing, include a short 'Uncertainty' or 'What is not clear from current context' section.\n"
            "- Do not output a single giant paragraph.\n\n"
        )

        if request.workspace_query:
            prompt += f"--- WORKSPACE QUERY ---\n{request.workspace_query}\n-----------------------\n\n"

        if request.context_paper:
            paper = request.context_paper
            prompt += "--- CONTEXT PAPER ---\n"
            prompt += f"Title: {paper.title}\n"
            if paper.source:
                prompt += f"Source: {paper.source}\n"
            if paper.research_domain:
                prompt += f"Research Domain: {paper.research_domain}\n"
            if paper.citations is not None:
                prompt += f"Citations: {paper.citations}\n"
            if paper.abstract:
                prompt += f"Abstract: {paper.abstract}\n"
            if paper.methodology:
                prompt += f"Methodology: {paper.methodology}\n"
            if paper.key_findings:
                prompt += "Key Findings:\n"
                for finding in paper.key_findings:
                    prompt += f"- {finding}\n"
            if paper.limitations:
                prompt += "Limitations:\n"
                for limitation in paper.limitations:
                    prompt += f"- {limitation}\n"
            if paper.contributions:
                prompt += "Contributions:\n"
                for contribution in paper.contributions:
                    prompt += f"- {contribution}\n"
            prompt += "---------------------\n\n"

        if request.history:
            prompt += "--- CONVERSATION HISTORY ---\n"
            for msg in request.history:
                role = msg.role.upper()
                prompt += f"{role}: {msg.content}\n"
            prompt += "----------------------------\n\n"

        prompt += f"USER: {request.message}\n"
        prompt += "ASSISTANT: "

        response_text, layer_used = await agent.call_llm(prompt)

        if not response_text:
            return {
                "success": False,
                "error": "Failed to generate a response from the AI layers.",
                "layer_used": layer_used
            }

        return {
            "success": True,
            "response": response_text.strip(),
            "layer_used": layer_used
        }

    except Exception as e:
        logger.error(f"Chat error: {e}")
        return {"success": False, "error": "Chat generation failed."}
