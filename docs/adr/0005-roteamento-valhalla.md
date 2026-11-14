# 0005 — Roteamento com Valhalla auto-hospedado e recorte OSM de MG

Status: Aceito

## Contexto

O mapa precisa de rotas (carro, a pé, bicicleta) até o estabelecimento, com instruções em português (Fase 5). A API (`apps/api/src/rota/`) já faz proxy para um servidor Valhalla via `VALHALLA_URL`. Serviços públicos de roteamento têm limite de uso e termos que não servem a um produto aberto; auto-hospedar mantém o custo previsível (ADR 0001).

## Decisão

- **Motor:** Valhalla 3.9.1, imagem `ghcr.io/valhalla/valhalla-scripted:3.9.1` (versão fixa). Escolhido por ter instruções `pt-BR`, perfis auto/pedestrian/bicycle e tiles pré-compilados (inicialização rápida, sem processar PBF a cada subida).
- **Dados:** extrato OSM do Sudeste da Geofabrik (`south-america/brazil/sudeste-latest.osm.pbf`, MD5 conferido), recortado com `osmium extract` (`iboates/osmium:1.19.0`) por **bbox** `-51.35,-23.23,-39.55,-13.93` (MG com margem de 0,3 grau, ~30 km). Bbox em vez de polígono da malha IBGE: mais simples, sem dependência de GDAL e robusto; o custo é incluir partes de SP/RJ/ES (o recorte fica em ~75% do extrato).
- **Operação:** `pnpm rotas:preparar` (idempotente; `--forcar` refaz tudo) gera `data/processed/valhalla/valhalla_tiles.tar`; `pnpm rotas:up` sobe o serviço `valhalla` do compose (perfil `rotas`, `127.0.0.1:8002`, sem rebuild: `use_tiles_ignore_pbf=True`); `pnpm rotas:down` para.
- Build limitado a 4 GB de RAM e 4 threads (máquina de desenvolvimento compartilhada).

## Consequências

Medido em 2026-11 (extrato de 2026-11-13):

| Item | Valor |
|---|---|
| Extrato Sudeste | 824 MB |
| Recorte MG + 30 km | 631 MB |
| Tiles (`valhalla_tiles.tar`) | ~900 MB (+ admins.sqlite 8 MB) |
| Tempo total do `preparar.sh` | ~4 min (≈1,5 min de download em rede boa; ≈1 min de recorte; ≈2 min de tiles) |
| Memória | build dentro do limite de 4 GB; servidor com `mem_limit: 2g` |

- Sem fuso horário nem elevação: rotas sem estimativa por horário e sem relevo (bicicleta/pedestre ignoram declive). Pode ser adicionado depois (`build_time_zones`, `build_elevation`) ao custo de rebuild e download extra.
- Sem trânsito em tempo real nem transporte público: duração de carro é estimativa por velocidade de via.
- O OSM em MG tem lacunas em áreas rurais; rotas podem contornar vias não mapeadas.
- Disco: ~2,3 GB entre extrato, recorte e tiles (nada disso é versionado, ver `data/`).
- **Atualização mensal:** rodar `pnpm rotas:preparar --forcar` (baixa novo extrato, recorta e regenera tiles) e depois `pnpm rotas:down && pnpm rotas:up`. Não é preciso acompanhar a competência do CNES; o OSM é independente.
- Em produção o serviço precisa de ~2 GB de RAM dedicados e deve ficar atrás da API (não exposto publicamente).
