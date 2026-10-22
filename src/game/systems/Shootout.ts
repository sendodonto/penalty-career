export type Team = 'a' | 'b';

/** Regras da disputa: 5 cobranças alternadas (A começa), encerramento antecipado e morte súbita. */
export class Shootout {
  a: boolean[] = [];
  b: boolean[] = [];

  constructor(readonly regulation = 5) {}

  get next(): Team {
    return this.a.length <= this.b.length ? 'a' : 'b';
  }

  get suddenDeath(): boolean {
    return Math.min(this.a.length, this.b.length) >= this.regulation;
  }

  goals(team: Team): number {
    return this[team].filter(Boolean).length;
  }

  winner(): Team | null {
    const total = Math.max(this.regulation, this.a.length, this.b.length);
    const ga = this.goals('a');
    const gb = this.goals('b');
    if (ga > gb + (total - this.b.length)) return 'a';
    if (gb > ga + (total - this.a.length)) return 'b';
    return null;
  }

  record(scored: boolean): void {
    if (this.winner()) throw new Error('Disputa já decidida');
    this[this.next].push(scored);
  }

  /** Resultado hipotético se a próxima cobrança terminar `scored`. */
  winnerIf(scored: boolean): Team | null {
    const copy = new Shootout(this.regulation);
    copy.a = [...this.a];
    copy.b = [...this.b];
    copy.record(scored);
    return copy.winner();
  }
}
