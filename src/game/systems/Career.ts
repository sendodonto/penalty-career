import { CLUBS, getClub, LEAGUE_NAMES, leagueClubs, STARTING_CLUB_ID } from '../data/clubs';
import type { AttrKey, Attributes, Career, Club, MatchStats, Objective, PlayerIdentity, Rng } from '../types';
import { applyResult, emptyStandings, roundRobin, simulateShootout, sortStandings } from './League';
import type { MatchSetup } from './MatchManager';
import { keeperFromRating } from './PenaltyResolver';

export const ATTR_LABELS: Record<AttrKey, string> = {
  precision: 'Precisão',
  power: 'Potência',
  curve: 'Curva',
  composure: 'Sangue-frio',
};
export const ATTR_HINTS: Record<AttrKey, string> = {
  precision: 'Alarga a zona ideal e reduz o desvio',
  power: 'Chute mais rápido, menos tempo para o goleiro',
  curve: 'Bola mais fechada nos cantos, difícil de alcançar',
  composure: 'Barra mais lenta e firme sob pressão',
};
export const ATTR_KEYS = Object.keys(ATTR_LABELS) as AttrKey[];

/** Estilos de cobrança da criação: cada um começa com o seu atributo mais alto. */
export const PLAYING_STYLES: Record<AttrKey, { name: string; text: string }> = {
  precision: { name: 'Colocado', text: 'Escolhe o canto com calma. Começa com mais Precisão.' },
  power: { name: 'Bomba', text: 'Bate forte, sem dar tempo ao goleiro. Começa com mais Potência.' },
  curve: { name: 'Curva', text: 'Bola com efeito, fechando no ângulo. Começa com mais Curva.' },
  composure: { name: 'Frio', text: 'Não treme na cobrança decisiva. Começa com mais Sangue-frio.' },
};
export const STYLE_BONUS = 6;
export const MAX_ATTR = 99;
export const POINTS_PER_LEVEL = 3;

const OBJECTIVES: Objective[] = [
  { id: 'win', text: 'Vença a disputa' },
  { id: 'score_3', text: 'Marque pelo menos 3 gols' },
  { id: 'perfect', text: 'Acerte uma cobrança perfeita' },
  { id: 'top_corner', text: 'Marque um gol no ângulo' },
  { id: 'score_all', text: 'Converta todas as suas cobranças' },
  { id: 'save_one', text: 'Defenda pelo menos uma cobrança' },
];

export const overall = (a: Attributes) =>
  Math.round(a.precision * 0.3 + a.power * 0.25 + a.curve * 0.2 + a.composure * 0.25);
export const xpForLevel = (level: number) => 80 + level * 40;
export const trainingCost = (value: number) => 100 + value * 8;
const TIER_PAY: Record<Club['tier'], number> = { 1: 1, 2: 1.8, 3: 3 };

function newSeason(clubId: string): Pick<Career, 'round' | 'schedule' | 'standings' | 'offers'> {
  const ids = leagueClubs(getClub(clubId).tier).map((cl) => cl.id);
  return { round: 0, schedule: roundRobin(ids), standings: emptyStandings(ids), offers: [] };
}

export function createCareer(identity: PlayerIdentity, rng: Rng = Math.random): Career {
  const base = () => 38 + Math.floor(rng() * 8);
  const attributes: Attributes = { precision: base(), power: base(), curve: base(), composure: base() };
  if (identity.style) attributes[identity.style] += STYLE_BONUS;
  return {
    identity,
    age: 18,
    clubId: STARTING_CLUB_ID,
    attributes,
    level: 1,
    xp: 0,
    skillPoints: 0,
    money: 250,
    reputation: 2,
    season: 1,
    history: [],
    trophies: [],
    matchesPlayed: 0,
    ...newSeason(STARTING_CLUB_ID),
  };
}

export const seasonOver = (c: Career) => c.round >= c.schedule.length;
export const leagueName = (c: Career) => LEAGUE_NAMES[getClub(c.clubId).tier];

export interface Fixture {
  opponent: Club;
  home: boolean;
  round: number;
  objective: Objective;
  difficulty: number;
}

export function nextFixture(c: Career): Fixture | null {
  if (seasonOver(c)) return null;
  const pair = c.schedule[c.round].find((p) => p.includes(c.clubId))!;
  const opponent = getClub(pair[0] === c.clubId ? pair[1] : pair[0]);
  return {
    opponent,
    home: pair[0] === c.clubId,
    round: c.round,
    objective: OBJECTIVES[(c.round + c.season * 2) % OBJECTIVES.length],
    difficulty: Math.min(1, opponent.strength + c.reputation / 400),
  };
}

export function matchSetup(c: Career, f: Fixture): MatchSetup {
  const club = getClub(c.clubId);
  return {
    club,
    opponent: f.opponent,
    attrs: { ...c.attributes },
    difficulty: f.difficulty,
    oppSkill: Math.min(0.95, f.opponent.strength + c.reputation / 500),
    oppKeeper: keeperFromRating(f.opponent.keeper + c.reputation / 500),
    ownKeeper: keeperFromRating(club.keeper),
    objective: f.objective,
  };
}

