FROM gcr.io/distroless/base-debian13:nonroot

WORKDIR /app

COPY dist/apps/api/server /app/server

ENV NODE_ENV=production \
	PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/server"]
