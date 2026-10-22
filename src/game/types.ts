export type Rng = () => number;

export type Weather = 'clear' | 'rain' | 'snow' | 'fog';

/** 0 inferior esq., 1 superior esq., 2 centro, 3 superior dir., 4 inferior dir. */
export type Zone = 0 | 1 | 2 | 3 | 4;
export type Grade = 'perfect' | 'good' | 'ok' | 'bad';
export type KickResult = 'goal' | 'saved' | 'post' | 'miss';
export type Side = -1 | 0 | 1;

/** Coordenadas normalizadas do gol: x de -1 (trave esq.) a 1 (trave dir.), y de 0 (chão) a 1 (travessão). */
export interface GoalPoint { x: number; y: number }

export interface Attributes { precision: number; power: number; curve: number; composure: number }
export type AttrKey = keyof Attributes;

/** Índices nas paletas de data/appearance; `boots` é opcional para carreiras antigas. */
export interface Appearance { skin: number; hair: number; hairColor: number; boots?: number }

export interface PlayerIdentity {
  name: string;
  nationality: string;
  number: number;
  appearance: Appearance;
  /** Estilo de cobrança escolhido na criação: o atributo que começa mais alto. */
  style?: AttrKey;
}

export interface KeeperProfile { reach: number; read: number }

/** `wobble`: amplitude do tremor do marcador sob pressão (reduzida pelo sangue-frio). */
export interface MeterParams { center: number; halfWidth: number; speed: number; wobble: number }

/** Quão cedo o goleiro reagiu durante o voo da bola. */
export type Reaction = 'fast' | 'good' | 'late' | 'none';

/** Defesa do usuário: lado do mergulho e fração do voo (0..1) já percorrida ao reagir; null = não reagiu. */
export interface Defense { side: Side | null; at: number | null }

export interface KickOutcome {
  result: KickResult;
  grade: Grade;
  zone: Zone;
  target: GoalPoint;
  point: GoalPoint;
  speed: number;
  dive: Side;
  saveChance: number;
}

export interface DefendedKick extends KickOutcome {
  reaction: Reaction;
}

/** Clube ou seleção: tudo que entra em campo numa disputa. */
export interface Team {
  id: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  /** Qualidade dos cobradores, 0..1 */
  strength: number;
  /** Qualidade do goleiro, 0..1 */
  keeper: number;
}

export interface Club extends Team {
  city: string;
  /** Liga de origem (acesso e rebaixamento ficam em Career.leagueOf) */
  league: string;
  /** Reputação mínima para o clube fazer uma proposta */
  minReputation: number;
}

export interface League { id: string; name: string; country: string; tier: number; continent: 'sa' | 'eu' }

export interface Nation extends Team { confed: 'CONMEBOL' | 'UEFA' | 'CONCACAF' | 'CAF' | 'AFC' }

export type ObjectiveId = 'win' | 'score_all' | 'score_3' | 'perfect' | 'top_corner' | 'save_one';
export interface Objective { id: ObjectiveId; text: string }

export interface Standing { clubId: string; played: number; won: number; lost: number; pts: number; scored: number; conceded: number }

export type CompKind = 'league' | 'cup' | 'continental' | 'national';

/**
 * Uma competição da temporada. Pontos corridos usam schedule/standings; grupos também
 * (e viram mata-mata ao fim); o mata-mata guarda as equipes vivas em pares consecutivos.
 */
export interface Competition {
  id: string;
  kind: CompKind;
  name: string;
  format: 'league' | 'groups' | 'knockout';
  teams: string[];
  schedule: [string, string][][];
  standings: Standing[];
  groups: string[][];
  bracket: string[];
  /** Rodadas jogadas na fase atual */
  round: number;
  champion: string | null;
  /** Fase em que o time do jogador caiu */
  exit: string | null;
}

export interface MatchRecord {
  season: number;
  comp: string;
  stage: string;
  /** Clube ou seleção pela qual o jogador atuou */
  teamId: string;
  opponentId: string;
  scoreFor: number;
  scoreAgainst: number;
  won: boolean;
  goals: number;
  kicks: number;
  objectiveMet: boolean;
}

export interface Trophy { season: number; name: string; clubId: string }

/** Salário por partida de clube e última temporada do vínculo. */
export interface Contract { salary: number; until: number }

export interface Offer { clubId: string; salary: number; seasons: number; renewal: boolean }

export interface CareerStats { goals: number; kicks: number; saves: number; caps: number }

export interface Career {
  identity: PlayerIdentity;
  age: number;
  clubId: string;
  contract: Contract;
  attributes: Attributes;
  level: number;
  xp: number;
  skillPoints: number;
  money: number;
  reputation: number;
  season: number;
  /** Competições da temporada atual */
  comps: Competition[];
  /** Próximas partidas do jogador, em ordem (ids de comps); vazio = temporada encerrada */
  calendar: string[];
  /** Convocado para o torneio de seleções desta temporada */
  calledUp: boolean;
  /** Acesso/rebaixamento: liga atual de clubes que mudaram de divisão */
  leagueOf: Record<string, string>;
  /** Classificado para o torneio continental da próxima temporada */
  continental: boolean;
  history: MatchRecord[];
  trophies: Trophy[];
  matchesPlayed: number;
  stats: CareerStats;
  news: string[];
  /** Janela de transferências do fim da temporada */
  offers: Offer[];
  /** Loja: itens comprados e equipados por slot (opcional para saves antigos) */
  wardrobe?: { owned: string[]; equipped: Partial<Record<string, string>> };
}

export interface MatchStats {
  won: boolean;
  scoreFor: number;
  scoreAgainst: number;
  goals: number;
  kicks: number;
  decisiveGoals: number;
  perfects: number;
  topCornerGoals: number;
  saves: number;
  objectiveMet: boolean;
  userKicks: KickOutcome[];
  /** Imprevistos e clima que marcaram a partida (ids de MatchEvents) */
  events: string[];
  /** Raids: alvos temáticos derrubados com a bola */
  targets?: number;
}
