import { describe, expect, it } from 'vitest';
import type { EstabelecimentoDTO, MunicipioDTO } from '@webgissus/domain';
import { caminhoCanonico, metasEstabelecimento, metasMunicipio, metasRecorte, rotaSeo } from './seo';

describe('rotaSeo', () => {
  it('interpreta as rotas e ignora query/hash', () => {
    expect(rotaSeo('/')).toEqual({ tipo: 'mg' });
    expect(rotaSeo('/municipio/3106200?cat=hospital&utm_source=x')).toEqual({ tipo: 'municipio', cd: '3106200' });
    expect(rotaSeo('/estabelecimento/0027618')).toEqual({ tipo: 'estabelecimento', cnes: '0027618' });
    expect(rotaSeo('/macro/3101')).toEqual({ tipo: 'macro', cd: '3101' });
    expect(rotaSeo('/regiao/31001#x')).toEqual({ tipo: 'regiao', cd: '31001' });
    expect(rotaSeo('/sobre')).toEqual({ tipo: 'sobre' });
    expect(rotaSeo('/privacidade')).toEqual({ tipo: 'privacidade' });
    expect(rotaSeo('/municipio/abc')).toEqual({ tipo: 'mg' });
    expect(rotaSeo('/qualquer/coisa')).toEqual({ tipo: 'mg' });
  });

  it('caminho canônico não carrega query', () => {
    expect(caminhoCanonico(rotaSeo('/municipio/3106200?tema=densidade'))).toBe('/municipio/3106200');
    expect(caminhoCanonico(rotaSeo('/'))).toBe('/');
    expect(caminhoCanonico(rotaSeo('/sobre'))).toBe('/sobre');
  });
});

describe('metas', () => {
  const mun = {
    cd: '3106200', nome: 'Belo Horizonte', nomeRegiao: 'Belo Horizonte/Nova Lima/Caeté', nomeMacro: 'Centro',
    populacao: 2315560, totalEstabelecimentos: 700, estabelecimentosPor10mil: 3.02,
  } as MunicipioDTO;

  it('município traz nome e totais', () => {
    const m = metasMunicipio(mun);
    expect(m.titulo).toContain('Belo Horizonte');
    expect(m.descricao).toContain('700 estabelecimentos');
    expect(m.descricao).toContain('2.315.560 habitantes');
  });

  it('estabelecimento traz nome, categoria e município', () => {
    const e = {
      nome: 'UBS Centro', categoria: 'atencao_basica', tipoUnidade: { codigo: 2, descricao: 'Centro de Saúde/UBS' },
      municipio: { cd: '3106200', nome: 'Belo Horizonte' }, sempreAberto: false, competencia: '202609',
    } as EstabelecimentoDTO;
    const m = metasEstabelecimento(e);
    expect(m.titulo).toContain('UBS Centro');
    expect(m.descricao).toContain('Centro de Saúde/UBS');
    expect(m.descricao).toContain('Belo Horizonte');
  });

  it('recorte com e sem totais', () => {
    expect(metasRecorte('macro', 'Sul', { municipios: 3, estabelecimentos: 10, populacao: 1000 }).descricao).toContain('3 municípios');
    expect(metasRecorte('regiao', 'X', null).titulo).toContain('Região de saúde X');
  });
});
