import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import type { Ponto } from './estado-url';

export type StatusLocalizacao = 'ocioso' | 'buscando' | 'ok' | 'erro';

/** Mensagem amigável para um `GeolocationPositionError.code` (1 negado, 2 indisponível, 3 tempo esgotado). */
export function mensagemErroGeo(codigo: number | null): string {
  switch (codigo) {
    case 1:
      return 'Não conseguimos acessar sua localização: a permissão foi negada. Libere o acesso no navegador ou escolha o ponto tocando no mapa.';
    case 2:
      return 'Não foi possível determinar onde você está agora. Tente de novo ou escolha o ponto tocando no mapa.';
    case 3:
      return 'A localização demorou demais para responder. Tente de novo ou escolha o ponto tocando no mapa.';
    default:
      return 'Este navegador não oferece localização. Escolha o ponto tocando no mapa.';
  }
}

/**
 * Localização do usuário. A posição fica só em memória (nunca em storage nem enviada
 * a terceiros); quem a usa a leva para a URL já arredondada.
 */
@Injectable({ providedIn: 'root' })
export class LocalizacaoService {
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));

  readonly status = signal<StatusLocalizacao>('ocioso');
  readonly erro = signal<string | null>(null);
  /** Última posição obtida pelo GPS nesta sessão. */
  readonly posicao = signal<Ponto | null>(null);

  /** Modo "toque no mapa": quem pediu o ponto (a ação a executar quando for confirmado). */
  readonly escolhendo = signal<'perto' | 'rota' | null>(null);
  /** Ponto tocado no mapa, aguardando "Usar este ponto". */
  readonly pontoTocado = signal<Ponto | null>(null);

  /** Pede a posição ao navegador; devolve null (e preenche `erro`) se não for possível. */
  obter(): Promise<Ponto | null> {
    if (!this.navegador || typeof navigator === 'undefined' || !navigator.geolocation) {
      return this.falhar(null);
    }
    this.status.set('buscando');
    this.erro.set(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const ponto = { lat: p.coords.latitude, lon: p.coords.longitude };
          this.posicao.set(ponto);
          this.status.set('ok');
          resolve(ponto);
        },
        (e) => resolve(this.falharSync(e.code)),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
      );
    });
  }

  private falhar(codigo: number | null): Promise<null> {
    return Promise.resolve(this.falharSync(codigo));
  }

  private falharSync(codigo: number | null): null {
    this.status.set('erro');
    this.erro.set(mensagemErroGeo(codigo));
    return null;
  }

  iniciarEscolha(para: 'perto' | 'rota'): void {
    this.pontoTocado.set(null);
    this.escolhendo.set(para);
  }

  cancelarEscolha(): void {
    this.escolhendo.set(null);
    this.pontoTocado.set(null);
  }
}
