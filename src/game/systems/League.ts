import type { Rng, Standing, Team } from '../types';
import { keeperFromRating, simulateKick } from './PenaltyResolver';
import { Shootout } from './Shootout';

/** Turno único pelo método do círculo: n-1 rodadas, n/2 jogos cada (n par). */
export function roundRobin(ids: string[]): [string, string][][] {
  const list = [...ids];
  const rounds: [string, string][][] = [];
  for (let r = 0; r < list.length - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < list.length / 2; i++) {
      const pair: [string, string] = [list[i], list[list.length - 1 - i]];
      pairs.push(r % 2 ? [pair[1], pair[0]] : pair);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

export const emptyStandings = (ids: string[]): Standing[] =>
  ids.map((clubId) => ({ clubId, played: 0, won: 0, lost: 0, pts: 0, scored: 0, conceded: 0 }));

export function applyResult(table: Standing[], homeId: string, awayId: string, gh: number, ga: number): void {
  for (const [id, f, a] of [[homeId, gh, ga], [awayId, ga, gh]] as const) {
    const row = table.find((s) => s.clubId === id);
    if (!row) continue;
    row.played++;
    row.scored += f;
    row.conceded += a;
    if (f > a) { row.won++; row.pts += 3; } else row.lost++;
  }
}

export const sortStandings = (table: Standing[]): Standing[] =>
  [...table].sort((x, y) => y.pts - x.pts || (y.scored - y.conceded) - (x.scored - x.conceded) || y.scored - x.scored);

/** Disputa completa entre dois clubes simulados, com as mesmas regras de cobrança. */
export function simulateShootout(home: Team, away: Team, rng: Rng): [number, number] {
  const s = new Shootout();
  while (!s.winner()) {
    const [shooter, keeper] = s.next === 'a' ? [home, away] : [away, home];
    s.record(simulateKick(shooter.strength, keeperFromRating(keeper.keeper), 0.3, rng).result === 'goal');
  }
  return [s.goals('a'), s.goals('b')];
}
