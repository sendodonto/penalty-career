export type Rng = () => number;

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

export interface Club {
  id: string;
  name: string;
  short: string;
  city: string;
  tier: 1 | 2 | 3;
  primary: string;
  secondary: string;
  /** Qualidade dos cobradores, 0..1 */
  strength: number;
  /** Qualidade do goleiro, 0..1 */
  keeper: number;
  /** Reputação mínima para o clube fazer uma proposta */
  minReputation: number;
}

export type ObjectiveId = 'win' | 'score_all' | 'score_3' | 'perfect' | 'top_corner' | 'save_one';
export interface Objective { id: ObjectiveId; text: string }

export interface Standing { clubId: string; played: number; won: number; lost: number; pts: number; scored: number; conceded: number }

export interface MatchRecord {
  season: number;
  round: number;
  clubId: string;
  opponentId: string;
  scoreFor: number;
  scoreAgainst: number;
  won: boolean;
  goals: number;
  kicks: number;
  objectiveMet: boolean;
}

export interface Trophy { season: number; name: string; clubId: string }

export interface Career {
  identity: PlayerIdentity;
  age: number;
  clubId: string;
  attributes: Attributes;
  level: number;
  xp: number;
  skillPoints: number;
  money: number;
  reputation: number;
  season: number;
  /** Índice da próxima rodada; igual a schedule.length quando a temporada acabou */
  round: number;
  schedule: [string, string][][];
  standings: Standing[];
  history: MatchRecord[];
  trophies: Trophy[];
  matchesPlayed: number;
  /** Preenchido ao fim da temporada: ids de clubes que fizeram proposta */
  offers: string[];
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
}
