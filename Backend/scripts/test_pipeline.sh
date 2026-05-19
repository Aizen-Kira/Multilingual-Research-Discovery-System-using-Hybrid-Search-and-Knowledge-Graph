#!/bin/bash
# Quick smoke test of the SSE pipeline

echo "🧪 Testing PolyResearch v3.0 SSE Pipeline..."
echo "Streaming query: 'transformer neural networks'"
echo "-------------------------------------------"

curl -N -s \
  -H "X-API-Key: ${PUBLIC_API_KEY}" \
  "http://localhost:8000/api/research/stream?query=transformer+neural+networks&sources=arxiv,pubmed&max_papers=10" \
  | while IFS= read -r line; do
      echo "$line"
      # Stop after 'complete' phase
      if echo "$line" | grep -q '"phase": "complete"'; then
          echo ""
          echo "✅ Pipeline completed successfully"
          break
      fi
  done
