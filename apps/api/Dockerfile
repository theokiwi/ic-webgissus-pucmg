# Imagem de produção da API (contexto de build: raiz do repositório).
#   docker build --network host -f apps/api/Dockerfile -t webgissus-api .
FROM node:22-bookworm-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile --filter api...
COPY packages/domain packages/domain
COPY apps/api apps/api
RUN pnpm --filter api build \
 && pnpm --filter api deploy --legacy --prod /out

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000 TILES_DIR=/data/tiles
WORKDIR /app
COPY --from=build --chown=node:node /out/ ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
