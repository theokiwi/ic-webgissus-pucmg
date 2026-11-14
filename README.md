# ic-webgissus-pucmg

WebGIS dos estabelecimentos de saúde acessíveis pelo SUS em Minas Gerais — projeto de Iniciação Científica (FAPEMIG).

- Arquitetura e decisões: [docs/adr/](docs/adr/)
- Exploração dos dados do CNES: [docs/spike/](docs/spike/)
- Guia para desenvolvimento (inclusive com agentes): [CLAUDE.md](CLAUDE.md)

## Começar

```
pnpm install
pnpm db:up
pnpm dev:web     # http://localhost:4200
pnpm dev:api     # http://localhost:3000
pipelines/test.sh
```

Fontes: CNES/DATASUS, base territorial DATASUS, IBGE (malhas e Censo 2022), OpenStreetMap (ODbL), Overture Maps.
