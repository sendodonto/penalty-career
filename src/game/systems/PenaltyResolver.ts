import type { Attributes, DefendedKick, Defense, GoalPoint, Grade, KeeperProfile, KickOutcome, KickResult, MeterParams, Rng, Side, Zone } from '../types';
import { chooseDive, gradeReaction, reactionReach } from './GoalkeeperAI';

export const ZONE_TARGETS: GoalPoint[] = [
  { x: -0.78, y: 0.18 },
  { x: -0.74, y: 0.78 },
  { x: 0, y: 0.42 },
  { x: 0.74, y: 0.78 },
  { x: 0.78, y: 0.18 },
];

export const ZONE_NAMES = ['Inferior esquerdo', 'Ângulo esquerdo', 'Centro', 'Ângulo direito', 'Inferior direito'];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Barra de precisão: precisão alarga a zona ideal; pressão acelera o marcador e sangue-frio compensa. */
export function meterParams(attrs: Attributes, pressure: number, difficulty: number, rng: Rng): MeterParams {
  const comp = attrs.composure / 100;
  return {
    center: 0.55 + rng() * 0.3,
    halfWidth: 0.028 + attrs.precision * 0.0005,
    speed: 1.1 + difficulty * 0.4 + pressure * 0.6 * (1 - comp) - comp * 0.3,
    wobble: pressure * (1 - comp) * 0.045,
  };
}

/** Posição do marcador (0..1) num vai-e-vem contínuo, `t` em segundos; sob pressão ele treme. */
export function meterPosition(t: number, speed: number, wobble = 0): number {
  const p = (t * speed) % 2;
  const base = p <= 1 ? p : 2 - p;
  return clamp(base + wobble * Math.sin(t * 11) * Math.sin(t * 4.3 + 1), 0, 1);
}

export function gradeTiming(error: number, halfWidth: number): Grade {
  const a = Math.abs(error);
  return a <= halfWidth ? 'perfect' : a <= halfWidth * 2.5 ? 'good' : a <= halfWidth * 5 ? 'ok' : 'bad';
}

const DEVIATION: Record<Grade, number> = { perfect: 0.03, good: 0.09, ok: 0.2, bad: 0.34 };
const SPEED_BONUS: Record<Grade, number> = { perfect: 0.12, good: 0.06, ok: 0, bad: -0.24 };

export interface Strike { grade: Grade; zone: Zone; target: GoalPoint; point: GoalPoint; speed: number }

export interface ShotInput {
  zone: Zone;
  /** posição do disparo menos o centro ideal (negativo = cedo, positivo = tarde) */
  timingError: number;
  halfWidth: number;
  attrs: Attributes;
  pressure: number;
  keeper: KeeperProfile;
}

/**
 * Resolve a cobrança inteira: desvio pela qualidade do timing e atributos,
 * depois trave/fora, depois a defesa do goleiro. A animação só reproduz este resultado.
 */
export function resolveShot(input: ShotInput, rng: Rng): KickOutcome {
  const s = strike(input, rng);
  let dive = chooseDive(rng, input.keeper, s.zone, s.grade);
  // Bola lenta dá tempo de o goleiro esperar e reagir.
  if (s.speed < 0.5 && rng() < (0.5 - s.speed) * 2.5) dive = s.point.x < -0.3 ? -1 : s.point.x > 0.3 ? 1 : 0;
  return finishShot(s, dive, input.keeper, input.attrs.curve, rng);
}

/** Onde e com que velocidade a bola chega, sem considerar o goleiro. */
export function strike(input: Omit<ShotInput, 'keeper'>, rng: Rng): Strike {
  const { zone, timingError, halfWidth, attrs, pressure } = input;
  const grade = gradeTiming(timingError, halfWidth);
  const target = ZONE_TARGETS[zone];

  let mag = DEVIATION[grade] + (grade === 'bad' ? (Math.abs(timingError) - halfWidth * 5) * 0.9 : 0);
  mag *= 1.2 - (attrs.precision / 100) * 0.6;
  mag += pressure * (1 - attrs.composure / 100) * 0.12 * rng();

  // Cedo = puxa para fora; tarde = sobe.
  const side = Math.sign(target.x) || (rng() < 0.5 ? -1 : 1);
  const wobble = (rng() - 0.5) * 0.8;
  let dx: number;
  let dy: number;
  if (timingError > 0) {
    dx = Math.sin(wobble) * mag * side;
    dy = Math.cos(wobble) * mag;
  } else {
    dx = Math.cos(wobble) * mag * side;
    dy = Math.sin(wobble) * mag;
  }
  // Chute mal batido também sai torto no outro eixo.
  if (grade === 'bad') {
    dx += (rng() - 0.5) * mag;
    dy += (rng() - 0.5) * mag * 0.6;
  }
  if (target.x !== 0) dx *= 1 - (attrs.curve / 100) * 0.35;

  const point = { x: target.x + dx, y: Math.max(0.04, target.y + dy) };
  const speed = clamp(0.5 + (attrs.power / 100) * 0.35 + SPEED_BONUS[grade], 0.25, 1);
  return { grade, zone, target, point, speed };
}

