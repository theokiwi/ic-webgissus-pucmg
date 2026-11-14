# Imagem de produção do front (Angular SSR + proxy /api e /tiles). Contexto: raiz do repositório.
#   docker build --network host -f apps/web/Dockerfile --build-arg PUBLIC_URL=https://exemplo.org -t webgissus-web .
FROM node:22-bookworm-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile --filter web...
COPY packages/domain packages/domain
COPY apps/web apps/web
# As páginas prerenderizadas (/sobre, /privacidade) gravam PUBLIC_URL em og:url/og:image no build.
ARG PUBLIC_URL=http://localhost:4200
ENV PUBLIC_URL=$PUBLIC_URL
RUN pnpm --filter web build \
 && pnpm --filter web deploy --legacy --prod /out \
 && cp -r apps/web/dist /out/dist

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=4000 API_URL=http://api:3000
WORKDIR /app
COPY --from=build --chown=node:node /out/ ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD node -e "fetch('http://127.0.0.1:4000/manifest.webmanifest').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/web/server/server.mjs"]
