# 0010 · Pesquisa de unidades por tipo e por indicador do município

**Status:** aceito · 2026-11-25

## Contexto
Anotação do autor: "localiza os pontos de saúde com densidade demográfica abaixo de tanto ou acima de tanto, pra ver onde tem posto de saúde com pouco ou com muita gente. Mostra todos os postos de saúde com essa característica no mapa."

Até aqui o mapa só mostrava pontos dentro de um município (ou "perto de"), e as categorias agrupam vários tipos do CNES: "posto de saúde" (TP_UNIDADE 01, 697 unidades em 2026-09) fica na categoria Atenção básica junto com "Centro de saúde/Unidade básica" (02, 5.538).

O banco tem quatro indicadores por município (os temas do coroplético): população, densidade demográfica, estabelecimentos por 10 mil habitantes e total de estabelecimentos. A densidade por setor censitário existe só nos tiles do mapa, não no PostGIS.

## Decisão (do autor)
- **O que se pesquisa:** um **tipo de unidade do CNES** (TP_UNIDADE), não a categoria do mapa.
- **Critério:** um dos quatro **indicadores do município onde a unidade fica**. Setor censitário fica fora por ora (exigiria levar os setores ao banco e um join espacial no ETL).
- **Corte:** faixa livre ("a partir de" e "menos de", ambos opcionais) **e** as classes da legenda do tema como atalho que preenche a faixa.
- **Onde:** no painel de MG, com o resultado em pontos no mapa (MG inteiro, ou só a macrorregião / região de saúde escolhida nos filtros avançados), contagem e lista.

## Decisões técnicas
- **Semântica da faixa:** mínimo inclusivo, máximo exclusivo, a mesma leitura das classes da legenda ("X a menos de Y"). Assim, clicar numa classe traz exatamente os municípios daquela cor. Sem nenhum limite, entra todo o tipo, inclusive em município sem dado. Com algum limite, município sem dado fica de fora. A regra está em `packages/domain/src/pesquisa.ts` (com testes) e é repetida no SQL da API, porque a API não carrega o pacote `domain` em runtime (ele exporta `.ts`). Os testes e2e cobrem as bordas.
- **O critério é o tema.** Trocar o critério troca a cor do mapa e vice-versa. A faixa é descartada ao trocar de tema, porque a unidade muda.
- **API:**
  - `GET /api/estabelecimentos/tipos` devolve os tipos presentes na carga, com descrição, categoria e total em MG.
  - `GET /api/estabelecimentos/pesquisa?tipo=&criterio=&min=&max=&macro=&regiao=` devolve um GeoJSON com município e valor do critério em cada ponto, ordenado pelo valor (maior primeiro).
  - O resultado vem inteiro, sem limite. O maior tipo (02) tem cerca de 5,5 mil pontos, 1,9 MB sem compressão, e responde em cerca de 40 ms no banco local. A lista do painel mostra os 100 primeiros. O mapa mostra todos, agrupados em clusters.
- **URL:** `?tipo=1&min=…&max=…` nas visões `/`, `/macro/…` e `/regiao/…`, ao lado de `tema=`. Fechar a ficha aberta a partir do resultado volta à pesquisa.
- Com a pesquisa ativa, o coroplético fica mais claro (opacidade 0,45) para os pontos se destacarem. O mapa enquadra o resultado.

## Consequências
- O front passa a conhecer códigos TP_UNIDADE, que antes ficavam só no ETL (`pipelines/etl/classificacao.py`). Ele os recebe da API, com descrição, e não mantém lista própria.
- Pesquisar por densidade do setor censitário (separar, dentro do mesmo município, o posto do centro do posto rural) continua possível no futuro, com um novo critério e uma tabela de setores no banco.
