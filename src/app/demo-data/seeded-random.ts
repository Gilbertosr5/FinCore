import { Money } from '@/lib/money';

/**
 * Gerador pseudoaleatório determinístico (mulberry32). Mesma semente → mesma
 * sequência, garantindo dados de demonstração idênticos a cada geração.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: string) {
    // FNV-1a para transformar a semente textual em inteiro de 32 bits.
    let hash = 0x811c9dc5;
    for (let index = 0; index < seed.length; index++) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    this.state = hash >>> 0;
  }

  /** Número em [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inteiro em [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Valor monetário em [min, max] reais, com centavos. Sem ponto flutuante no resultado. */
  money(min: number, max: number): Money {
    return Money.fromCents(this.int(Math.round(min * 100), Math.round(max * 100)));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[this.int(0, items.length - 1)];
    if (item === undefined) throw new Error('Lista vazia.');
    return item;
  }
}
