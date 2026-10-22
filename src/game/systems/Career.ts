import { CLUBS, CONTINENTAL_CUPS, DOMESTIC_CUPS, getClub, getLeague, getTeam, STARTING_CLUB_ID } from '../data/clubs';
import { COPA_AMERICA, COPA_AMERICA_TEAMS, EURO, nationByName, NATIONS, WORLD_CUP } from '../data/nations';
import { gearBonus, getItem, type Equipped } from '../data/shop';
import { EARTH, getSpecial, type SpecialId } from '../data/specials';
import type { AttrKey, Attributes, Career, Club, CompKind, Competition, MatchStats, Objective, Offer, PlayerIdentity, Rng, Team, Weather } from '../types';
import { alive, fixtureFor, groupsComp, knockoutComp, leagueComp, maxMatches, playRound, positionOf, simulateRest, stageLabel, type Sim } from './Competition';
import { simulateShootout, sortStandings } from './League';
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
/** Convocação: overall OU reputação a partir destes valores. */
export const CALL_UP = { overall: 60, reputation: 45 };

const OBJECTIVES: Objective[] = [
  { id: 'win', text: 'Vença a disputa' },
  { id: 'score_3', text: 'Marque pelo menos 3 gols' },
  { id: 'perfect', text: 'Acerte uma cobrança perfeita' },
  { id: 'top_corner', text: 'Marque um gol no ângulo' },
  { id: 'score_all', text: 'Converta todas as suas cobranças' },
  { id: 'save_one', text: 'Defenda pelo menos uma cobrança' },
];

/** Manchetes dos imprevistos que viram notícia (os ids vêm de scenes/MatchEvents). */
const EVENT_NEWS: Record<string, string> = {
  invader: 'Torcedor invade o campo',
  dog: 'Cachorro invade o gramado',
  blackout: 'Apagão nos refletores',
  raid: 'Raid! O cobrador foi abduzido no meio da disputa',
};

const COMP_WEIGHT: Record<CompKind, number> = { league: 1, cup: 1.2, continental: 1.6, national: 2 };
export const KIND_LABEL: Record<CompKind, string> = { league: 'Liga', cup: 'Copa nacional', continental: 'Continental', national: 'Seleção' };

export const overall = (a: Attributes) =>
  Math.round(a.precision * 0.3 + a.power * 0.25 + a.curve * 0.2 + a.composure * 0.25);
export const xpForLevel = (level: number) => 80 + level * 25;
/** Treinar fica bem mais caro acima de 60: com salário de clube grande, o dinheiro continua valendo. */
export const trainingCost = (value: number) => 100 + value * 8 + Math.max(0, value - 60) ** 2 * 6;
/** Salário por partida de clube: cresce com a força do clube e com o seu overall. */
export const salaryFor = (club: Club, ovr: number) => Math.round(((150 + club.strength ** 2 * 2500) * (0.6 + ovr / 100)) / 10) * 10;
const NATIONAL_PAY = 1200;

const shuffle = <T,>(arr: T[], rng: Rng): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const simFor = (rng: Rng): Sim => (h, a) => simulateShootout(getTeam(h), getTeam(a), rng);

export const leagueIdOf = (c: Career, clubId: string) => c.leagueOf[clubId] ?? getClub(clubId).league;
export const clubsInLeague = (c: Career, leagueId: string) => CLUBS.filter((cl) => leagueIdOf(c, cl.id) === leagueId).map((cl) => cl.id);
export const myNation = (c: Career) => nationByName(c.identity.nationality);
/** Time do jogador numa competição: a seleção nos torneios de seleções, o clube no resto. */
export const myTeamIn = (c: Career, comp: Competition) => (comp.kind === 'national' ? myNation(c).id : c.clubId);
export const leagueOfSeason = (c: Career) => c.comps.find((x) => x.kind === 'league')!;
export const seasonOver = (c: Career) => c.calendar.length === 0;
export const isCalledUp = (c: Career) => overall(c.attributes) >= CALL_UP.overall || c.reputation >= CALL_UP.reputation;

