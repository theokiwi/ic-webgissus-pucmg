import { Injectable, type PipeTransform } from '@nestjs/common';
import {
  parseBusca,
  parseCategoria,
  parseDigitos,
  parseProximos,
  parseRota,
  type BuscaParams,
  type ProximosParams,
  type RotaParams,
  type Texto,
} from './params.js';
import type { CategoriaSlug } from '@webgissus/domain';

/** Código IBGE de município (7 dígitos). */
@Injectable()
export class CodigoMunicipioPipe implements PipeTransform<Texto, string> {
  transform(v: Texto) {
    return parseDigitos(v, 7, 'cd');
  }
}

/** Código CNES (7 dígitos). */
@Injectable()
export class CnesPipe implements PipeTransform<Texto, string> {
  transform(v: Texto) {
    return parseDigitos(v, 7, 'cnes');
  }
}

@Injectable()
export class CategoriaPipe implements PipeTransform<Texto, CategoriaSlug | null> {
  transform(v: Texto) {
    return parseCategoria(v);
  }
}

@Injectable()
export class ProximosPipe implements PipeTransform<Record<string, Texto>, ProximosParams> {
  transform(q: Record<string, Texto>) {
    return parseProximos(q);
  }
}

@Injectable()
export class BuscaPipe implements PipeTransform<Record<string, Texto>, BuscaParams> {
  transform(q: Record<string, Texto>) {
    return parseBusca(q);
  }
}

@Injectable()
export class RotaPipe implements PipeTransform<Record<string, Texto>, RotaParams> {
  transform(q: Record<string, Texto>) {
    return parseRota(q);
  }
}
