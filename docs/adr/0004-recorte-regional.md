# 0004 · Recorte regional pelas regiões de saúde

**Status:** aceito · 2026-11-14

## Contexto
Com só MG, o seletor "Estado" da referência perde sentido e um seletor com 853 municípios é ruim de usar. O SUS-MG organiza o encaminhamento por regiões e macrorregiões de saúde (PDR/SES-MG), que é a divisão relevante para o tema.

## Decisão
- Navegação **Macrorregião → Região de saúde → Município**.
- Fonte: base territorial DATASUS (`tb_regsaud`, `tb_macsaud`, `rl_municip_regsaud`, `rl_municip_macsaud`), competência registrada no ETL.
- Spike (base de jun/2026): **16 macrorregiões, 89 regiões de saúde**, 853 municípios, todos com região e macro, todos com par na malha IBGE 2024 via `CO_MUNICDV`.
- Não usar `tbEstabelecimento.CO_REGIAO_SAUDE` (185 códigos distintos em MG — inconsistente).

## Consequências
- Geometrias de região/macro são geradas por dissolve da malha municipal no ETL.
- Se a SES-MG publicar ajuste do PDR, basta atualizar a base territorial.
