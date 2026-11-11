#!/bin/bash
set -e

# ========================================================
# 🚀 Deployment script for Money Ledger
# Remote Host: ${DEPLOY_HOST:-your-server}
# Remote Dir: ${DEPLOY_DIR:-/opt/money-ledger}
# PM2 App Name: ${DEPLOY_APP_NAME:-money-ledger}
# Port: ${DEPLOY_PORT:-4010}
# ========================================================

REMOTE_USER="${DEPLOY_USER:-deploy}"
REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_DIR="${DEPLOY_DIR:-/opt/money-ledger}"
APP_NAME="${DEPLOY_APP_NAME:-money-ledger}"
PORT="${DEPLOY_PORT:-4010}"
NGINX_CONF_LOCAL="${DEPLOY_NGINX_CONF:-nginx/money-ledger.conf.example}"
NGINX_SITE_NAME="${DEPLOY_NGINX_SITE:-money-ledger}"

if [ -z "$REMOTE_HOST" ]; then
  echo "❌ Error: DEPLOY_HOST is required."
  echo "Usage: DEPLOY_HOST=your-server.com [DEPLOY_USER=deploy] [DEPLOY_DIR=/opt/money-ledger] ./deploy.sh"
  exit 1
fi

echo "📦 1. Preparing files for deployment..."

# Run local build & tests first to prevent broken deployments
if [ "${SKIP_TESTS:-0}" = "1" ]; then
  echo "⏭️ Skipping tests as requested."
else
  echo "🧪 Running tests locally..."
  npm test
fi

echo "🔄 2. Syncing source files to ${REMOTE_HOST}:${REMOTE_DIR}..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${REMOTE_DIR}"

rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env*.local' \
  --exclude 'npm-debug.log*' \
  --exclude '.DS_Store' \
  ./ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/

if [ -f "${NGINX_CONF_LOCAL}" ]; then
  echo "🌐 Updating Nginx receipt upload limit and config..."
  ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo -n install -m 644 ${REMOTE_DIR}/${NGINX_CONF_LOCAL} /etc/nginx/sites-available/${NGINX_SITE_NAME} && sudo -n nginx -t && sudo -n systemctl reload nginx" || true
fi

echo "🔒 Checking .env file on remote..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "if [ ! -f ${REMOTE_DIR}/.env ]; then
  echo '⚠️ Warning: .env not found on remote. Copying from .env.example (please configure it)...';
  cp ${REMOTE_DIR}/.env.example ${REMOTE_DIR}/.env;
fi"

echo "🔍 Validating required production settings..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_DIR} && chmod 600 .env && node scripts/validate-production-env.mjs"

echo "🖥️ 3. Building project & reloading PM2 process on ${REMOTE_HOST}..."
# A non-login shell avoids .bash_logout overriding a successful health check.
# The required npm-global PATH is set explicitly below.
ssh ${REMOTE_USER}@${REMOTE_HOST} "bash -c '
  set -e
  export PATH=\$HOME/.npm-global/bin:/usr/local/bin:\$PATH
  cd ${REMOTE_DIR}

  echo \"📥 Installing locked dependencies...\"
  npm ci

  echo \"⚙️ Generating Prisma Client...\"
  npx prisma generate

  echo \"🗄️ Applying additive club ledger tables...\"
  npx prisma db execute --file prisma/sql/club-ledger.sql

  echo \"🏗️ Building Next.js production bundle...\"
  NODE_OPTIONS=\"--max-old-space-size=2048\" npm run build

  echo \"🧹 Removing development-only packages from the production server...\"
  npm prune --omit=dev

  echo \"🚀 Starting/Reloading PM2 process [${APP_NAME}] on port ${PORT}...\"
  if pm2 describe ${APP_NAME} > /dev/null 2>&1; then
    echo \"🔄 Reloading existing PM2 process...\"
    pm2 reload ${APP_NAME}
  else
    echo \"▶️ Starting new PM2 process...\"
    pm2 start npm --name \"${APP_NAME}\" -- run start
  fi

  echo \"💾 Saving PM2 process list...\"
  pm2 save

  echo \"🩺 Checking the live health endpoint...\"
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS http://127.0.0.1:${PORT}/api/health > /dev/null; then
      echo \"✅ Health check passed.\"
      exit 0
    fi
    sleep 2
  done
  echo \"❌ Health check failed after reload.\"
  exit 1
'"

echo "✅ Deployment of ${APP_NAME} completed successfully!"