/** Torneio de seleções da temporada, se houver: Copa do Mundo a cada 4, continental no meio do ciclo. */
function nationalTournament(c: Career, rng: Rng): Competition | null {
  const me = myNation(c);
  const strongest = (pool: string[], n: number) => {
    const others = pool.filter((id) => id !== me.id).map((id) => getTeam(id)).sort((a, b) => b.strength - a.strength);
    return [me.id, ...others.slice(0, n - 1).map((t) => t.id)];
  };
  if (c.season % 4 === 0) {
    const teams = shuffle(strongest(NATIONS.map((x) => x.id), 16), rng);
    return groupsComp('nat', 'national', WORLD_CUP, [0, 1, 2, 3].map((g) => teams.slice(g * 4, g * 4 + 4)));
  }
  if (c.season % 4 !== 2) return null;
  if (me.confed === 'UEFA') return knockoutComp('nat', 'national', EURO, shuffle(strongest(NATIONS.filter((x) => x.confed === 'UEFA').map((x) => x.id), 8), rng));
  if (COPA_AMERICA_TEAMS.includes(me.id)) return knockoutComp('nat', 'national', COPA_AMERICA, shuffle(strongest(COPA_AMERICA_TEAMS, 8), rng));
  return null;
}

/** Monta as competições e o calendário da temporada `c.season` para o clube atual. */
function setupSeason(c: Career, rng: Rng): void {
  const club = getClub(c.clubId);
  const league = getLeague(leagueIdOf(c, club.id));
  const comps: Competition[] = [leagueComp('league', 'league', league.name, shuffle(clubsInLeague(c, league.id), rng))];
  const compatriots = CLUBS.filter((cl) => getLeague(cl.league).country === league.country && cl.id !== club.id).map((cl) => cl.id);
  comps.push(knockoutComp('cup', 'cup', DOMESTIC_CUPS[league.country], shuffle([club.id, ...shuffle(compatriots, rng).slice(0, 7)], rng)));
  if (c.continental) {
    const elite = CLUBS.filter((cl) => getLeague(cl.league).continent === league.continent && cl.id !== club.id)
      .sort((a, b) => b.strength - a.strength).slice(0, 12).map((cl) => cl.id);
    comps.push(knockoutComp('cont', 'continental', CONTINENTAL_CUPS[league.continent], shuffle([club.id, ...shuffle(elite, rng).slice(0, 7)], rng)));
  }
  const national = nationalTournament(c, rng);
  c.calledUp = !!national && isCalledUp(c);
  if (national) {
    comps.push(national);
    c.news.unshift(c.calledUp
      ? `Convocação! ${c.identity.name} vai defender a seleção (${myNation(c).name}) na ${national.name}.`
      : `${national.name}: ${c.identity.name} não foi convocado (precisa de overall ${CALL_UP.overall} ou reputação ${CALL_UP.reputation}).`);
  }
  c.comps = comps;
  // Copas espalhadas entre as rodadas da liga; o torneio de seleções fecha a temporada.
  const items: { id: string; t: number }[] = [];
  for (const comp of comps.filter((x) => x.kind !== 'national')) {
    const n = maxMatches(comp);
    for (let i = 0; i < n; i++) items.push({ id: comp.id, t: (i + (comp.kind === 'league' ? 0.5 : 0.8)) / n });
  }
  c.calendar = items.sort((a, b) => a.t - b.t).map((x) => x.id);
  if (national && c.calledUp) for (let i = 0; i < maxMatches(national); i++) c.calendar.push(national.id);
  c.offers = [];
}

export function createCareer(identity: PlayerIdentity, rng: Rng = Math.random): Career {
  const base = () => 38 + Math.floor(rng() * 8);
  const attributes: Attributes = { precision: base(), power: base(), curve: base(), composure: base() };
  if (identity.style) attributes[identity.style] += STYLE_BONUS;
  const club = getClub(STARTING_CLUB_ID);
  const c: Career = {
    identity, age: 18, clubId: club.id,
    contract: { salary: salaryFor(club, overall(attributes)), until: 2 },
    attributes, level: 1, xp: 0, skillPoints: 0, money: 250, reputation: 2, season: 1,
    comps: [], calendar: [], calledUp: false, leagueOf: {}, continental: false,
    history: [], trophies: [], matchesPlayed: 0, stats: { goals: 0, kicks: 0, saves: 0, caps: 0 },
    news: [`${identity.name} assina o primeiro contrato profissional com o ${club.name}.`], offers: [],
  };
  setupSeason(c, rng);
  return c;
}

