#!/usr/bin/env bash
#
# LegumAmies AWS infrastructure - STEP 1 ONLY.
#
# Creates the private, encrypted S3 bucket that will later hold authorized
# agricultural source documents (Terres Inovia, Agreste) for a Bedrock
# Knowledge Base / RAG workflow.
#
# Scope of this script (deliberately limited):
#   - verify identity + region
#   - create a private S3 bucket (name starts with legumamies-rag-)
#   - enable S3 Block Public Access (all four flags)
#   - enable default server-side encryption (SSE-S3 / AES256)
#   - disable ACLs (bucket owner enforced)
#   - create the sources/ prefix (zero-byte placeholder)
#
# It does NOT upload documents, create a Knowledge Base, or deploy an agent.
#
# Auth: relies on the ambient IAM role (EC2 instance profile / assumed role).
# It never requests, prints, or stores AWS access keys. No secrets are written.
#
# Reproducibility: re-running creates a NEW uniquely-named bucket. To act on an
# existing bucket, pass its name as the first argument:
#     ./step1_s3_rag_bucket.sh [bucket-name]
#
set -euo pipefail

REGION="us-east-1"

echo "== 1. Identity & region =="
aws sts get-caller-identity --output table
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "Region pinned to: ${REGION}"

echo "== 2. Permission probes (read-only) =="
aws s3api list-buckets --query 'Owner.ID' --output text >/dev/null && echo "S3: list OK"
aws bedrock list-foundation-models --region "${REGION}" --query 'length(modelSummaries)' --output text \
  | xargs -I{} echo "Bedrock models: {} available"
aws bedrock-agent list-knowledge-bases --region "${REGION}" --query 'knowledgeBaseSummaries' --output text >/dev/null \
  && echo "Bedrock Knowledge Bases: list OK"
aws lambda list-functions --region "${REGION}" --query 'length(Functions)' --output text \
  | xargs -I{} echo "Lambda: {} functions visible"
# Non-destructive check that a KB could be created (creates nothing):
ROLE_ARN="$(aws sts get-caller-identity --query Arn --output text \
  | sed -E 's#assumed-role/([^/]+)/.*#role/\1#; s#sts::#iam::#')"
aws iam simulate-principal-policy --policy-source-arn "${ROLE_ARN}" \
  --action-names bedrock:CreateKnowledgeBase iam:PassRole aoss:CreateCollection \
  --region "${REGION}" \
  --query 'EvaluationResults[].{action:EvalActionName,decision:EvalDecision}' \
  --output table 2>/dev/null || echo "iam:SimulatePrincipalPolicy not permitted (skip)"

echo "== 3. Create private S3 bucket =="
BUCKET="${1:-legumamies-rag-${ACCOUNT_ID}-$(openssl rand -hex 4)}"
echo "Bucket name: ${BUCKET}"
# us-east-1 must NOT pass a LocationConstraint.
if ! aws s3api head-bucket --bucket "${BUCKET}" --region "${REGION}" 2>/dev/null; then
  aws s3api create-bucket --bucket "${BUCKET}" --region "${REGION}"
fi

echo "== 4a. Block Public Access (all flags) =="
aws s3api put-public-access-block --bucket "${BUCKET}" --region "${REGION}" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "== 4b. Default server-side encryption (SSE-S3 / AES256) =="
aws s3api put-bucket-encryption --bucket "${BUCKET}" --region "${REGION}" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'

echo "== 4c. Disable ACLs (bucket owner enforced) =="
aws s3api put-bucket-ownership-controls --bucket "${BUCKET}" --region "${REGION}" \
  --ownership-controls '{"Rules":[{"ObjectOwnership":"BucketOwnerEnforced"}]}'

echo "== 5. Create sources/ prefix (placeholder, no documents uploaded) =="
aws s3api put-object --bucket "${BUCKET}" --region "${REGION}" --key "sources/.keep" >/dev/null

echo "== Verification =="
aws s3api get-bucket-location --bucket "${BUCKET}" --region "${REGION}" --output json
aws s3api get-public-access-block --bucket "${BUCKET}" --region "${REGION}" --output json
aws s3api get-bucket-encryption --bucket "${BUCKET}" --region "${REGION}" --output json
aws s3api list-objects-v2 --bucket "${BUCKET}" --region "${REGION}" --prefix "sources/" \
  --query 'Contents[].Key' --output json

echo "DONE. Bucket: ${BUCKET} (region ${REGION})"
