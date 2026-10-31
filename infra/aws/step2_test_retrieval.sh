#!/usr/bin/env bash
#
# Test the LegumAmies Bedrock Knowledge Base with retrieval-only queries.
# Shows the top passages and their S3 source document for three real questions
# (flowering, heat stress, harvesting). Read-only; creates no resources.
#
# Usage: ./step2_test_retrieval.sh [KB_ID]
#   KB_ID defaults to the value in kb_resources.json.
set -euo pipefail
REGION="us-east-1"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KB_ID="${1:-$(python3 -c "import json;print(json.load(open('${HERE}/kb_resources.json'))['knowledge_base_id'])")}"

ask () {
  local q="$1"
  echo "=================================================================="
  echo "Q: ${q}"
  aws bedrock-agent-runtime retrieve --knowledge-base-id "${KB_ID}" --region "${REGION}" \
    --retrieval-query "{\"text\":\"${q}\"}" \
    --retrieval-configuration '{"vectorSearchConfiguration":{"numberOfResults":2}}' \
    --query 'retrievalResults[].{score:score,source:location.s3Location.uri,text:content.text}' \
    --output json
}

ask "À partir de quelle température la floraison de la lentille est-elle perturbée ?"
ask "Quel est le seuil de température de stress thermique pour le pois et la féverole pendant la floraison ?"
ask "Quels sont les risques d une récolte trop tardive des légumineuses ?"