export interface Fixture {
  comp: Competition;
  stage: string;
  /** Time do jogador nesta partida (clube ou seleção) */
  team: Team;
  opponent: Team;
  home: boolean;
  objective: Objective;
  difficulty: number;
}

export function nextFixture(c: Career): Fixture | null {
  if (seasonOver(c)) return null;
  const comp = c.comps.find((x) => x.id === c.calendar[0]);
  const f = comp && fixtureFor(comp, myTeamIn(c, comp));
  if (!comp || !f) return null;
  const opponent = getTeam(f.opponent);
  return {
    comp, stage: stageLabel(comp), team: getTeam(myTeamIn(c, comp)), opponent, home: f.home,
    objective: OBJECTIVES[(c.matchesPlayed + c.season) % OBJECTIVES.length],
    difficulty: Math.min(1, opponent.strength + c.reputation / 400),
  };
}

// ---------- Loja ----------

export const wardrobeOf = (c: Career) => c.wardrobe ?? { owned: [], equipped: {} };
export const equipped = (c: Career) => wardrobeOf(c).equipped as Equipped;

/** Atributos em campo: base + bônus dos itens equipados (chuteiras raras). */
export function effectiveAttributes(c: Career): Attributes {
  const bonus = gearBonus(equipped(c));
  const out = { ...c.attributes };
  for (const k of ATTR_KEYS) out[k] = Math.min(MAX_ATTR, out[k] + (bonus[k] ?? 0));
  return out;
}

export type BuyResult = { ok: true; career: Career } | { ok: false; reason: string };

/** Compra e já equipa o item. */
export function buyItem(prev: Career, id: string): BuyResult {
  const item = getItem(id);
  if (!item) return { ok: false, reason: 'Item inexistente' };
  const w = wardrobeOf(prev);
  if (w.owned.includes(id)) return { ok: false, reason: 'Você já tem este item' };
  if ((item.minRep ?? 0) > prev.reputation) return { ok: false, reason: `Disponível com reputação ${item.minRep}` };
  if (prev.money < item.price) return { ok: false, reason: 'Saldo insuficiente' };
  const c = structuredClone(prev);
  c.money -= item.price;
  c.wardrobe = { owned: [...w.owned, id], equipped: { ...w.equipped, [item.slot]: id } };
  return { ok: true, career: c };
}

/** Equipa um item comprado, ou desequipa se já estiver em uso. */
export function toggleEquip(prev: Career, id: string): Career {
  const item = getItem(id);
  const w = wardrobeOf(prev);
  if (!item || !w.owned.includes(id)) return prev;
  const c = structuredClone(prev);
  const eq = { ...w.equipped };
  if (eq[item.slot] === id) delete eq[item.slot];
  else eq[item.slot] = id;
  c.wardrobe = { owned: [...w.owned], equipped: eq };
  return c;
}

// ---------- Partida ----------

/** Clima sorteado para a partida; neve só na Europa. */
export function pickWeather(c: Career, f: Fixture, rng: Rng = Math.random): Weather {
  const europe = f.comp.kind === 'national' ? myNation(c).confed === 'UEFA' : getLeague(leagueIdOf(c, c.clubId)).continent === 'eu';
  const r = rng();
  if (r < 0.18) return 'rain';
  if (r < 0.24) return 'fog';
  if (europe && r < 0.31) return 'snow';
  return 'clear';
}

