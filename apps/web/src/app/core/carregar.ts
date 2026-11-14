import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, signal, type Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap, type Observable } from 'rxjs';

export interface Carga<T> {
  readonly dado: Signal<T | null>;
  readonly carregando: Signal<boolean>;
  /** Mensagem amigável, pronta para exibir. */
  readonly erro: Signal<string | null>;
}

interface Passo<T> {
  dado: T | null;
  carregando: boolean;
  erro: string | null;
}

export function mensagemDeErro(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.';
    if (e.status === 404) return 'Não encontramos o que você procurou.';
    if (e.status >= 500) return 'O servidor teve um problema. Tente novamente em instantes.';
  }
  return 'Algo deu errado ao carregar os dados. Tente novamente.';
}

/**
 * Carrega um recurso sempre que `chave` muda (null = nada a carregar).
 * Requisições obsoletas são canceladas (switchMap). Deve ser chamada em contexto de injeção.
 */
export function carregar<K, T>(chave: Signal<K | null>, buscar: (k: K) => Observable<T>): Carga<T> {
  const estado = signal<Passo<T>>({ dado: null, carregando: false, erro: null });
  const destroyRef = inject(DestroyRef);
  toObservable(chave)
    .pipe(
      switchMap((k): Observable<Passo<T>> => {
        if (k === null) return of({ dado: null, carregando: false, erro: null });
        return buscar(k).pipe(
          map((dado) => ({ dado, carregando: false, erro: null })),
          catchError((e) => of({ dado: null, carregando: false, erro: mensagemDeErro(e) })),
          startWith({ dado: null, carregando: true, erro: null }),
        );
      }),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe((p) => estado.set(p));
  return {
    dado: computed(() => estado().dado),
    carregando: computed(() => estado().carregando),
    erro: computed(() => estado().erro),
  };
}
