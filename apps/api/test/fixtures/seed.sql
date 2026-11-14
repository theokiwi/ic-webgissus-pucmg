-- Seed sintético para os testes e2e (banco webgissus_test). Não é dado real.
INSERT INTO carga (competencia, executada_em, fontes, relatorio)
VALUES ('202608', '2026-09-01 10:00:00-03', '{}', '{}'),
       ('202609', '2026-10-01 10:00:00-03', '{"cnes":"teste.zip"}', '{}');

INSERT INTO macrorregiao (cd, nome, geom) VALUES
  ('3101', 'Macro Teste', ST_Multi(ST_MakeEnvelope(-44.0, -20.0, -42.9, -19.9, 4326)));
INSERT INTO regiao_saude (cd, nome, cd_macro, geom) VALUES
  ('31001', 'Região Teste', '3101', ST_Multi(ST_MakeEnvelope(-44.0, -20.0, -42.9, -19.9, 4326)));

-- Quadrados simples: Alfa e Beta vizinhos; Gama distante.
INSERT INTO municipio (cd, cd6, nome, cd_regiao, cd_macro, populacao, area_km2, densidade, geom) VALUES
  ('3100001', '310000', 'Alfa', '31001', '3101', 10000, 120.5, 82.99, ST_Multi(ST_MakeEnvelope(-44.0, -20.0, -43.9, -19.9, 4326))),
  ('3100002', '310001', 'Beta', '31001', '3101',  5000,  98.0, 51.02, ST_Multi(ST_MakeEnvelope(-43.9, -20.0, -43.8, -19.9, 4326))),
  ('3100003', '310002', 'Gama', '31001', '3101',  NULL,  NULL,  NULL, ST_Multi(ST_MakeEnvelope(-43.0, -20.0, -42.9, -19.9, 4326)));

INSERT INTO estabelecimento
  (cnes, nome, razao_social, tp_unidade, categoria, cd_municipio, logradouro, numero, complemento, bairro, cep,
   telefone, email, natureza, sempre_aberto, turno, coord_ok, atualizado_em, geom) VALUES
  ('1000001', 'UBS Centro Saúde', 'Prefeitura de Alfa', 2, 'atencao_basica', '3100001', 'Rua A', '10', NULL, 'Centro', '35000000',
   '(31) 3333-0001', 'ubs@alfa.mg.gov.br', 'publica', false, 'Manhã e tarde', true, '2026-08-15', ST_SetSRID(ST_MakePoint(-43.95, -19.95), 4326)),
  ('1000002', 'Hospital Municipal Alfa', NULL, 5, 'hospital', '3100001', 'Av. B', 's/n', 'Anexo', 'Bela Vista', '35000001',
   NULL, NULL, 'sem_fins_lucrativos', true, NULL, true, '2026-07-01', ST_SetSRID(ST_MakePoint(-43.94, -19.95), 4326)),
  ('1000003', 'UPA Beta', NULL, 73, 'urgencia', '3100002', NULL, NULL, NULL, 'Centro', NULL,
   NULL, NULL, 'publica', true, NULL, true, NULL, ST_SetSRID(ST_MakePoint(-43.85, -19.95), 4326)),
  ('1000004', 'Laboratório Exames', NULL, 39, 'laboratorio', '3100001', NULL, NULL, NULL, 'Centro', NULL,
   NULL, NULL, 'empresarial', false, NULL, true, NULL, ST_SetSRID(ST_MakePoint(-43.96, -19.96), 4326)),
  ('1000005', 'CAPS Beta', NULL, 70, 'saude_mental', '3100002', NULL, NULL, NULL, 'Industrial', NULL,
   NULL, NULL, 'publica', false, NULL, true, NULL, ST_SetSRID(ST_MakePoint(-43.84, -19.94), 4326)),
  ('1000006', 'Farmácia Popular Gama', NULL, 43, 'farmacia', '3100003', NULL, NULL, NULL, 'Centro', NULL,
   NULL, NULL, 'publica', false, NULL, true, NULL, ST_SetSRID(ST_MakePoint(-42.95, -19.95), 4326)),
  ('1000007', 'Posto Vacinação', NULL, 85, 'vacinacao', '3100003', NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, 'publica', false, NULL, true, NULL, ST_SetSRID(ST_MakePoint(-42.96, -19.96), 4326)),
  ('1000008', 'Hemocentro Regional', NULL, 69, 'hemocentro', '3100001', NULL, NULL, NULL, 'Centro', NULL,
   NULL, NULL, 'publica', false, NULL, true, NULL, ST_SetSRID(ST_MakePoint(-43.93, -19.93), 4326)),
  -- coord_ok = false: muito perto do ponto de teste, mas nunca deve aparecer em "proximos".
  ('1000009', 'UBS Fora Coord', NULL, 2, 'atencao_basica', '3100001', NULL, NULL, NULL, 'Centro', NULL,
   NULL, NULL, 'publica', false, NULL, false, NULL, ST_SetSRID(ST_MakePoint(-43.951, -19.951), 4326)),
  ('1000010', 'Academia Saúde', NULL, 74, 'promocao_saude', '3100002', NULL, NULL, NULL, 'Centro', NULL,
   NULL, NULL, 'publica', false, NULL, true, NULL, ST_SetSRID(ST_MakePoint(-43.83, -19.93), 4326));

INSERT INTO estabelecimento_horario (cnes, dia, abre, fecha) VALUES
  ('1000001', 1, '07:00', '11:00'),
  ('1000001', 1, '13:00', '17:00'),
  ('1000001', 2, '07:00', '17:00'),
  ('1000004', 6, '08:00', '12:00');

INSERT INTO estabelecimento_servico (cnes, cd_servico, servico, cd_classificacao, classificacao, sus) VALUES
  ('1000001', '125', 'Serviço de atenção à saúde bucal', '001', 'Odontologia', true),
  ('1000002', '145', 'Serviço de diagnóstico por imagem', '002', NULL, false);

INSERT INTO estabelecimento_atendimento (cnes, atendimento, sus) VALUES
  ('1000001', 'AMBULATORIAL', true),
  ('1000002', 'INTERNACAO', true),
  ('1000002', 'URGENCIA', true),
  ('1000002', 'SADT', false);
