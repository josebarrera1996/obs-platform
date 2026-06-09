#!/bin/bash
# ── ObsPlatform Deploy Script ──
# Builds, tags, and deploys the app to AWS ECS via Terraform.
#
# Usage:
#   ./scripts/deploy.sh <environment> [tag]
#
# Examples:
#   ./scripts/deploy.sh staging    # deploy staging with git commit hash
#   ./scripts/deploy.sh production v1.2.3  # deploy production with specific tag

set -euo pipefail

APP_NAME="obs-platform"
ENVIRONMENT="${1:-staging}"
TAG="${2:-$(git rev-parse --short HEAD)}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO="${ECR_REPO:-${APP_NAME}/app}"

echo "━━━ ObsPlatform Deploy ━━━"
echo "  Environment: ${ENVIRONMENT}"
echo "  Tag:         ${TAG}"
echo "  Region:      ${AWS_REGION}"
echo ""

# ── 1. Lint & Test ──
echo "→ Running lint..."
npm run lint

echo "→ Running typecheck..."
npm run typecheck

echo "→ Running unit tests..."
npm test

# ── 2. Build Docker image ──
echo "→ Building Docker image..."
docker build \
  --platform linux/amd64 \
  -t "${APP_NAME}:${TAG}" \
  -t "${ECR_REPO}:${TAG}" \
  .

# ── 3. Push to ECR (if configured) ──
if [[ -n "${ECR_REGISTRY:-}" ]]; then
  echo "→ Authenticating with ECR..."
  aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin "${ECR_REGISTRY}"

  FULL_TAG="${ECR_REGISTRY}/${ECR_REPO}:${TAG}"
  echo "→ Tagging image..."
  docker tag "${APP_NAME}:${TAG}" "${FULL_TAG}"
  echo "→ Pushing to ECR..."
  docker push "${FULL_TAG}"
else
  echo "⚠️  ECR_REGISTRY not set — skipping image push."
  echo "   Set ECR_REGISTRY environment variable to enable push."
fi

# ── 4. Deploy with Terraform ──
if [[ -d "infra/terraform" ]]; then
  echo "→ Deploying with Terraform..."
  cd infra/terraform

  terraform init
  terraform workspace select "${ENVIRONMENT}" 2>/dev/null || terraform workspace new "${ENVIRONMENT}"

  terraform apply \
    -var="environment=${ENVIRONMENT}" \
    -var="container_tag=${TAG}" \
    -auto-approve

  cd ../..
else
  echo "⚠️  infra/terraform not found — skipping Terraform deploy."
fi

# ── 5. Force new deployment (if using ECS) ──
if command -v aws &>/dev/null; then
  CLUSTER_NAME="${APP_NAME}-cluster"
  SERVICE_NAME="${APP_NAME}"

  if aws ecs describe-clusters --clusters "${CLUSTER_NAME}" --region "${AWS_REGION}" --query 'clusters[0].clusterName' --output text 2>/dev/null | grep -q "${CLUSTER_NAME}"; then
    echo "→ Forcing new ECS deployment..."
    aws ecs update-service \
      --cluster "${CLUSTER_NAME}" \
      --service "${SERVICE_NAME}" \
      --force-new-deployment \
      --region "${AWS_REGION}"
  fi
fi

echo ""
echo "✅ Deploy complete: ${ENVIRONMENT} @ ${TAG}"