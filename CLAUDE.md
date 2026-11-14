# WebGIS SUS-MG

Mapa web (PWA, desktop e celular) dos estabelecimentos de saúde **acessíveis gratuitamente pelo SUS** em Minas Gerais, com indicadores por município (IBGE), setores censitários, "perto de mim", rotas e compartilhamento. Projeto de Iniciação Científica (FAPEMIG). Referência visual e de features: `docs/BREsquerda/` (só leitura, não é código do projeto).

Decisões de arquitetura e de escopo ficam em `docs/adr/`. Leia antes de propor mudanças de stack ou de regra de dados.

## Layout

```
apps/web/          Angular 22 (SSR, standalone, zoneless) — mapa e UI
apps/api/          NestJS 12 (ESM) — API REST sobre o PostGIS
packages/domain/   regras puras em TS compartilhadas (categorias, textos, indicadores)
pipelines/         ETL Python, sempre executado em Docker (pipelines/run.sh)
  etl/             código de produção do ETL
  spike/           scripts exploratórios descartáveis
  tests/           pytest
infra/             docker-compose (PostGIS; Valhalla depois)
data/              raw/ interim/ processed/ — NUNCA versionados
docs/adr/          decisões;  docs/spike/  relatórios exploratórios
```

## Comandos

Ambiente NixOS: `pnpm` vem do shim do corepack em `~/.local/bin` (se faltar: `corepack enable --install-directory ~/.local/bin pnpm`). Python só via Docker.

```
pnpm install
pnpm test | lint | build | typecheck
pnpm dev:web                     # http://localhost:4200
pnpm dev:api                     # http://localhost:3000
pnpm db:up / db:down             # PostGIS em 127.0.0.1:5432
pipelines/run.sh spike/explorar_cnes.py 202609   # roda script Python no container
pipelines/test.sh                                # pytest dos pipelines
```

Docker usa `--network host` (o DNS do NixOS não chega à rede bridge).

## Regras de dados (fáceis de errar)

- MG = UF `31`. Município de **localização** = 6 primeiros dígitos de `CO_UNIDADE`, não `CO_MUNICIPIO_GESTOR`.
- DATASUS usa código de município com 6 dígitos; IBGE usa 7. Converter via `tb_municip.CO_MUNICDV` (base territorial DATASUS), nunca truncando para comparar com dados de outras fontes sem conferir.
- Universo = ativo (`CO_MOTIVO_DESAB` vazio) **e** atende SUS (`rlEstabAtendPrestConv.CO_CONVENIO = '01'`) **e** tipo de unidade visitável pelo cidadão (ADR 0003).
- Regiões de saúde: usar a base territorial DATASUS (`rl_municip_regsaud`, `rl_municip_macsaud`), não `tbEstabelecimento.CO_REGIAO_SAUDE` (inconsistente: 185 códigos para 89 regiões).
- Horário: `tbEstabHorarioAtend` cobre unidades de horário comercial; unidades 24h vêm de `TP_ESTAB_SEMPRE_ABERTO = 'S'` e quase nunca têm linhas de horário. Usar os dois.
- CSVs do CNES: `;`, latin-1, tudo entre aspas. Base territorial: UTF-8, delimitador varia por arquivo.
- Dados são versionados pela competência `AAAAMM` do CNES.

## Convenções

- **Este projeto não usa `TODO(human)`** (é uma IC sobre desenvolvimento com IA; sobrepõe a regra global do autor). O agente escreve todo o código.
- **Regras de negócio são decididas pelo autor, nunca pelo agente.** O agente codifica exatamente o que foi decidido (ADRs) e, quando faltar uma definição, pergunta antes — não inventa regra nem "default razoável". Decisões técnicas (estrutura de código, bibliotecas, onde guardar uma tabela) o agente toma e registra.
- Regra de negócio fica em `pipelines/etl/` (classificação, filtros do universo, joins) e `packages/domain/` (lógica pura usada pelo front/API), sempre com testes.
- Nest e o pacote `domain` são ESM: imports relativos terminam em `.js`.
- Nomes de domínio em português (estabelecimento, municipio, competencia); termos técnicos em inglês quando forem do framework.
- Nunca commitar dados (`data/`, `*.pmtiles`) nem `.env`.
