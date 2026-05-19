#!/bin/bash
set -e

echo "🔨 Building Generic ML Base Image (ml-base-cpu:v1)..."
echo "   Includes: torch 2.2 CPU + transformers + sentence-transformers + MiniLM"
echo "   (~2GB download — runs ONCE, cached forever, reusable across projects)"
echo ""

docker build \
  -f docker/Dockerfile.mlbase \
  -t ml-base-cpu:v1 \
  .

echo ""
echo "✅ Generic ML base built: ml-base-cpu:v1"
echo "   Reuse in any project with: FROM ml-base-cpu:v1"
echo ""
echo "▶  Now run: docker-compose up --build"
