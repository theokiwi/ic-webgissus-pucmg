import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  BuscaItemDTO,
  EstabelecimentoDTO,
  MacrorregiaoDTO,
  MetaDTO,
  MunicipioDTO,
  ModoRota,
  MunicipioResumoDTO,
  ProximoDTO,
  RotaDTO,
} from '@webgissus/domain';
import type { Observable } from 'rxjs';
import type { PontosCollection } from './geojson';

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

  busca(q: string, limite = 10): Observable<BuscaItemDTO[]> {
    const params = new HttpParams().set('q', q).set('limite', limite);
    return this.http.get<BuscaItemDTO[]>(`${this.base}/estabelecimentos/busca`, { params });
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
