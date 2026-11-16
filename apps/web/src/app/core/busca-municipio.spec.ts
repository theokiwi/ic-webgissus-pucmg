import { municipiosQueCasam } from './busca-municipio';

const lista = [
  { nome: 'Belo Horizonte' },
  { nome: 'Belo Oriente' },
  { nome: 'Abre Campo' },
  { nome: 'Campo Belo' },
  { nome: 'São João del Rei' },
  { nome: 'Conceição do Pará' },
];

describe('municipiosQueCasam', () => {
  it('prefixo antes de "contém", cada grupo em ordem alfabética', () => {
    expect(municipiosQueCasam(lista, 'belo').map((m) => m.nome)).toEqual(['Belo Horizonte', 'Belo Oriente', 'Campo Belo']);
    expect(municipiosQueCasam(lista, 'campo').map((m) => m.nome)).toEqual(['Campo Belo', 'Abre Campo']);
  });

  it('ignora acento e caixa', () => {
    expect(municipiosQueCasam(lista, 'SAO JOAO').map((m) => m.nome)).toEqual(['São João del Rei']);
    expect(municipiosQueCasam(lista, 'conceicao').map((m) => m.nome)).toEqual(['Conceição do Pará']);
  });

  it('respeita o máximo e devolve vazio sem termo', () => {
    expect(municipiosQueCasam(lista, 'o', 2)).toHaveLength(2);
    expect(municipiosQueCasam(lista, '   ')).toEqual([]);
  });
});