/** Trave/fora, depois a chance de defesa para o mergulho `dive`; `saveAdj` soma ajustes externos. */
export function finishShot(s: Strike, dive: Side, keeper: KeeperProfile, curve: number, rng: Rng, saveAdj = 0): KickOutcome {
  const { grade, zone, target, point, speed } = s;
  let result: KickResult | null = frameResult(point);
  let saveChance = 0;
  if (!result) {
    saveChance = clamp(computeSaveChance(point, speed, dive, keeper, curve, grade) + saveAdj, 0, 0.92);
    result = rng() < saveChance ? 'saved' : 'goal';
  }
  return { result, grade, zone, target, point, speed, dive, saveChance };
}

/** Bola fora ou no aro do gol, independente do goleiro. */
export function frameResult(p: GoalPoint): 'miss' | 'post' | null {
  const ax = Math.abs(p.x);
  if (ax > 1.05 || p.y > 1.07) return 'miss';
  if (ax > 0.95 || p.y > 0.95) return 'post';
  return null;
}

/** Batida limpa é mais difícil de segurar mesmo quando o goleiro acerta o canto. */
const STRIKE_SAVE: Record<Grade, number> = { perfect: -0.1, good: 0, ok: 0.08, bad: 0.15 };

export function computeSaveChance(p: GoalPoint, speed: number, dive: Side, keeper: KeeperProfile, curve: number, grade: Grade): number {
  const ballSide: Side = p.x < -0.3 ? -1 : p.x > 0.3 ? 1 : 0;
  let chance = 0;
  if (dive === ballSide) {
    if (ballSide === 0) {
      chance = 0.78 - speed * 0.25 - (p.y > 0.8 ? 0.2 : 0) + STRIKE_SAVE[grade];
    } else {
      const wide = (Math.abs(p.x) - 0.3) / 0.7;
      const extremeH = p.y > 0.7 ? (p.y - 0.7) / 0.3 : p.y < 0.12 ? 0.4 : 0;
      const curveBonus = (curve / 100) * 0.12 * (p.y > 0.6 ? 1 : 0.5);
      chance = keeper.reach * 1.3 - wide * 0.4 - extremeH * 0.25 - speed * 0.3 - curveBonus + STRIKE_SAVE[grade];
    }
  } else if (ballSide === 0) {
    chance = p.y < 0.35 ? 0.18 : 0.06; // perna que fica para trás
  } else if (dive === 0) {
    chance = Math.max(0, 0.45 - (Math.abs(p.x) - 0.3) * 1.5) * keeper.reach;
  }
  return clamp(chance, 0, 0.92);
}

function gaussian(rng: Rng): number {
  const u = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export function pickZone(rng: Rng): Zone {
  const r = rng();
  return (r < 0.24 ? 0 : r < 0.4 ? 1 : r < 0.56 ? 2 : r < 0.72 ? 3 : 4) as Zone;
}

/** Batida simulada de um cobrador com habilidade `skill` (0..1) para a zona dada. */
function simulatedShot(skill: number, zone: Zone, pressure: number, rng: Rng) {
  const v = skill * 100;
  const attrs = { precision: v, power: v, curve: v, composure: v };
  const halfWidth = 0.028 + v * 0.0005;
  const timingError = gaussian(rng) * halfWidth * (4.6 - 3 * skill);
  return { zone, timingError, halfWidth, attrs, pressure };
}

/** Cobrança simulada (adversários e jogos de outras equipes) com as mesmas regras do jogador. */
export function simulateKick(skill: number, keeper: KeeperProfile, pressure: number, rng: Rng): KickOutcome {
  const zone = pickZone(rng);
  return resolveShot({ ...simulatedShot(skill, zone, pressure, rng), keeper }, rng);
}

export interface OpponentStrike { strike: Strike; curve: number }

/** Contato pé-bola do batedor adversário: define para onde e com que força a bola vai. */
export function opponentStrike(skill: number, pressure: number, rng: Rng): OpponentStrike {
  const shot = simulatedShot(skill, pickZone(rng), pressure, rng);
  return { strike: strike(shot, rng), curve: shot.attrs.curve };
}

/** Defesa do goleiro do usuário, que reagiu vendo a bola: lado escolhido + rapidez da reação. */
export function defendStrike(os: OpponentStrike, defense: Defense, keeper: KeeperProfile, rng: Rng): DefendedKick {
  const reacted = defense.side !== null && gradeReaction(defense.at) !== 'none';
  const dive: Side = reacted ? defense.side! : 0;
  const keeperNow = { reach: keeper.reach * reactionReach(reacted ? defense.at : null), read: keeper.read };
  return { ...finishShot(os.strike, dive, keeperNow, os.curve, rng), reaction: reacted ? gradeReaction(defense.at) : 'none' };
}

/** Cobrança adversária completa contra o goleiro do usuário (as duas etapas de uma vez). */
export function resolveDefendedKick(skill: number, defense: Defense, keeper: KeeperProfile, pressure: number, rng: Rng): DefendedKick {
  return defendStrike(opponentStrike(skill, pressure, rng), defense, keeper, rng);
}

export const keeperFromRating = (rating: number): KeeperProfile => ({
  reach: 0.55 + clamp(rating, 0, 1) * 0.4,
  read: clamp(rating, 0, 1),
});
