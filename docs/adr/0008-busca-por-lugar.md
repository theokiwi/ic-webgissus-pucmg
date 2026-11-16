# 0008 · Busca por município, bairro ou endereço; regiões de saúde viram filtro avançado

**Status:** aceito · 2026-11-16 · substitui em parte o [0004](0004-recorte-regional.md) (a navegação; a fonte das regiões continua valendo)

## Contexto
A navegação Macrorregião → Região de saúde → Município (ADR 0004) faz sentido para a gestão do SUS, mas não para o cidadão, que não sabe a que região pertence. O que ele sabe é o município e o bairro onde está.

Antes de decidir a fonte de bairros, avaliamos três opções (CNES 2026-09, setores IBGE 2022):

| Fonte | Cobertura | Problema |
|---|---|---|
| `NO_BAIRRO` do CNES | todas as unidades | texto livre e sujo ("SANTA EFIGENIA", "STA EFIGENIA", "SANTA EFIGENCIA"), cortado em 20 caracteres; 38% das unidades estão em "CENTRO"; só lista bairros que têm alguma unidade |
| `NM_BAIRRO` dos setores censitários IBGE 2022 | 55 de 853 municípios | polígono oficial, mas faltam Contagem, Montes Claros, Ribeirão das Neves, Divinópolis e Sete Lagoas |
| Geocodificador OSM (Photon) | MG inteira, inclusive ruas e endereços | serviço externo |

## Decisão (do autor)
- **Busca única "Município, bairro ou endereço"** no painel de MG e no painel do município.
  - Município: casado no navegador, sobre a lista já carregada (prefixo antes de "contém", sem acento). Abre o painel do município.
  - Bairro, rua ou endereço: geocodificador. Abre "Perto de <lugar>", reaproveitando o "Perto de mim" a partir daquele ponto (mesmos raios e categorias).
- **Macrorregião e região de saúde** saem da navegação principal e ficam em "Filtros avançados", recolhido, no painel de MG. As rotas `/macro/…` e `/regiao/…` continuam.
- O `<select>` de município sai: a busca o substitui.

## Decisões técnicas
- **Photon** (`photon.komoot.io`, dados do OpenStreetMap), porque aceita busca enquanto se digita. O Nominatim público proíbe autocompletar.
- **Chamada pelo servidor** (`GET /api/lugares?q=&limite=5`): o IP de quem pesquisa não chega ao serviço externo. Há `User-Agent` do projeto, timeout de 5 s e `Cache-Control: s-maxage=86400`, para que a CDN da Vercel absorva termos repetidos.
- A caixa de MG enviada ao Photon só prioriza resultados. O filtro de verdade fica na API: `state = Minas Gerais` e o envelope de MG. Estado, país e região imediata são descartados, e o mesmo lugar não se repete (nó e polígono do OSM).
- `GEOCODER_URL` permite trocar por um Photon próprio, se o uso crescer.
- A URL de "perto" ganha `onde=<nome>`, só para o título. GPS e toque no mapa não têm nome.

## Consequências
- O texto digitado (não a posição) passa por um terceiro. A página de Privacidade foi atualizada.
- Sem o Photon, a busca de município continua funcionando (é local), e a de bairro mostra um aviso.
- A qualidade dos bairros depende do OSM: é boa nas cidades médias e grandes de MG e irregular em distritos pequenos.
