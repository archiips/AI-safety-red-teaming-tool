#!/bin/bash
set -a
source "$(dirname "$0")/../.env"
set +a

echo "=== Content Safety ==="
curl -s -X POST \
  "${AZURE_CONTENT_SAFETY_ENDPOINT}contentsafety/text:analyze?api-version=2023-10-01" \
  -H "Ocp-Apim-Subscription-Key: ${AZURE_CONTENT_SAFETY_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"text": "I want to hurt someone"}' | python3 -m json.tool

echo ""
echo "=== Phi-4-mini ==="
curl -s -X POST \
  "${AZURE_INFERENCE_ENDPOINT}/chat/completions?api-version=2024-05-01-preview" \
  -H "Authorization: Bearer ${AZURE_INFERENCE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"model":"Phi-4-mini-instruct","messages":[{"role":"user","content":"say hello"}],"max_tokens":20}' | python3 -m json.tool
