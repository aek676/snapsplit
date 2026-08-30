#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_SSH_HOST:?DEPLOY_SSH_HOST is required}"
: "${DEPLOY_SSH_USER:?DEPLOY_SSH_USER is required}"

DEST="${DEPLOY_PATH:-/opt/apps/snapsplit}"

echo "Syncing scaffold to $DEPLOY_SSH_USER@$DEPLOY_SSH_HOST:$DEST"
ssh -o BatchMode=yes "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST" "mkdir -p $DEST"
scp -o BatchMode=yes apps/api/deploy/compose.yaml apps/api/deploy/deploy-on-host.sh apps/api/deploy/ssh-wrapper.sh apps/api/deploy/.env.example "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST:$DEST/"
ssh -o BatchMode=yes "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST" "chmod +x $DEST/deploy-on-host.sh $DEST/ssh-wrapper.sh; chown -R deployer:deployer $DEST 2>/dev/null || chown -R \$USER:\$USER $DEST || true; ls -l $DEST"
