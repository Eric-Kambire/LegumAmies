#!/usr/bin/env bash
#
# LegumAmies AWS infrastructure - STEP 2 ONLY.
#
# Creates and ingests a Bedrock RAG Knowledge Base for the legume agronomy
# corpus, using:
#   - Amazon Titan Text Embeddings V2 (amazon.titan-embed-text-v2:0, 1024-dim)
#   - Amazon S3 Vectors as the vector store (NOT OpenSearch Serverless, to
#     avoid its higher baseline cost)
#   - the existing private source bucket from Step 1
#
# Scope: create vector store + IAM service role + Knowledge Base + S3 data
# source, then run ingestion. It does NOT create an agent or deploy anything.
#
# Auth: relies on the ambient IAM role (instance profile). No static keys are
# requested, printed, or stored. No secrets are written to disk.
#
# Prereq: documents already uploaded under s3://<DATA_BUCKET>/sources/
# (see step1 + upload of infra/aws/kb_corpus/sources/*.md).
#
# Idempotency: creation calls tolerate "already exists" so the script can be
# re-run. Resource ids are written to infra/aws/kb_resources.json (ids/ARNs are
# not secrets).
set -euo pipefail

REGION="us-east-1"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DATA_BUCKET="legumamies-rag-${ACCOUNT_ID}-2e32fb7c"
VECTOR_BUCKET="legumamies-rag-vectors-${ACCOUNT_ID}"
INDEX_NAME="legumes-kb-index"
ROLE_NAME="legumamies-bedrock-kb-role"
KB_NAME="legumamies-legumes-kb"
DS_NAME="legumamies-sources-s3"
EMBED_MODEL="amazon.titan-embed-text-v2:0"
EMBED_ARN="arn:aws:bedrock:${REGION}::foundation-model/${EMBED_MODEL}"

VECTOR_BUCKET_ARN="arn:aws:s3vectors:${REGION}:${ACCOUNT_ID}:bucket/${VECTOR_BUCKET}"
INDEX_ARN="${VECTOR_BUCKET_ARN}/index/${INDEX_NAME}"

echo "== 0. Verify Titan embeddings are actually invokable (not just listed) =="
printf '{"inputText":"pois chiche floraison"}' | base64 -w0 > /tmp/_emb.b64
aws bedrock-runtime invoke-model --model-id "${EMBED_MODEL}" \
  --body "$(cat /tmp/_emb.b64)" --cli-binary-format base64 \
  --region "${REGION}" /tmp/_emb_out.json >/dev/null
python3 -c "import json;d=json.load(open('/tmp/_emb_out.json'));assert len(d['embedding'])==1024;print('Titan v2 OK, dims',len(d['embedding']))"

echo "== 1. S3 Vectors store (bucket + index, 1024-dim cosine) =="
aws s3vectors create-vector-bucket --vector-bucket-name "${VECTOR_BUCKET}" --region "${REGION}" 2>/dev/null \
  || echo "vector bucket exists"
aws s3vectors create-index --vector-bucket-name "${VECTOR_BUCKET}" --index-name "${INDEX_NAME}" \
  --data-type float32 --dimension 1024 --distance-metric cosine --region "${REGION}" 2>/dev/null \
  || echo "index exists"

echo "== 2. IAM service role for the Knowledge Base =="
aws iam create-role --role-name "${ROLE_NAME}" \
  --assume-role-policy-document "file://${HERE}/kb_trust_policy.json" \
  --description "Service role for LegumAmies Bedrock KB (S3 Vectors + Titan)" >/dev/null 2>&1 \
  || echo "role exists"
aws iam put-role-policy --role-name "${ROLE_NAME}" \
  --policy-name legumamies-kb-permissions \
  --policy-document "file://${HERE}/kb_permissions_policy.json"
ROLE_ARN="$(aws iam get-role --role-name "${ROLE_NAME}" --query 'Role.Arn' --output text)"
echo "role: ${ROLE_ARN}"
sleep 15  # allow IAM propagation before Bedrock assumes the role