export function matchSetup(c: Career, f: Fixture, weather: Weather = 'clear'): MatchSetup {
  // Chuva: goleiros escorregam; neve: barra mais nervosa e goleiros um pouco mais lentos.
  const grip = weather === 'rain' ? 0.94 : weather === 'snow' ? 0.97 : 1;
  const oppKeeper = keeperFromRating(f.opponent.keeper + c.reputation / 500);
  const ownKeeper = keeperFromRating(f.team.keeper);
  return {
    club: f.team,
    opponent: f.opponent,
    attrs: effectiveAttributes(c),
    difficulty: Math.min(1, f.difficulty + (weather === 'snow' ? 0.05 : 0)),
    oppSkill: Math.min(0.95, f.opponent.strength + c.reputation / 500),
    oppKeeper: { ...oppKeeper, reach: oppKeeper.reach * grip },
    ownKeeper: { ...ownKeeper, reach: ownKeeper.reach * grip },
    objective: f.objective,
    weather,
  };
}

export interface Rewards { xp: number; money: number; reputation: number; levelsGained: number; pointsGained: number; titles: string[] }

/** Peso da divisão na reputação: brilhar na Premier League vale mais que na Série B. */
const tierOf = (c: Career, kind: CompKind) => (kind === 'national' ? 3 : getLeague(leagueIdOf(c, c.clubId)).tier);

export function computeRewards(c: Career, s: MatchStats, kind: CompKind): Pick<Rewards, 'xp' | 'money' | 'reputation'> {
  const pay = kind === 'national' ? NATIONAL_PAY : c.contract.salary;
  const rep = ((s.won ? 1.2 : -0.4) + (s.objectiveMet ? 0.4 : 0) + s.decisiveGoals * 0.3) * COMP_WEIGHT[kind] * (0.7 + tierOf(c, kind) * 0.15);
  return {
    xp: 20 + s.goals * 10 + s.saves * 12 + s.decisiveGoals * 15 + (s.objectiveMet ? 30 : 0) + (s.won ? 40 : 0),
    money: Math.round(pay * (1 + (s.won ? 0.5 : 0) + s.goals * 0.1 + (s.objectiveMet ? 0.5 : 0))),
    reputation: Math.round(rep),
  };
}

/** Reputação por título: liga e copa crescem com a divisão; Copa do Mundo é o topo. */
function titleRep(c: Career, comp: Competition): number {
  const tier = tierOf(c, comp.kind);
  if (comp.kind === 'league') return 3 + tier * 2;
  if (comp.kind === 'cup') return Math.round(2 + tier * 1.5);
  if (comp.kind === 'continental') return 12;
  return comp.name === WORLD_CUP ? 24 : 12;
}

function awardTitle(c: Career, comp: Competition, teamId: string): void {
  c.trophies.push({ season: c.season, name: comp.name, clubId: teamId });
  c.reputation = Math.min(100, c.reputation + titleRep(c, comp));
  c.news.unshift(`Título! ${getTeam(teamId).name} é campeão: ${comp.name} (temporada ${c.season}).`);
}

/** Soma XP e sobe de nível quantas vezes couber; retorna os níveis ganhos. */
function gainXp(c: Career, xp: number): number {
  c.xp += xp;
  const start = c.level;
  while (c.xp >= xpForLevel(c.level)) {
    c.xp -= xpForLevel(c.level);
    c.level++;
    c.skillPoints += POINTS_PER_LEVEL;
  }
  return c.level - start;
}

