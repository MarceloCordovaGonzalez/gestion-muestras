# Imagen de la API para Cloud Run (construir desde la raíz del monorepo):
#   docker build -f apps/api/Dockerfile -t gm-api .
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @gm/api...
COPY packages/domain packages/domain
COPY apps/api apps/api
RUN pnpm --filter @gm/domain build \
 && pnpm --filter @gm/api build \
 && pnpm --filter @gm/api deploy --prod --legacy /out \
 && cd /out && node node_modules/prisma/build/index.js generate

FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
ENV NODE_ENV=production TZ=UTC
COPY --from=build /out /app
EXPOSE 8080
CMD ["dist/main.js"]
