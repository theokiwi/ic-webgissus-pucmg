# 0001 · Stack, monorepo e distribuição como PWA

**Status:** aceito · 2026-11-14

## Contexto
MVP de IC (FAPEMIG) que precisa rodar bem em celular e desktop, ser verificável e crescer para produção. A referência (`docs/BREsquerda`) é um site estático com Leaflet e JSON pré-calculado; não atende "perto de mim", rotas nem atualização mensal.

## Decisão
- Monorepo com **pnpm workspaces**: `apps/web`, `apps/api`, `packages/*`, `pipelines/`.
- Front: **Angular 22** (standalone, signals, zoneless) com **SSR** — necessário para as tags Open Graph de cada página compartilhada (WhatsApp/Facebook não executam JS).
- Mapa: **MapLibre GL JS** + vector tiles em **PMTiles** (malhas e setores) e basemap derivado do OSM. Não usar os servidores de tile do OSM em produção (política de uso).
- API: **NestJS 12** (ESM) sobre **PostgreSQL + PostGIS**.
- Rotas: **Valhalla** auto-hospedado com recorte OSM do Sudeste (fase 5).
- Distribuição **somente via site, como PWA** instalável. Sem lojas de app (Capacitor descartado).

## Consequências
- SSR obriga a evitar acesso direto a `window`/`navigator` fora do browser (usar `isPlatformBrowser`/`afterNextRender`).
- PWA exige HTTPS em produção (também exigido por geolocalização e Web Share).
- Um único código de UI; responsividade é requisito de toda feature, verificada com Playwright em viewport de celular.