/** Partida de raid: não conta na temporada; vale troféu, dinheiro, XP e uma boa história. */
export function applyRaid(prev: Career, s: MatchStats, id: SpecialId): { career: Career; rewards: Rewards } {
  const sp = getSpecial(id);
  if (!sp) throw new Error(`Raid desconhecido: ${id}`);
  const c: Career = structuredClone(prev);
  const xp = 40 + s.goals * 10 + s.saves * 12 + (s.won ? 80 : 0);
  const money = s.won ? 6000 : 1500;
  const reputation = s.won ? 4 : 1;
  c.money += money;
  c.reputation = Math.min(100, c.reputation + reputation);
  const levelsGained = gainXp(c, xp);
  c.stats.goals += s.goals;
  c.stats.kicks += s.kicks;
  c.stats.saves += s.saves;
  if (s.won) c.trophies.push({ season: c.season, name: sp.trophy, clubId: EARTH.id });
  c.news.unshift(s.won
    ? `${sp.title.replace('!', '')}: ${c.identity.name} vence o ${sp.team.name} (${s.scoreFor} x ${s.scoreAgainst}) e volta à Terra com a ${sp.trophy}!`
    : `${sp.title.replace('!', '')}: derrota para o ${sp.team.name} (${s.scoreFor} x ${s.scoreAgainst}), mas ${c.identity.name} voltou à Terra.`);
  c.news = c.news.slice(0, 14);
  return { career: c, rewards: { xp, money, reputation, levelsGained, pointsGained: levelsGained * POINTS_PER_LEVEL, titles: s.won ? [sp.trophy] : [] } };
}

/** Aplica o resultado da partida do jogador, avança a competição e a temporada. Retorna uma nova carreira. */
export function applyMatch(prev: Career, s: MatchStats, rng: Rng = Math.random): { career: Career; rewards: Rewards } {
  const c: Career = structuredClone(prev);
  const f = nextFixture(c);
  if (!f) throw new Error('Temporada encerrada');
  const comp = f.comp;
  const me = f.team.id;
  const r = computeRewards(c, s, comp.kind);

  c.money += r.money;
  c.reputation = Math.max(0, Math.min(100, c.reputation + r.reputation));
  const levelsGained = gainXp(c, r.xp);

  playRound(comp, me, [s.scoreFor, s.scoreAgainst], simFor(rng));
  c.calendar.shift();
  if (!alive(comp, me)) c.calendar = c.calendar.filter((id) => id !== comp.id);
  const titles: string[] = [];
  if (comp.champion === me) {
    awardTitle(c, comp, me);
    titles.push(comp.name);
  }

  c.history.unshift({
    season: c.season, comp: comp.name, stage: f.stage, teamId: me, opponentId: f.opponent.id,
    scoreFor: s.scoreFor, scoreAgainst: s.scoreAgainst, won: s.won, goals: s.goals, kicks: s.kicks, objectiveMet: s.objectiveMet,
  });
  c.history = c.history.slice(0, 40);
  for (const ev of s.events) {
    if (EVENT_NEWS[ev]) c.news.unshift(`${EVENT_NEWS[ev]} em ${f.team.name} x ${f.opponent.name}.`);
  }
  c.stats.goals += s.goals;
  c.stats.kicks += s.kicks;
  c.stats.saves += s.saves;
  if (comp.kind === 'national') c.stats.caps++;
  c.matchesPlayed++;
  if (seasonOver(c)) finishSeason(c, rng);

  return { career: c, rewards: { ...r, levelsGained, pointsGained: levelsGained * POINTS_PER_LEVEL, titles } };
}

/** Acesso e rebaixamento no Brasil: 2 primeiros da Série B sobem, 2 últimos da Série A descem. */
function promotion(c: Career, league: Competition, sim: Sim, rng: Rng): void {
  const mine = leagueIdOf(c, c.clubId);
  if (mine !== 'br-a' && mine !== 'br-b') return;
  const other = leagueComp('x', 'league', '', shuffle(clubsInLeague(c, mine === 'br-a' ? 'br-b' : 'br-a'), rng));
  simulateRest(other, sim);
  const [serieB, serieA] = mine === 'br-b' ? [league, other] : [other, league];
  const up = sortStandings(serieB.standings).slice(0, 2).map((s) => s.clubId);
  const down = sortStandings(serieA.standings).slice(-2).map((s) => s.clubId);
  up.forEach((id) => (c.leagueOf[id] = 'br-a'));
  down.forEach((id) => (c.leagueOf[id] = 'br-b'));
  c.news.unshift(`Acesso: ${up.map((id) => getTeam(id).name).join(' e ')} sobem para a Série A; ${down.map((id) => getTeam(id).name).join(' e ')} caem.`);
  if (up.includes(c.clubId)) c.reputation = Math.min(100, c.reputation + 3);
}

