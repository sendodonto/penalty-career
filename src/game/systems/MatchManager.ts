import type { Attributes, Club, DefendedKick, Defense, KeeperProfile, KickOutcome, MatchStats, MeterParams, Objective, Rng, Zone } from '../types';
import { defendStrike, meterParams, opponentStrike, resolveShot, type OpponentStrike, type Strike } from './PenaltyResolver';
import { Shootout, type Team } from './Shootout';

export interface MatchSetup {
  club: Club;
  opponent: Club;
  attrs: Attributes;
  /** 0..1: acelera a barra e fortalece o goleiro adversário */
  difficulty: number;
  oppSkill: number;
  oppKeeper: KeeperProfile;
  ownKeeper: KeeperProfile;
  objective: Objective;
}

export type Turn = 'user' | 'opp' | 'done';

/** Uma disputa: o usuário é a equipe A (cobra primeiro), o adversário é a equipe B. */
export class Match {
  readonly shootout = new Shootout();
  readonly userKicks: (KickOutcome & { decisive: boolean })[] = [];
  readonly oppKicks: DefendedKick[] = [];
  private pending: OpponentStrike | null = null;

  constructor(readonly setup: MatchSetup, private rng: Rng = Math.random) {}

  get turn(): Turn {
    if (this.shootout.winner()) return 'done';
    return this.shootout.next === 'a' ? 'user' : 'opp';
  }

  /** 1 = esta cobrança pode decidir a disputa; morte súbita e cobranças finais também pesam. */
  pressure(): number {
    const s = this.shootout;
    const me: Team = s.next;
    const other: Team = me === 'a' ? 'b' : 'a';
    if (s.winnerIf(true) === me || s.winnerIf(false) === other) return 1;
    if (s.suddenDeath) return 0.7;
    return s[me].length >= 3 ? 0.4 : 0;
  }

  meter(): MeterParams {
    return meterParams(this.setup.attrs, this.pressure(), this.setup.difficulty, this.rng);
  }

  kickUser(zone: Zone, timingError: number, halfWidth: number): KickOutcome {
    if (this.turn !== 'user') throw new Error('Não é a vez do jogador');
    const pressure = this.pressure();
    const outcome = resolveShot(
      { zone, timingError, halfWidth, attrs: this.setup.attrs, pressure, keeper: this.setup.oppKeeper },
      this.rng,
    );
    const scored = outcome.result === 'goal';
    this.userKicks.push({ ...outcome, decisive: scored && pressure === 1 });
    this.shootout.record(scored);
    return outcome;
  }

  /** Contato pé-bola: fixa para onde a bola vai. */
  strikeOpponent(): Strike {
    if (this.turn !== 'opp') throw new Error('Não é a vez do adversário');
    this.pending ??= opponentStrike(this.setup.oppSkill, this.pressure(), this.rng);
    return this.pending.strike;
  }

  /** Resolve a defesa (na reação do usuário, ou quando a bola chega sem reação). */
  kickOpponent(defense: Defense): DefendedKick {
    this.strikeOpponent();
    const outcome = defendStrike(this.pending!, defense, this.setup.ownKeeper, this.rng);
    this.pending = null;
    this.oppKicks.push(outcome);
    this.shootout.record(outcome.result === 'goal');
    return outcome;
  }

  stats(): MatchStats {
    const goals = this.shootout.goals('a');
    const won = this.shootout.winner() === 'a';
    const perfects = this.userKicks.filter((k) => k.grade === 'perfect').length;
    const topCornerGoals = this.userKicks.filter((k) => k.result === 'goal' && (k.zone === 1 || k.zone === 3)).length;
    const saves = this.oppKicks.filter((k) => k.result === 'saved').length;
    const met: Record<Objective['id'], boolean> = {
      win: won,
      score_all: goals === this.userKicks.length,
      score_3: goals >= 3,
      perfect: perfects > 0,
      top_corner: topCornerGoals > 0,
      save_one: saves > 0,
    };
    return {
      won,
      scoreFor: goals,
      scoreAgainst: this.shootout.goals('b'),
      goals,
      kicks: this.userKicks.length,
      decisiveGoals: this.userKicks.filter((k) => k.decisive).length,
      perfects,
      topCornerGoals,
      saves,
      objectiveMet: met[this.setup.objective.id],
      userKicks: [...this.userKicks],
    };
  }
}