export interface Rewards { xp: number; money: number; reputation: number; levelsGained: number; pointsGained: number }

export function computeRewards(c: Career, s: MatchStats): Omit<Rewards, 'levelsGained' | 'pointsGained'> {
  const pay = TIER_PAY[getClub(c.clubId).tier];
  return {
    xp: 20 + s.goals * 10 + s.saves * 12 + s.decisiveGoals * 15 + (s.objectiveMet ? 30 : 0) + (s.won ? 40 : 0),
    money: Math.round(pay * ((s.won ? 300 : 100) + s.goals * 30 + (s.objectiveMet ? 150 : 0))),
    reputation: (s.won ? 3 : -1) + (s.objectiveMet ? 2 : 0) + s.decisiveGoals,
  };
}

/** Aplica o resultado da partida do jogador, simula a rodada e avança a carreira. Retorna uma nova carreira. */
export function applyMatch(prev: Career, s: MatchStats, rng: Rng = Math.random): { career: Career; rewards: Rewards } {
  const c: Career = structuredClone(prev);
  const f = nextFixture(c);
  if (!f) throw new Error('Temporada encerrada');
  const r = computeRewards(c, s);

  c.money += r.money;
  c.reputation = Math.max(0, Math.min(100, c.reputation + r.reputation));
  c.xp += r.xp;
  const startLevel = c.level;
  while (c.xp >= xpForLevel(c.level)) {
    c.xp -= xpForLevel(c.level);
    c.level++;
    c.skillPoints += POINTS_PER_LEVEL;
  }
  const levelsGained = c.level - startLevel;

  for (const [h, a] of c.schedule[c.round]) {
    if (h === c.clubId || a === c.clubId) {
      const [gh, ga] = f.home ? [s.scoreFor, s.scoreAgainst] : [s.scoreAgainst, s.scoreFor];
      applyResult(c.standings, h, a, gh, ga);
    } else {
      const [gh, ga] = simulateShootout(getClub(h), getClub(a), rng);
      applyResult(c.standings, h, a, gh, ga);
    }
  }

  c.history.unshift({
    season: c.season, round: c.round, clubId: c.clubId, opponentId: f.opponent.id,
    scoreFor: s.scoreFor, scoreAgainst: s.scoreAgainst, won: s.won,
    goals: s.goals, kicks: s.kicks, objectiveMet: s.objectiveMet,
  });
  c.history = c.history.slice(0, 30);
  c.matchesPlayed++;
  c.round++;
  if (seasonOver(c)) finishSeason(c);

  return { career: c, rewards: { ...r, levelsGained, pointsGained: levelsGained * POINTS_PER_LEVEL } };
}

export const leaguePosition = (c: Career) => sortStandings(c.standings).findIndex((s) => s.clubId === c.clubId) + 1;

function finishSeason(c: Career): void {
  const club = getClub(c.clubId);
  const champion = leaguePosition(c) === 1;
  if (champion) {
    c.trophies.push({ season: c.season, name: LEAGUE_NAMES[club.tier], clubId: club.id });
    c.reputation = Math.min(100, c.reputation + 8);
  }
  const offers = CLUBS
    .filter((cl) => cl.id !== club.id && cl.strength > club.strength && cl.minReputation <= c.reputation)
    .sort((x, y) => y.strength - x.strength)
    .slice(0, 2);
  if (champion && club.tier < 3 && !offers.some((o) => o.tier > club.tier)) {
    offers.push(leagueClubs((club.tier + 1) as Club['tier'])[0]);
  }
  c.offers = offers.map((o) => o.id);
}

/** Inicia a temporada seguinte, opcionalmente aceitando uma proposta. */
export function startNextSeason(prev: Career, acceptClubId?: string): Career {
  if (!seasonOver(prev)) throw new Error('Temporada em andamento');
  if (acceptClubId && !prev.offers.includes(acceptClubId)) throw new Error('Proposta inexistente');
  const clubId = acceptClubId ?? prev.clubId;
  return { ...structuredClone(prev), clubId, age: prev.age + 1, season: prev.season + 1, ...newSeason(clubId) };
}

export function spendSkillPoint(prev: Career, key: AttrKey): Career {
  if (prev.skillPoints <= 0 || prev.attributes[key] >= MAX_ATTR) return prev;
  const c = structuredClone(prev);
  c.skillPoints--;
  c.attributes[key]++;
  return c;
}

export function train(prev: Career, key: AttrKey): Career {
  const cost = trainingCost(prev.attributes[key]);
  if (prev.money < cost || prev.attributes[key] >= MAX_ATTR) return prev;
  const c = structuredClone(prev);
  c.money -= cost;
  c.attributes[key]++;
  return c;
}
