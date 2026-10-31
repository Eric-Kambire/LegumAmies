#!/usr/bin/env bash
#
# LegumAmies - IDEMPOTENT redeploy to the EXISTING AWS environment.
#
# Unlike step3_deploy.sh (which CREATES resources with amplify create-app /
# apigatewayv2 create-api), this script ONLY UPDATES the existing resources.
# It never creates a new Amplify app, API Gateway, Lambda or Knowledge Base.
#
# Existing resources (us-east-1):
#   - Amplify app   : doxhuwpoc3ctn  (branch team-testing)
#   - API Gateway   : ba8yoci7d8     (URL preserved)
#   - Lambda        : legumamies-climateshield-api
#   - Lambda role   : legumamies-api-lambda-role
#   - Bedrock KB    : C5WRYFYF1O     (reused, NOT recreated)
#   - Model         : amazon.nova-lite-v1:0
#
# Auth: ambient IAM instance role. No secrets. Does NOT deploy the experimental
# PBC model (notebook/reports only; never part of the runtime).
set -euo pipefail

REGION="us-east-1"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

APP_ID="doxhuwpoc3ctn"
BRANCH="team-testing"
API_ID="ba8yoci7d8"
FN="legumamies-climateshield-api"
ROLE="legumamies-api-lambda-role"
KB_ID="C5WRYFYF1O"
MODEL="amazon.nova-lite-v1:0"
API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com"
FRONT_ORIGIN="https://${BRANCH}.${APP_ID}.amplifyapp.com"

echo "== 0. Preconditions: resources must already exist =="
aws lambda get-function --function-name "$FN" --region "$REGION" >/dev/null
aws apigatewayv2 get-api --api-id "$API_ID" --region "$REGION" >/dev/null
aws amplify get-app --app-id "$APP_ID" --region "$REGION" >/dev/null
echo "   OK: Lambda, API Gateway and Amplify app all exist."

echo "== 1. Backend: build Lambda package from current tree =="
rm -rf "$ROOT/build/lambda" && mkdir -p "$ROOT/build/lambda/pkg"
pip install --target "$ROOT/build/lambda/pkg" \
  --platform manylinux2014_x86_64 --implementation cp --python-version 3.12 \
  --only-binary=:all: -r "$ROOT/requirements-api.txt"
cp -r "$ROOT/src" "$ROOT/build/lambda/pkg/src"
mkdir -p "$ROOT/build/lambda/pkg/data/raw" && cp "$ROOT/data/raw/crop_rules.csv" "$ROOT/build/lambda/pkg/data/raw/"
find "$ROOT/build/lambda/pkg" -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
( cd "$ROOT/build/lambda/pkg" && rm -f ../function.zip && zip -r -q -X ../function.zip . )
echo "   package: $(du -h "$ROOT/build/lambda/function.zip" | cut -f1)"

echo "== 2. Least-privilege role policy (Bedrock Converse + KB Retrieve; logs via managed policy) =="
aws iam put-role-policy --role-name "$ROLE" \
  --policy-name legumamies-bedrock-kb-access \
  --policy-document "file://${ROOT}/infra/aws/lambda_bedrock_policy.json"

echo "== 3. UPDATE existing Lambda code + config (no create) =="
aws lambda update-function-code --function-name "$FN" --region "$REGION" \
  --zip-file "fileb://$ROOT/build/lambda/function.zip" >/dev/null
aws lambda wait function-updated --function-name "$FN" --region "$REGION"
aws lambda update-function-configuration --function-name "$FN" --region "$REGION" \
  --environment "Variables={LEGUMAMIES_CORS_ORIGINS=$FRONT_ORIGIN,LEGUMAMIES_ADVISOR_MODEL=$MODEL,LEGUMAMIES_KB_ID=$KB_ID}" >/dev/null
aws lambda wait function-updated --function-name "$FN" --region "$REGION"

echo "== 4. Protect the public LLM endpoint =="
# Bound parallel Bedrock calls (leaves >=100 unreserved on this account).
aws lambda put-function-concurrency --function-name "$FN" --region "$REGION" \
  --reserved-concurrent-executions 5 >/dev/null
# API Gateway stage throttling (rate/burst) on the existing $default stage.
aws apigatewayv2 update-stage --api-id "$API_ID" --stage-name '$default' --region "$REGION" \
  --default-route-settings 'ThrottlingRateLimit=5,ThrottlingBurstLimit=10,DetailedMetricsEnabled=true' >/dev/null

echo "== 5. Frontend: build with prod API base URL and deploy to EXISTING Amplify app =="
echo "VITE_API_BASE_URL=${API_URL}" > "$ROOT/frontend/.env.production"
( cd "$ROOT/frontend" && npm ci && npm run build )
( cd "$ROOT/frontend/dist" && rm -f /tmp/legume_dist.zip && zip -r -q /tmp/legume_dist.zip . )
DEP="$(aws amplify create-deployment --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION")"
JOB="$(echo "$DEP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["jobId"])')"
ZIP="$(echo "$DEP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["zipUploadUrl"])')"
curl -s -X PUT -H "Content-Type: application/zip" --upload-file /tmp/legume_dist.zip "$ZIP" -o /dev/null
aws amplify start-deployment --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB" --region "$REGION" >/dev/null

echo "== 6. Smoke test deployed endpoints =="
sleep 5
curl -s -o /dev/null -w "   /health %{http_code}\n" "${API_URL}/health"
curl -s -o /dev/null -w "   /meta   %{http_code}\n" "${API_URL}/meta"

echo "DONE. Frontend ${FRONT_ORIGIN} | API ${API_URL} (unchanged URLs)."
