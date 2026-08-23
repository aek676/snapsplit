#!/usr/bin/env sh
set -eu

exec bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--target "$1" \
	--outfile "$2" \
	apps/api/src/index.ts
