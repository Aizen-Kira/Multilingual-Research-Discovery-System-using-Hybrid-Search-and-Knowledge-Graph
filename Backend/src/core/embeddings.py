"""Embedding generator with batch support and memory management."""
import gc
import logging
from typing import List
import numpy as np
from sentence_transformers import SentenceTransformer
import torch
from src.config.settings import settings

logger = logging.getLogger(__name__)


class EmbeddingGenerator:
    def __init__(self):
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        self.model = SentenceTransformer(settings.EMBEDDING_MODEL, device=settings.EMBEDDING_DEVICE)
        self.dimension = settings.EMBEDDING_DIMENSION
        self._count = 0
        logger.info("✅ Embedding model ready")

    def generate_embedding(self, text: str) -> List[float]:
        if not text or len(text.strip()) < 5:
            return [0.0] * self.dimension
        with torch.no_grad():
            emb = self.model.encode(text.strip()[:5000], convert_to_numpy=True, normalize_embeddings=True)
        self._count += 1
        if self._count % 100 == 0:
            gc.collect()
        return emb.tolist()

    def generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        cleaned = [t.strip()[:5000] if t and len(t.strip()) >= 5 else "placeholder" for t in texts]
        with torch.no_grad():
            embeddings = self.model.encode(
                cleaned, convert_to_numpy=True, normalize_embeddings=True,
                batch_size=32, show_progress_bar=False,
            )
        self._count += len(embeddings)
        if self._count % 100 < len(embeddings):
            gc.collect()
        return [e.tolist() for e in embeddings]

    def cosine_similarity(self, emb1: List[float], emb2: List[float]) -> float:
        try:
            v1, v2 = np.array(emb1), np.array(emb2)
            return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9))
        except Exception:
            return 0.0


embedding_generator = EmbeddingGenerator()
