import type { Grade, KeeperProfile, Reaction, Rng, Side, Zone } from '../types';

export const ZONE_SIDE: Side[] = [-1, -1, 0, 1, 1];

/** Quanto cada qualidade de cobrança "entrega" a intenção do batedor ao goleiro. */
const TELL: Record<Grade, number> = { perfect: -0.08, good: 0, ok: 0.07, bad: 0.15 };

/**
 * O goleiro decide o lado antes do chute (como na vida real).
 * Com probabilidade `readChance` ele lê o corpo do batedor; senão, chuta um lado.
 */
export function readChance(keeper: KeeperProfile, grade: Grade): number {
  return Math.max(0, 0.1 + keeper.read * 0.25 + TELL[grade]);
}

export function chooseDive(rng: Rng, keeper: KeeperProfile, zone: Zone, grade: Grade): Side {
  if (rng() < readChance(keeper, grade)) return ZONE_SIDE[zone];
  const r = rng();
  return r < 0.42 ? -1 : r < 0.84 ? 1 : 0;
}

// ---------- Goleiro do usuário ----------

/** Limites (fração do voo da bola) de cada qualidade de reação. */
export const REACTION = { fast: 0.3, good: 0.55, late: 0.9 };

export function gradeReaction(at: number | null): Reaction {
  if (at === null || at > REACTION.late) return 'none';
  return at <= REACTION.fast ? 'fast' : at <= REACTION.good ? 'good' : 'late';
}

/** Multiplicador do alcance: reagir cedo no voo deixa o goleiro chegar mais longe. */
export function reactionReach(at: number | null): number {
  return { fast: 1.32, good: 1.15, late: 0.85, none: 0.6 }[gradeReaction(at)];
}
