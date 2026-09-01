#!/usr/bin/env sh
set -eu

: "${GITHUB_REPOSITORY:?expected <owner>/<repo>, the image is named after it}"
: "${GITHUB_SHA:?expected the commit being published, it becomes the rollback tag}"

image="ghcr.io/$(printf '%s' "$GITHUB_REPOSITORY" | tr '[:upper:]' '[:lower:]')-api"

set -- --tag "$image:sha-$(printf '%.7s' "$GITHUB_SHA")"
if [ "${GITHUB_REF_NAME:-}" = main ]; then
	set -- "$@" --tag "$image:latest"
fi

exec docker buildx build \
	--file apps/api/Dockerfile \
	--target prebuilt \
	--platform linux/amd64,linux/arm64 \
	"$@" \
	--label "org.opencontainers.image.source=https://github.com/$GITHUB_REPOSITORY" \
	--label "org.opencontainers.image.revision=$GITHUB_SHA" \
	--push \
	.
