/** Decodifica polyline codificado (algoritmo do Google) com a precisão dada; devolve [lon, lat]. */
export function decodificarPolyline(codificado: string, precisao = 6): [number, number][] {
  const fator = 10 ** precisao;
  const pontos: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;

  const proximoValor = (): number => {
    let resultado = 0;
    let deslocamento = 0;
    let byte: number;
    do {
      if (i >= codificado.length) throw new Error('polyline truncado');
      byte = codificado.charCodeAt(i++) - 63;
      resultado |= (byte & 0x1f) << deslocamento;
      deslocamento += 5;
    } while (byte >= 0x20);
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
  };

  while (i < codificado.length) {
    lat += proximoValor();
    lon += proximoValor();
    pontos.push([lon / fator, lat / fator]);
  }
  return pontos;
}
