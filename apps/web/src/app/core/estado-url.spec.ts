import { arredondarCoord, ESTADO_INICIAL, montarUrl, parseRota } from './estado-url';

describe('URL ↔ estado', () => {
  it('raiz é a visão de MG com tema padrão', () => {
    expect(parseRota('/')).toEqual(ESTADO_INICIAL);
  });

  it('lê o tema da query', () => {
    expect(parseRota('/?tema=densidade').tema).toBe('densidade');
    expect(parseRota('/?tema=invalido').tema).toBe('populacao');
  });

  it('macro, região e município', () => {
    expect(parseRota('/macro/3101')).toMatchObject({ visao: 'macro', cd: '3101' });
    expect(parseRota('/regiao/31001')).toMatchObject({ visao: 'regiao', cd: '31001' });
    expect(parseRota('/municipio/3106200')).toMatchObject({ visao: 'municipio', cd: '3106200', cat: null, q: '' });
  });

  it('município com filtros de categoria e texto', () => {
    expect(parseRota('/municipio/3106200?cat=hospital&q=santa%20casa')).toMatchObject({
      visao: 'municipio', cd: '3106200', cat: 'hospital', q: 'santa casa',
    });
  });

  it('categoria inexistente é ignorada', () => {
    expect(parseRota('/municipio/3106200?cat=xyz').cat).toBeNull();
  });

  it('estabelecimento', () => {
    expect(parseRota('/estabelecimento/2695324')).toMatchObject({ visao: 'estabelecimento', cnes: '2695324' });
  });

  it('URLs inválidas caem na visão de MG', () => {
    expect(parseRota('/municipio/abc').visao).toBe('mg');
    expect(parseRota('/qualquer/coisa/aqui').visao).toBe('mg');
    expect(parseRota('/municipio').visao).toBe('mg');
  });

  it('montarUrl omite valores padrão', () => {
    expect(montarUrl(ESTADO_INICIAL)).toBe('/');
    expect(montarUrl({ ...ESTADO_INICIAL, tema: 'total' })).toBe('/?tema=total');
    expect(montarUrl({ ...ESTADO_INICIAL, visao: 'macro', cd: '3101' })).toBe('/macro/3101');
  });

  it('ida e volta preserva o estado', () => {
    for (const url of [
      '/',
      '/?tema=por10mil',
      '/macro/3101?tema=densidade',
      '/regiao/31001',
      '/municipio/3106200?cat=urgencia&q=centro',
      '/estabelecimento/2695324?cat=hospital',
    ]) {
      expect(montarUrl(parseRota(url))).toBe(url);
    }
  });

  it('filtros não aparecem em visões que não os usam', () => {
    expect(montarUrl({ ...ESTADO_INICIAL, cat: 'hospital', q: 'x' })).toBe('/');
  });

  describe('perto de mim', () => {
    it('lê ponto, categoria e raio', () => {
      expect(parseRota('/perto?lat=-19.9191&lon=-43.9386&cat=urgencia')).toMatchObject({
        visao: 'perto', ponto: { lat: -19.9191, lon: -43.9386 }, cat: 'urgencia', raio: 30,
      });
      expect(parseRota('/perto?lat=-19.9&lon=-43.9&raio=100').raio).toBe(100);
    });

    it('sem coordenadas ou com coordenadas inválidas, o ponto é nulo', () => {
      expect(parseRota('/perto')).toMatchObject({ visao: 'perto', ponto: null });
      expect(parseRota('/perto?lat=abc&lon=1').ponto).toBeNull();
      expect(parseRota('/perto?lat=95&lon=1').ponto).toBeNull();
      expect(parseRota('/perto?lat=-19.9').ponto).toBeNull();
    });

    it('arredonda para 4 casas na leitura e na escrita', () => {
      expect(arredondarCoord(-19.919123456)).toBe(-19.9191);
      expect(parseRota('/perto?lat=-19.919123456&lon=-43.938655').ponto).toEqual({ lat: -19.9191, lon: -43.9387 });
      const url = montarUrl({ ...ESTADO_INICIAL, visao: 'perto', ponto: { lat: -19.91912345, lon: -43.93861234 } });
      expect(url).toBe('/perto?lat=-19.9191&lon=-43.9386');
    });

    it('ida e volta com categoria e raio', () => {
      for (const url of ['/perto', '/perto?lat=-19.9191&lon=-43.9386&cat=urgencia', '/perto?lat=-19.9191&lon=-43.9386&raio=100']) {
        expect(montarUrl(parseRota(url))).toBe(url);
      }
    });
  });

  describe('rota na ficha', () => {
    it('lê modo e origem', () => {
      expect(parseRota('/estabelecimento/2695324?rota=pedestre&de=-19.9191,-43.9386')).toMatchObject({
        visao: 'estabelecimento', cnes: '2695324', modoRota: 'pedestre', de: { lat: -19.9191, lon: -43.9386 },
      });
    });

    it('modo inválido é ignorado; modo sem origem é mantido', () => {
      expect(parseRota('/estabelecimento/1?rota=voando').modoRota).toBeNull();
      expect(parseRota('/estabelecimento/1?rota=auto')).toMatchObject({ modoRota: 'auto', de: null });
      expect(parseRota('/estabelecimento/1?rota=auto&de=x,y').de).toBeNull();
    });

    it('ida e volta, com origem arredondada', () => {
      const url = '/estabelecimento/2695324?rota=bicicleta&de=-19.9191,-43.9386';
      expect(montarUrl(parseRota(url))).toBe(url);
      expect(montarUrl({ ...ESTADO_INICIAL, visao: 'estabelecimento', cnes: '1', modoRota: 'auto', de: { lat: -19.91919, lon: -43.93861 } })).toBe(
        '/estabelecimento/1?rota=auto&de=-19.9192,-43.9386',
      );
    });

    it('rota e origem só existem na ficha', () => {
      expect(montarUrl({ ...ESTADO_INICIAL, visao: 'municipio', cd: '3106200', modoRota: 'auto', de: { lat: 1, lon: 2 } })).toBe('/municipio/3106200');
    });
  });

  it('setores ligados vão para a URL em qualquer visão', () => {
    expect(parseRota('/municipio/3106200?setores=1').setores).toBe(true);
    expect(parseRota('/municipio/3106200').setores).toBe(false);
    expect(montarUrl({ ...ESTADO_INICIAL, visao: 'municipio', cd: '3106200', setores: true })).toBe('/municipio/3106200?setores=1');
    expect(montarUrl(parseRota('/?setores=1'))).toBe('/?setores=1');
  });
});
