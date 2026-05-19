#!/bin/bash
# One-shot project setup script

set -e

echo "🚀 PolyResearch v3.0 Setup"
echo "================================"

# 1. Check .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env from .env.example"
    echo "   ⚠️  Fill in SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY before continuing"
    exit 1
fi

# 2. Create required dirs
mkdir -p logs training_data data

# 3. Build ML base (if not already built)
if ! docker image inspect ml-base-cpu:v1 &>/dev/null; then
    echo "📦 Building ML base image (first time, ~5 min)..."
    bash scripts/build_mlbase.sh
else
    echo "✅ ML base image already exists"
fi

# 4. Compose up
echo "🐳 Starting containers..."
docker compose up --build -d

echo ""
echo "✅ PolyResearch v3.0 is running!"
echo "   API:  http://localhost:8000"
echo "   Docs: http://localhost:8000/docs (when ENABLE_API_DOCS=true)"
echo "   SSE:  GET http://localhost:8000/api/research/stream?query=machine+learning"
