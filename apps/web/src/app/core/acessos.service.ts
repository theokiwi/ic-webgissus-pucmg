import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { origemDoAcesso, type OrigemAcesso } from '@webgissus/domain';
import { filter, take } from 'rxjs';
import { ApiService } from './api.service';

const CHAVE = 'webgissus:acesso-contado';

/** Mesma origem já contada nesta aba? (recarregar a página não conta de novo). Sem storage, conta. */
function jaContado(chave: string): boolean {
  try {
    if (sessionStorage.getItem(CHAVE) === chave) return true;
    sessionStorage.setItem(CHAVE, chave);
  } catch {
    // Navegação privada ou storage bloqueado: segue sem a proteção contra recarga.
  }
  return false;
}

/**
 * Contagem anônima de acessos por origem (ADR 0009). Lê os `utm_*` da primeira navegação
 * concluída (já depois do redirecionamento de /insta, /whats, /cartaz) e avisa a API uma vez.
 */
@Injectable({ providedIn: 'root' })
export class AcessosService {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));

  iniciar(): void {
    if (!this.navegador) return;
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        take(1),
      )
      .subscribe((e) => this.contar(origemDoAcesso(e.urlAfterRedirects)));
  }

  private contar(o: OrigemAcesso | null): void {
    if (!o || jaContado(`${o.origem}|${o.meio}|${o.campanha}`)) return;
    // Falha na contagem não pode atrapalhar quem está usando o mapa.
    this.api.registrarAcesso(o).subscribe({ error: () => undefined });
  }
}
