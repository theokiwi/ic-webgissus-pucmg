import { ESTADO_INICIAL, montarUrl, parseRota } from './estado-url';

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
});