echo "== 3. Create the Knowledge Base (S3 Vectors) =="
KB_ID="$(aws bedrock-agent list-knowledge-bases --region "${REGION}" \
  --query "knowledgeBaseSummaries[?name=='${KB_NAME}'].knowledgeBaseId | [0]" --output text)"
if [ "${KB_ID}" = "None" ] || [ -z "${KB_ID}" ]; then
  KB_ID="$(aws bedrock-agent create-knowledge-base \
    --name "${KB_NAME}" \
    --description "LegumAmies RAG KB: Terres Inovia/Agreste legume agronomy (FR)" \
    --role-arn "${ROLE_ARN}" \
    --knowledge-base-configuration "file://${HERE}/kb_config.json" \
    --storage-configuration "file://${HERE}/kb_storage.json" \
    --region "${REGION}" --query 'knowledgeBase.knowledgeBaseId' --output text)"
fi
echo "KB_ID: ${KB_ID}"

# wait for ACTIVE
for i in $(seq 1 30); do
  st="$(aws bedrock-agent get-knowledge-base --knowledge-base-id "${KB_ID}" --region "${REGION}" \
        --query 'knowledgeBase.status' --output text)"
  echo "  KB status: ${st}"; [ "${st}" = "ACTIVE" ] && break; sleep 5
done

echo "== 4. Create the S3 data source (prefix sources/) =="
DS_ID="$(aws bedrock-agent list-data-sources --knowledge-base-id "${KB_ID}" --region "${REGION}" \
  --query "dataSourceSummaries[?name=='${DS_NAME}'].dataSourceId | [0]" --output text)"
if [ "${DS_ID}" = "None" ] || [ -z "${DS_ID}" ]; then
  DS_ID="$(aws bedrock-agent create-data-source \
    --knowledge-base-id "${KB_ID}" --name "${DS_NAME}" \
    --description "Terres Inovia/Agreste paraphrased legume summaries under sources/" \
    --data-source-configuration "file://${HERE}/kb_datasource.json" \
    --region "${REGION}" --query 'dataSource.dataSourceId' --output text)"
fi
echo "DS_ID: ${DS_ID}"

echo "== 5. Start ingestion and wait =="
JOB_ID="$(aws bedrock-agent start-ingestion-job --knowledge-base-id "${KB_ID}" \
  --data-source-id "${DS_ID}" --region "${REGION}" \
  --query 'ingestionJob.ingestionJobId' --output text)"
for i in $(seq 1 40); do
  st="$(aws bedrock-agent get-ingestion-job --knowledge-base-id "${KB_ID}" \
        --data-source-id "${DS_ID}" --ingestion-job-id "${JOB_ID}" --region "${REGION}" \
        --query 'ingestionJob.status' --output text)"
  echo "  ingestion status: ${st}"
  { [ "${st}" = "COMPLETE" ] || [ "${st}" = "FAILED" ]; } && break; sleep 6
done
aws bedrock-agent get-ingestion-job --knowledge-base-id "${KB_ID}" \
  --data-source-id "${DS_ID}" --ingestion-job-id "${JOB_ID}" --region "${REGION}" \
  --query 'ingestionJob.statistics' --output json

echo "== 6. Record resource ids (no secrets) =="
cat > "${HERE}/kb_resources.json" <<JSON
{
  "region": "${REGION}",
  "data_bucket": "${DATA_BUCKET}",
  "vector_bucket": "${VECTOR_BUCKET}",
  "vector_bucket_arn": "${VECTOR_BUCKET_ARN}",
  "index_name": "${INDEX_NAME}",
  "index_arn": "${INDEX_ARN}",
  "embedding_model": "${EMBED_MODEL}",
  "embedding_dimensions": 1024,
  "kb_service_role": "${ROLE_ARN}",
  "knowledge_base_id": "${KB_ID}",
  "data_source_id": "${DS_ID}",
  "vector_store": "S3_VECTORS"
}
JSON
echo "Wrote ${HERE}/kb_resources.json"
echo "DONE. KB_ID=${KB_ID} DS_ID=${DS_ID}"