function makeOffers(c: Career, rng: Rng): Offer[] {
  const club = getClub(c.clubId);
  const ovr = overall(c.attributes);
  const pool = CLUBS.filter((cl) => cl.id !== club.id && cl.minReputation <= c.reputation && cl.strength >= club.strength - 0.04)
    .sort((a, b) => b.strength - a.strength);
  const picks = pool.slice(0, 2);
  const rest = pool.slice(2);
  if (rest.length) picks.push(rest[Math.floor(rng() * rest.length)]);
  return [
    { clubId: club.id, salary: Math.max(c.contract.salary, salaryFor(club, ovr)), seasons: 2, renewal: true },
    ...picks.map((cl) => ({ clubId: cl.id, salary: salaryFor(cl, ovr), seasons: 2 + (rng() < 0.5 ? 1 : 0), renewal: false })),
  ];
}

function finishSeason(c: Career, rng: Rng): void {
  const sim = simFor(rng);
  for (const comp of c.comps) {
    if (!comp.champion) simulateRest(comp, sim);
    const mine = myTeamIn(c, comp);
    if (comp.champion && comp.champion !== mine) c.news.unshift(`${comp.name}: ${getTeam(comp.champion).name} é o campeão (temporada ${c.season}).`);
  }
  const league = leagueOfSeason(c);
  const pos = positionOf(league, c.clubId);
  const cupWon = c.comps.some((x) => x.kind === 'cup' && x.champion === c.clubId);
  c.continental = (getLeague(leagueIdOf(c, c.clubId)).tier >= 2 && pos <= 2) || cupWon;
  if (c.continental) c.news.unshift(`${getClub(c.clubId).name} garante vaga na ${CONTINENTAL_CUPS[getLeague(leagueIdOf(c, c.clubId)).continent]}.`);
  promotion(c, league, sim, rng);
  c.offers = makeOffers(c, rng);
  c.news = c.news.slice(0, 14);
}

/** Fecha a janela de transferências e inicia a temporada seguinte no clube escolhido. */
export function startNextSeason(prev: Career, clubId?: string, rng: Rng = Math.random): Career {
  if (!seasonOver(prev)) throw new Error('Temporada em andamento');
  const c: Career = structuredClone(prev);
  const offer = c.offers.find((o) => o.clubId === (clubId ?? c.clubId)) ?? c.offers.find((o) => o.renewal);
  if (clubId && !c.offers.some((o) => o.clubId === clubId)) throw new Error('Proposta inexistente');
  c.season++;
  c.age++;
  if (offer) {
    if (!offer.renewal) {
      const from = getClub(c.clubId).name;
      c.clubId = offer.clubId;
      c.money += offer.salary * 2; // luvas
      c.continental = false; // a vaga era do clube antigo
      c.news.unshift(`Transferência: ${c.identity.name} deixa o ${from} e assina com o ${getClub(offer.clubId).name}.`);
    }
    c.contract = { salary: offer.salary, until: c.season + offer.seasons - 1 };
  }
  setupSeason(c, rng);
  c.news = c.news.slice(0, 14);
  return c;
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

/** Carreira do formato antigo (clubes fictícios): mantém o jogador e o leva a um clube real equivalente. */
export function migrateV1(old: any, rng: Rng = Math.random): Career {
  const c = createCareer(old.identity, rng);
  const keep = ['attributes', 'level', 'xp', 'skillPoints', 'money', 'reputation', 'age', 'season', 'matchesPlayed'] as const;
  for (const k of keep) (c as any)[k] = old[k];
  c.trophies = old.trophies ?? [];
  const rep = c.reputation;
  c.clubId = rep >= 30 ? 'porto' : rep >= 15 ? 'gremio' : STARTING_CLUB_ID;
  c.contract = { salary: salaryFor(getClub(c.clubId), overall(c.attributes)), until: c.season + 1 };
  c.news = [`Nova era: o mundo do jogo agora tem clubes reais. ${c.identity.name} segue a carreira no ${getClub(c.clubId).name}.`];
  setupSeason(c, rng);
  return c;
}
