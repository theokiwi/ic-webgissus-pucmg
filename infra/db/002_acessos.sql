-- Contagem anônima de acessos por origem (ADR 0009). Escrita pela API, não pelo ETL.
-- Não guarda IP, cookie, página nem identificador: só a soma diária por origem/meio/campanha.
-- `pnpm banco:publicar` NÃO copia esta tabela (as contagens de produção vivem só no Neon).

CREATE TABLE IF NOT EXISTS acesso_diario (
  dia       date    NOT NULL,                  -- fuso de Brasília
  origem    text    NOT NULL,                  -- utm_source  (ex.: instagram, whatsapp, cartaz)
  meio      text    NOT NULL,                  -- utm_medium  (ex.: social, impresso)
  campanha  text    NOT NULL,                  -- utm_campaign (divulgacao | compartilhar | …)
  n         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, origem, meio, campanha)
);
