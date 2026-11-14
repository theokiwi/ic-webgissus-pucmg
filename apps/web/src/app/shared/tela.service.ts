import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

/** Largura máxima (px) considerada celular. */
export const LARGURA_CELULAR = 600;

@Injectable({ providedIn: 'root' })
export class TelaService {
  /** true em telas de até 600 px. No servidor é sempre false (o CSS cuida do primeiro desenho). */
  readonly pequena = signal(false);

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID)) && typeof matchMedia === 'function') {
      const mq = matchMedia(`(max-width: ${LARGURA_CELULAR}px)`);
      this.pequena.set(mq.matches);
      mq.addEventListener('change', (e) => this.pequena.set(e.matches));
    }
  }
}
