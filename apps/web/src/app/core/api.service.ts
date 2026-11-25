import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  BuscaItemDTO,
  EstabelecimentoDTO,
  LugarDTO,
  MacrorregiaoDTO,
  MetaDTO,
  MunicipioDTO,
  ModoRota,
  MunicipioResumoDTO,
  OrigemAcesso,
  PesquisaParamsDTO,
  ProximoDTO,
  RotaDTO,
  TipoUnidadeDTO,
} from '@webgissus/domain';
import type { Observable } from 'rxjs';
import type { PesquisaCollection, PontosCollection } from './geojson';

/** Cliente HTTP tipado com o contrato de packages/domain/src/api.ts. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  meta(): Observable<MetaDTO> {
    return this.http.get<MetaDTO>(`${this.base}/meta`);
  }

  regioes(): Observable<MacrorregiaoDTO[]> {
    return this.http.get<MacrorregiaoDTO[]>(`${this.base}/regioes`);
  }

  municipios(filtro: { macro?: string; regiao?: string } = {}): Observable<MunicipioResumoDTO[]> {
    let params = new HttpParams();
    if (filtro.macro) params = params.set('macro', filtro.macro);
    if (filtro.regiao) params = params.set('regiao', filtro.regiao);
    return this.http.get<MunicipioResumoDTO[]>(`${this.base}/municipios`, { params });
  }

  municipio(cd: string): Observable<MunicipioDTO> {
    return this.http.get<MunicipioDTO>(`${this.base}/municipios/${encodeURIComponent(cd)}`);
  }

  estabelecimentosDoMunicipio(cd: string): Observable<PontosCollection> {
    return this.http.get<PontosCollection>(`${this.base}/municipios/${encodeURIComponent(cd)}/estabelecimentos`);
  }

  estabelecimento(cnes: string): Observable<EstabelecimentoDTO> {
    return this.http.get<EstabelecimentoDTO>(`${this.base}/estabelecimentos/${encodeURIComponent(cnes)}`);
  }

  /** Tipos de unidade (TP_UNIDADE do CNES) presentes na carga, com o total em MG. */
  tiposUnidade(): Observable<TipoUnidadeDTO[]> {
    return this.http.get<TipoUnidadeDTO[]>(`${this.base}/estabelecimentos/tipos`);
  }

  /** Estabelecimentos de um tipo cujo município está na faixa do critério (ADR 0010). */
  pesquisa(p: PesquisaParamsDTO): Observable<PesquisaCollection> {
    let params = new HttpParams().set('tipo', p.tipo).set('criterio', p.criterio);
    if (p.min !== null) params = params.set('min', p.min);
    if (p.max !== null) params = params.set('max', p.max);
    if (p.macro) params = params.set('macro', p.macro);
    if (p.regiao) params = params.set('regiao', p.regiao);
    return this.http.get<PesquisaCollection>(`${this.base}/estabelecimentos/pesquisa`, { params });
  }

  busca(q: string, limite = 10): Observable<BuscaItemDTO[]> {
    const params = new HttpParams().set('q', q).set('limite', limite);
    return this.http.get<BuscaItemDTO[]>(`${this.base}/estabelecimentos/busca`, { params });
  }

  /** Soma um acesso à origem (ADR 0009); só origem, meio e campanha são enviados. */
  registrarAcesso(o: OrigemAcesso): Observable<void> {
    return this.http.post<void>(`${this.base}/acessos`, o);
  }

  /** Bairros, ruas e endereços de MG (geocodificador OSM via servidor). */
  lugares(q: string, limite = 5): Observable<LugarDTO[]> {
    const params = new HttpParams().set('q', q).set('limite', limite);
    return this.http.get<LugarDTO[]>(`${this.base}/lugares`, { params });
  }

  /** Estabelecimentos mais próximos de um ponto (distância em linha reta). */
  proximos(lat: number, lon: number, opcoes: { categoria?: string | null; limite?: number; raioKm?: number } = {}): Observable<ProximoDTO[]> {
    let params = new HttpParams().set('lat', lat).set('lon', lon).set('limite', opcoes.limite ?? 20).set('raioKm', opcoes.raioKm ?? 30);
    if (opcoes.categoria) params = params.set('categoria', opcoes.categoria);
    return this.http.get<ProximoDTO[]>(`${this.base}/estabelecimentos/proximos`, { params });
  }

  rota(de: { lat: number; lon: number }, para: { lat: number; lon: number }, modo: ModoRota = 'auto'): Observable<RotaDTO> {
    const params = new HttpParams().set('de', `${de.lat},${de.lon}`).set('para', `${para.lat},${para.lon}`).set('modo', modo);
    return this.http.get<RotaDTO>(`${this.base}/rota`, { params });
  }
}
