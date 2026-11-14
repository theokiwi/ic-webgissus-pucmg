-- Esquema do WebGIS SUS-MG. Contrato entre o ETL (escreve) e a API (lê).
-- O ETL recria o conteúdo das tabelas a cada competência, dentro de uma transação.
-- SRID: 4326 em tudo (malhas IBGE em SIRGAS 2000/4674 são convertidas no ETL).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() não é IMMUTABLE; wrapper para permitir índice de busca.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

CREATE TABLE IF NOT EXISTS carga (
  id            serial PRIMARY KEY,
  competencia   char(6)     NOT NULL,          -- AAAAMM do CNES
  executada_em  timestamptz NOT NULL DEFAULT now(),
  fontes        jsonb       NOT NULL,          -- {"cnes": "...zip", "territorio": "...", "ibge_malha": "...", ...}
  relatorio     jsonb       NOT NULL           -- métricas de qualidade (ver pipelines/etl)
);

CREATE TABLE IF NOT EXISTS macrorregiao (
  cd    char(4) PRIMARY KEY,                   -- ex.: 3103
  nome  text    NOT NULL,
  geom  geometry(MultiPolygon, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS regiao_saude (
  cd        char(5) PRIMARY KEY,               -- ex.: 31001
  nome      text    NOT NULL,
  cd_macro  char(4) NOT NULL REFERENCES macrorregiao(cd),
  geom      geometry(MultiPolygon, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS municipio (
  cd           char(7) PRIMARY KEY,            -- código IBGE (7 dígitos)
  cd6          char(6) NOT NULL UNIQUE,        -- código DATASUS (6 dígitos)
  nome         text    NOT NULL,
  cd_regiao    char(5) NOT NULL REFERENCES regiao_saude(cd),
  cd_macro     char(4) NOT NULL REFERENCES macrorregiao(cd),
  populacao    integer,                        -- Censo 2022
  area_km2     double precision,               -- Censo 2022 / malha
  densidade    double precision,               -- hab/km²
  geom         geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS municipio_geom_idx ON municipio USING gist (geom);

CREATE TABLE IF NOT EXISTS estabelecimento (
  cnes            char(7) PRIMARY KEY,
  nome            text    NOT NULL,            -- NO_FANTASIA
  razao_social    text,
  tp_unidade      smallint NOT NULL,
  categoria       text    NOT NULL,            -- slug de packages/domain/categorias.json
  cd_municipio    char(7) NOT NULL REFERENCES municipio(cd),
  logradouro      text,
  numero          text,
  complemento     text,
  bairro          text,
  cep             char(8),
  telefone        text,
  email           text,
  natureza        text    NOT NULL,            -- 'publica' | 'empresarial' | 'sem_fins_lucrativos' | 'pessoa_fisica' | 'nao_informada'
  sempre_aberto   boolean NOT NULL DEFAULT false,
  turno           text,                        -- descrição do turno no CNES
  coord_ok        boolean NOT NULL,            -- ponto dentro do próprio município
  atualizado_em   date,                        -- DT_ATUALIZACAO do CNES
  geom            geometry(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS estabelecimento_geom_idx ON estabelecimento USING gist (geom);
CREATE INDEX IF NOT EXISTS estabelecimento_geog_idx ON estabelecimento USING gist ((geom::geography));
CREATE INDEX IF NOT EXISTS estabelecimento_mun_idx  ON estabelecimento (cd_municipio, categoria);
CREATE INDEX IF NOT EXISTS estabelecimento_nome_trgm ON estabelecimento USING gin (f_unaccent(lower(nome)) gin_trgm_ops);

-- Horário de funcionamento declarado (tbEstabHorarioAtend). Unidades 24h usam sempre_aberto.
CREATE TABLE IF NOT EXISTS estabelecimento_horario (
  cnes   char(7)  NOT NULL REFERENCES estabelecimento(cnes) ON DELETE CASCADE,
  dia    smallint NOT NULL CHECK (dia BETWEEN 0 AND 6),   -- 0 = domingo … 6 = sábado (CNES: 1 = domingo … 7 = sábado)
  abre   time     NOT NULL,
  fecha  time     NOT NULL,
  PRIMARY KEY (cnes, dia, abre)
);

-- Serviços especializados (rlEstabServClass + descrições).
CREATE TABLE IF NOT EXISTS estabelecimento_servico (
  cnes              char(7) NOT NULL REFERENCES estabelecimento(cnes) ON DELETE CASCADE,
  cd_servico        char(3) NOT NULL,
  servico           text    NOT NULL,
  cd_classificacao  char(3) NOT NULL,
  classificacao     text,
  sus               boolean NOT NULL,          -- ambulatorial ou hospitalar SUS
  PRIMARY KEY (cnes, cd_servico, cd_classificacao)
);

-- Tipos de atendimento prestados e se são pelo SUS (rlEstabAtendPrestConv).
CREATE TABLE IF NOT EXISTS estabelecimento_atendimento (
  cnes         char(7) NOT NULL REFERENCES estabelecimento(cnes) ON DELETE CASCADE,
  atendimento  text    NOT NULL,               -- ex.: 'AMBULATORIAL', 'INTERNACAO', 'URGENCIA', 'SADT'
  sus          boolean NOT NULL,
  PRIMARY KEY (cnes, atendimento)
);
