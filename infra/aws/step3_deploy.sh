#!/usr/bin/env bash
#
# LegumAmies — Step 3: integration deployment (frontend FIRST, then backend).
#
# Deploys:
#   - Frontend PWA (Vite build) to AWS Amplify Hosting (manual zip, HTTPS).
#   - Backend FastAPI (ClimateShield) to AWS Lambda behind an API Gateway
#     HTTP API. (Lambda Function URL with auth NONE is blocked by an account
#     guardrail in this temporary account, so API Gateway is used.)
#
# Auth: ambient IAM instance role only. No static credentials, no secrets.
# Cost: within AWS Free Tier (Amplify + Lambda + API Gateway) ~ $0 for testing.
#
# Idempotency is partial; intended as a readable record of the exact steps.
set -euo pipefail
REGION="us-east-1"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ----------------------------------------------------------------------------
# 1. FRONTEND FIRST — Amplify Hosting (does not wait for the backend)
# ----------------------------------------------------------------------------
echo "== Frontend build =="
( cd "$ROOT/frontend" && npm ci && npm run build )   # outputs frontend/dist

echo "== Amplify app + branch =="
APP_ID="$(aws amplify create-app --name legumamies-pwa --platform WEB --region "$REGION" \
  --custom-rules '[{"source":"/<*>","target":"/index.html","status":"404-200"}]' \
  --query 'app.appId' --output text)"
aws amplify create-branch --app-id "$APP_ID" --branch-name team-testing --region "$REGION" >/dev/null

echo "== Deploy dist (manual zip, no GitHub OAuth) =="
( cd "$ROOT/frontend/dist" && rm -f /tmp/dist.zip && zip -r -q /tmp/dist.zip . )
DEP="$(aws amplify create-deployment --app-id "$APP_ID" --branch-name team-testing --region "$REGION")"
JOB="$(echo "$DEP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["jobId"])')"
ZIP="$(echo "$DEP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["zipUploadUrl"])')"
curl -s -X PUT -H "Content-Type: application/zip" --upload-file /tmp/dist.zip "$ZIP" -o /dev/null
aws amplify start-deployment --app-id "$APP_ID" --branch-name team-testing --job-id "$JOB" --region "$REGION" >/dev/null
DOMAIN="$(aws amplify get-app --app-id "$APP_ID" --region "$REGION" --query 'app.defaultDomain' --output text)"
echo "FRONTEND URL: https://team-testing.${DOMAIN}"

# ----------------------------------------------------------------------------
# 2. BACKEND — Lambda (package) + API Gateway HTTP API
# ----------------------------------------------------------------------------
echo "== Build Lambda package (Linux wheels) =="
rm -rf "$ROOT/build/lambda" && mkdir -p "$ROOT/build/lambda/pkg"
pip install --target "$ROOT/build/lambda/pkg" \
  --platform manylinux2014_x86_64 --implementation cp --python-version 3.12 \
  --only-binary=:all: fastapi mangum "pydantic>=2" requests pandas numpy
cp -r "$ROOT/src" "$ROOT/build/lambda/pkg/src"
mkdir -p "$ROOT/build/lambda/pkg/data/raw" && cp "$ROOT/data/raw/crop_rules.csv" "$ROOT/build/lambda/pkg/data/raw/"
find "$ROOT/build/lambda/pkg" -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
( cd "$ROOT/build/lambda/pkg" && rm -f ../function.zip && zip -r -q -X ../function.zip . )

echo "== Lambda execution role =="
aws iam create-role --role-name legumamies-api-lambda-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null 2>&1 || true
aws iam attach-role-policy --role-name legumamies-api-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null 2>&1 || true
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/legumamies-api-lambda-role"
sleep 10

echo "== Create/Update Lambda =="
FN="legumamies-climateshield-api"
FRONT_ORIGIN="https://team-testing.${DOMAIN}"
if aws lambda get-function --function-name "$FN" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FN" --region "$REGION" \
    --zip-file "fileb://$ROOT/build/lambda/function.zip" >/dev/null
else
  aws lambda create-function --function-name "$FN" --region "$REGION" \
    --runtime python3.12 --handler src.api.main.handler --role "$ROLE_ARN" \
    --timeout 30 --memory-size 1024 \
    --environment "Variables={LEGUMAMIES_CORS_ORIGINS=$FRONT_ORIGIN}" \
    --zip-file "fileb://$ROOT/build/lambda/function.zip" >/dev/null
fi
aws lambda wait function-active --function-name "$FN" --region "$REGION"
FN_ARN="$(aws lambda get-function --function-name "$FN" --region "$REGION" --query 'Configuration.FunctionArn' --output text)"

echo "== API Gateway HTTP API =="
API_ID="$(aws apigatewayv2 create-api --name legumamies-api --protocol-type HTTP \
  --target "$FN_ARN" --region "$REGION" \
  --cors-configuration "AllowOrigins=$FRONT_ORIGIN,http://localhost:5173,AllowMethods=GET,POST,OPTIONS,AllowHeaders=content-type" \
  --query 'ApiId' --output text)"
aws lambda add-permission --function-name "$FN" --region "$REGION" \
  --statement-id apigw-invoke --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" >/dev/null 2>&1 || true
API_ENDPOINT="$(aws apigatewayv2 get-api --api-id "$API_ID" --region "$REGION" --query 'ApiEndpoint' --output text)"
echo "BACKEND URL: ${API_ENDPOINT}"

# ----------------------------------------------------------------------------
# 3. WIRE frontend -> backend and redeploy frontend
# ----------------------------------------------------------------------------
echo "VITE_API_BASE_URL=${API_ENDPOINT}" > "$ROOT/frontend/.env.production"
( cd "$ROOT/frontend" && npm run build )
( cd "$ROOT/frontend/dist" && rm -f /tmp/dist.zip && zip -r -q /tmp/dist.zip . )
DEP2="$(aws amplify create-deployment --app-id "$APP_ID" --branch-name team-testing --region "$REGION")"
JOB2="$(echo "$DEP2" | python3 -c 'import sys,json;print(json.load(sys.stdin)["jobId"])')"
ZIP2="$(echo "$DEP2" | python3 -c 'import sys,json;print(json.load(sys.stdin)["zipUploadUrl"])')"
curl -s -X PUT -H "Content-Type: application/zip" --upload-file /tmp/dist.zip "$ZIP2" -o /dev/null
aws amplify start-deployment --app-id "$APP_ID" --branch-name team-testing --job-id "$JOB2" --region "$REGION" >/dev/null

echo "DONE. Frontend https://team-testing.${DOMAIN}  |  Backend ${API_ENDPOINT}"
