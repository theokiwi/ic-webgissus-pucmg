import { DOCUMENT } from '@angular/common';
import { inject, Injectable, PendingTasks } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { catchError, forkJoin, map, of, type Observable } from 'rxjs';
import { ApiService } from './api.service';
import { URL_PUBLICA } from './ambiente';
import {
  caminhoCanonico,
  METAS_ESTATICAS,
  METAS_MG,
  metasEstabelecimento,
  metasMunicipio,
  metasRecorte,
  rotaSeo,
  NOME_SITE,
  type Metas,
  type RotaSeo,
} from './seo';

const IMAGEM_ALT = 'WebGIS SUS-MG: saúde gratuita pelo SUS em Minas Gerais';

/**
 * Título, descrição, Open Graph, Twitter Card e canonical de cada rota.
 * No SSR espera os dados da API (PendingTasks) para que o HTML já saia com as metas certas.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly titulo = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly base = inject(URL_PUBLICA).replace(/\/+$/, '');
  private readonly tarefas = inject(PendingTasks);
  private geracao = 0;

  /** Começa a acompanhar a navegação. Chamar uma vez (App). */
  iniciar(): void {
    // A navegação inicial pode ter terminado antes do App existir (navegação bloqueante).
    if (this.router.navigated) this.atualizar(this.router.url);
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.atualizar(e.urlAfterRedirects);
    });
  }

  private atualizar(url: string): void {
    const rota = rotaSeo(url);
    const id = ++this.geracao;
    const concluir = this.tarefas.add();
    const aplicar = (m: Metas) => {
      if (id === this.geracao) this.aplicar(m, rota);
    };
    this.metas(rota)
      .pipe(catchError(() => of(this.provisorias(rota))))
      .subscribe({
        next: aplicar,
        error: () => concluir(),
        complete: () => concluir(),
      });
  }

  private provisorias(rota: RotaSeo): Metas {
    return rota.tipo === 'sobre' || rota.tipo === 'privacidade' || rota.tipo === 'perto'
      ? METAS_ESTATICAS[rota.tipo]
      : METAS_MG;
  }

  private metas(rota: RotaSeo): Observable<Metas> {
    switch (rota.tipo) {
      case 'municipio':
        return this.api.municipio(rota.cd).pipe(map(metasMunicipio));
      case 'estabelecimento':
        return this.api.estabelecimento(rota.cnes).pipe(map(metasEstabelecimento));
      case 'macro':
      case 'regiao': {
        const { tipo, cd } = rota;
        return forkJoin([this.api.regioes(), this.api.municipios(tipo === 'macro' ? { macro: cd } : { regiao: cd })]).pipe(
          map(([macros, muns]) => {
            const alvo =
              tipo === 'macro' ? macros.find((m) => m.cd === cd) : macros.flatMap((m) => m.regioes).find((r) => r.cd === cd);
            if (!alvo) return METAS_MG;
            const totais = {
              municipios: muns.length,
              estabelecimentos: muns.reduce((s, m) => s + m.totalEstabelecimentos, 0),
              populacao: muns.reduce((s, m) => s + (m.populacao ?? 0), 0),
            };
            return metasRecorte(tipo, alvo.nome, muns.length ? totais : null);
          }),
        );
      }
      default:
        return of(this.provisorias(rota));
    }
  }

  private aplicar(m: Metas, rota: RotaSeo): void {
    const url = this.base + caminhoCanonico(rota);
    const imagem = `${this.base}/og.png`;
    this.titulo.setTitle(m.titulo);
    const nome = (property: string, content: string) =>
      this.meta.updateTag({ property, content }, `property='${property}'`);
    const campo = (name: string, content: string) => this.meta.updateTag({ name, content }, `name='${name}'`);

    campo('description', m.descricao);
    nome('og:title', m.titulo);
    nome('og:description', m.descricao);
    nome('og:url', url);
    nome('og:image', imagem);
    nome('og:image:width', '1200');
    nome('og:image:height', '630');
    nome('og:image:alt', IMAGEM_ALT);
    nome('og:type', m.tipo);
    nome('og:locale', 'pt_BR');
    nome('og:site_name', NOME_SITE);
    campo('twitter:card', 'summary_large_image');
    campo('twitter:title', m.titulo);
    campo('twitter:description', m.descricao);
    campo('twitter:image', imagem);
    campo('twitter:image:alt', IMAGEM_ALT);

    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
