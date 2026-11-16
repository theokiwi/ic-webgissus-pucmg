# 0009 · Links de divulgação, contagem anônima de acessos e selo de transparência

**Status:** aceito · 2026-11-16

## Contexto
Ideias rápidas do MVP (anotações do autor):

1. Busca por proximidade sem atrito: GPS ou município/endereço digitado, sem histórico de localização, com distância e categoria.
2. Botão de compartilhamento direto, para o estabelecimento e para o mapa.
3. Links com parâmetros diferentes por canal (Instagram, WhatsApp, cartazes), para saber **exatamente** de onde vieram os acessos.
4. Selo de transparência dos dados: fonte e data de atualização, para não frustrar o cidadão que encontra o local fechado ou sem atendimento.

Os itens 1 e 2 já existiam ("Perto de mim", ADR 0008 e botão Compartilhar). O que faltava:

- os links compartilhados levavam `utm_*`, mas **nada contava os acessos**;
- Instagram e cartazes não têm botão de compartilhar, então precisam de links prontos;
- a ficha mostrava só uma nota com a competência. A data em que a própria unidade atualizou o cadastro (`DT_ATUALIZACAO` do CNES) já estava no banco e na API, mas não aparecia.

Distribuição dessa data na competência 2026-09 (14.095 unidades): 51% atualizadas nos últimos 6 meses, 17% entre 6 e 12 meses, 22% entre 1 e 2 anos e 10% há mais de 2 anos.

## Decisão (do autor)
- **Contador próprio e anônimo.** Quando o site abre com `utm_source`, o navegador avisa a API uma vez, e a API soma +1 numa tabela diária `(dia, origem, meio, campanha)`. Não guardamos IP, cookie, identificador, página nem posição.
- **Atalhos fixos e QR para divulgação:**

  | Atalho | Destino |
  |---|---|
  | `/insta` | `/?utm_source=instagram&utm_medium=social&utm_campaign=divulgacao` |
  | `/whats` | `/?utm_source=whatsapp&utm_medium=social&utm_campaign=divulgacao` |
  | `/cartaz` | `/?utm_source=cartaz&utm_medium=impresso&utm_campaign=divulgacao` |

  O QR do `/cartaz` é gerado em SVG para impressão. O compartilhamento feito pelo cidadão continua com `utm_campaign=compartilhar`, o que separa a divulgação da equipe do compartilhamento orgânico.
- **Selo de transparência na ficha:** fonte (CNES/DATASUS, Ministério da Saúde), competência, data em que a unidade atualizou o cadastro, data de publicação no mapa e link para a ficha oficial no CNES.
- **Alerta de cadastro antigo** quando a última atualização da unidade tiver **mais de 24 meses** em relação à competência exibida (contados em meses: competência 2026-09 alerta a partir de 2024-08). Sem data, não há alerta; o selo mostra "não informada".

## Decisões técnicas
- Tabela `acesso_diario` em `infra/db/002_acessos.sql`. Ela **não** pertence ao ETL: `banco:publicar` a exclui do `pg_dump --clean` (senão cada publicação zeraria as contagens do Neon) e garante que ela exista no destino.
- `POST /api/acessos` (`{origem, meio, campanha}`, cada valor `[a-z0-9_-]{1,40}`, sem lista fechada para permitir campanhas novas) responde 204. `GET /api/acessos?dias=30` devolve os totais agregados por dia.
- O dia é contado no fuso de Brasília.
- O front conta na primeira navegação concluída (já depois do redirecionamento do atalho, inclusive quando o service worker do PWA atende a navegação). Um marcador em `sessionStorage` evita contar de novo quando a mesma aba recarrega a página.
- Os atalhos são rotas do Angular com `redirectTo`. Assim funcionam no SSR (302) e no PWA offline.
- Link oficial: `https://cnes.datasus.gov.br/pages/estabelecimentos/ficha/index.jsp?coUnidade=<cd6><cnes>`. `CO_UNIDADE` = código DATASUS (6 dígitos) do município de localização + CNES, e `municipio.cd6` vem desse mesmo prefixo na carga.

## Consequências
- O contador é público e não tem autenticação: alguém pode inflar números com requisições forjadas. Para uma IC isso é aceitável. Se acontecer, basta um limite por IP na borda, sem guardar o IP.
- A página de Privacidade descreve a contagem.
- "Perto de mim" ganha a busca por bairro/endereço no próprio painel, em vez de só no painel de MG.
