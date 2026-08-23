FROM oven/bun:1.3.14-slim AS base

FROM base AS deps

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/
COPY libs/shared-types/package.json libs/shared-types/
COPY libs/split-logic/package.json libs/split-logic/
COPY apps/web/package.json apps/web/

RUN bun ci --production --filter '@repo/api'

FROM base AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/api/scripts apps/api/scripts
COPY libs/shared-types/package.json libs/shared-types/
COPY libs/shared-types/src libs/shared-types/src
COPY libs/split-logic/package.json libs/split-logic/
COPY libs/split-logic/src libs/split-logic/src

ENV NODE_ENV=production

RUN sh apps/api/scripts/compile.sh bun server

FROM gcr.io/distroless/base-debian13:nonroot AS runtime

WORKDIR /app

ENV NODE_ENV=production \
	PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/server"]

FROM runtime AS hermetic

COPY --from=build /app/server /app/server

FROM runtime AS prebuilt

ARG TARGETARCH

COPY dist/apps/api-linux/${TARGETARCH}/server /app/server
