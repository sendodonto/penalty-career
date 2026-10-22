import type { CompKind, Competition } from '../types';
import { applyResult, emptyStandings, roundRobin, sortStandings } from './League';

/** Resultado de uma disputa entre dois times que o jogador não está jogando. */
export type Sim = (home: string, away: string) => [number, number];

const base = (id: string, kind: CompKind, name: string, teams: string[]): Competition => ({
  id, kind, name, format: 'league', teams, schedule: [], standings: emptyStandings(teams),
  groups: [], bracket: [], round: 0, champion: null, exit: null,
});

export const leagueComp = (id: string, kind: CompKind, name: string, teams: string[]): Competition =>
  ({ ...base(id, kind, name, teams), schedule: roundRobin(teams) });

/** Mata-mata: `teams` já na ordem do chaveamento (pares consecutivos); tamanho potência de 2. */
export const knockoutComp = (id: string, kind: CompKind, name: string, teams: string[]): Competition =>
  ({ ...base(id, kind, name, teams), format: 'knockout', bracket: [...teams] });

/** Grupos de 4 em turno único; os dois primeiros de cada grupo vão ao mata-mata cruzado. */
export function groupsComp(id: string, kind: CompKind, name: string, groups: string[][]): Competition {
  const rounds = groups.map((g) => roundRobin(g));
  const schedule = rounds[0].map((_, r) => rounds.flatMap((g) => g[r]));
  return { ...base(id, kind, name, groups.flat()), format: 'groups', groups, schedule };
}

const KO_NAMES: Record<number, string> = { 2: 'Final', 4: 'Semifinal', 8: 'Quartas de final', 16: 'Oitavas de final' };

export function stageLabel(c: Competition): string {
  if (c.champion) return 'Encerrada';
  if (c.format === 'league') return `Rodada ${c.round + 1} de ${c.schedule.length}`;
  if (c.format === 'groups') return `Fase de grupos · ${c.round + 1}º jogo`;
  return KO_NAMES[c.bracket.length] ?? 'Mata-mata';
}

/** Próximo adversário de `me` na competição (null se não joga mais nela). */
export function fixtureFor(c: Competition, me: string): { opponent: string; home: boolean } | null {
  if (c.champion) return null;
  if (c.format === 'knockout') {
    const i = c.bracket.indexOf(me);
    if (i < 0) return null;
    return { opponent: c.bracket[i % 2 ? i - 1 : i + 1], home: i % 2 === 0 };
  }
  const pair = c.schedule[c.round]?.find((p) => p.includes(me));
  return pair ? { opponent: pair[0] === me ? pair[1] : pair[0], home: pair[0] === me } : null;
}

/**
 * Joga uma rodada inteira: o placar de `me` vem de `mine` (gols pró, contra) e os demais jogos
 * são simulados. Ao fim dos grupos monta o mata-mata; ao fim de tudo define o campeão.
 */
export function playRound(c: Competition, me: string | null, mine: [number, number] | null, sim: Sim): void {
  if (c.champion) return;
  const score = (a: string, b: string): [number, number] => {
    if (me && mine && a === me) return mine;
    if (me && mine && b === me) return [mine[1], mine[0]];
    return sim(a, b);
  };
  if (c.format === 'knockout') {
    const stage = stageLabel(c);
    const winners: string[] = [];
    for (let i = 0; i < c.bracket.length; i += 2) {
      const [a, b] = [c.bracket[i], c.bracket[i + 1]];
      const [ga, gb] = score(a, b);
      winners.push(ga > gb ? a : b);
      if (me && (a === me || b === me) && winners[winners.length - 1] !== me) c.exit = stage;
    }
    c.bracket = winners;
    c.round++;
    if (winners.length === 1) c.champion = winners[0];
    return;
  }
  for (const [h, a] of c.schedule[c.round]) {
    const [gh, ga] = score(h, a);
    applyResult(c.standings, h, a, gh, ga);
  }
  c.round++;
  if (c.round < c.schedule.length) return;
  if (c.format === 'league') {
    c.champion = sortStandings(c.standings)[0].clubId;
    return;
  }
  const top = c.groups.map((g) => sortStandings(c.standings.filter((s) => g.includes(s.clubId))).slice(0, 2).map((s) => s.clubId));
  const bracket: string[] = [];
  for (let i = 0; i < top.length; i += 2) bracket.push(top[i][0], top[i + 1][1], top[i + 1][0], top[i][1]);
  if (me && c.teams.includes(me) && !bracket.includes(me)) c.exit = 'Fase de grupos';
  c.format = 'knockout';
  c.bracket = bracket;
  c.round = 0;
}

/** O time ainda tem jogos a fazer nesta competição. */
export const alive = (c: Competition, me: string) => fixtureFor(c, me) !== null;

export function simulateRest(c: Competition, sim: Sim): void {
  for (let guard = 0; !c.champion && guard < 64; guard++) playRound(c, null, null, sim);
}

/** Jogos que um time pode disputar (chegando à final), para montar o calendário. */
export function maxMatches(c: Competition): number {
  if (c.format === 'league') return c.schedule.length;
  if (c.format === 'groups') return c.schedule.length + Math.log2(c.groups.length * 2);
  return Math.log2(c.bracket.length);
}

/** Posição de `me` na tabela (liga) ou no grupo. */
export function positionOf(c: Competition, me: string): number {
  const pool = c.groups.length ? c.standings.filter((s) => c.groups.find((g) => g.includes(me))?.includes(s.clubId)) : c.standings;
  return sortStandings(pool).findIndex((s) => s.clubId === me) + 1;
}
