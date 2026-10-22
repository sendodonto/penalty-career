import { describe, expect, it } from 'vitest';
import type { MatchStats, PlayerIdentity, Zone } from '../types';
import { applyMatch, createCareer, matchSetup, nextFixture, seasonOver, spendSkillPoint, startNextSeason, train, trainingCost, xpForLevel } from './Career';
import { roundRobin } from './League';
import { Match } from './MatchManager';
import { gradeReaction, reactionReach } from './GoalkeeperAI';
import { defendStrike, gradeTiming, keeperFromRating, meterPosition, opponentStrike, resolveShot } from './PenaltyResolver';
import { loadCareer, saveCareer } from './SaveManager';
import { Shootout } from './Shootout';
import { seeded } from '../rng';


const identity: PlayerIdentity = { name: 'Teste', nationality: 'Brasil', number: 10, appearance: { skin: 0, hair: 0, hairColor: 0 } };

function play(s: Shootout, seq: string) {
  for (const ch of seq) s.record(ch === '1');
}

describe('Shootout', () => {
  it('alterna A e B e encerra antecipadamente quando decidido', () => {
    const s = new Shootout();
    play(s, '1010'); // A 2x0, 3 restantes para cada
    expect(s.next).toBe('a');
    expect(s.winner()).toBe(null);
    play(s, '10'); // A 3x0, B só pode chegar a 2
    expect(s.winner()).toBe('a');
    expect(() => s.record(true)).toThrow();
  });

  it('decide no meio da rodada quando a vantagem supera as cobranças restantes', () => {
    const s = new Shootout();
    play(s, '1110101'); // A 4 em 4, B 1 em 3: B tem 2 restantes
    expect(s.winner()).toBe('a');
  });

  it('vai para alternadas no empate e nunca termina empatada', () => {
    const s = new Shootout();
    play(s, '1111111111'); // 5x5
    expect(s.winner()).toBe(null);
    expect(s.suddenDeath).toBe(true);
    s.record(true); // A 6
    expect(s.winner()).toBe(null); // B ainda cobra
    s.record(false);
    expect(s.winner()).toBe('a');
  });

  it('morte súbita: B vence quando A erra e B converte', () => {
    const s = new Shootout();
    play(s, '1111111111' + '01'); // 5x5, A erra, B converte
    expect(s.winner()).toBe('b');
  });

  it('winnerIf não altera o estado', () => {
    const s = new Shootout();
    play(s, '11101100'); // A 3x2 após 4 cada
    expect(s.winnerIf(true)).toBe('a');
    expect(s.winnerIf(false)).toBe(null);
    expect(s.a.length).toBe(4);
  });

  it('disputas simuladas sempre terminam com vencedor', () => {
    const rng = seeded(7);
    for (let i = 0; i < 300; i++) {
      const s = new Shootout();
      let guard = 0;
      while (!s.winner() && guard++ < 200) s.record(rng() < 0.75);
      expect(s.winner()).not.toBe(null);
      expect(s.goals('a')).not.toBe(s.goals('b'));
    }
  });
});

describe('PenaltyResolver', () => {
  const avg = { precision: 50, power: 50, curve: 50, composure: 50 };
  const keeper = keeperFromRating(0.5);

  it('classifica o timing', () => {
    expect(gradeTiming(0.01, 0.05)).toBe('perfect');
    expect(gradeTiming(-0.1, 0.05)).toBe('good');
    expect(gradeTiming(0.2, 0.05)).toBe('ok');
    expect(gradeTiming(0.4, 0.05)).toBe('bad');
  });

  it('marcador vai e volta entre 0 e 1', () => {
    expect(meterPosition(0, 1)).toBe(0);
    expect(meterPosition(0.5, 1)).toBeCloseTo(0.5);
    expect(meterPosition(1.5, 1)).toBeCloseTo(0.5);
    expect(meterPosition(2, 1)).toBeCloseTo(0);
  });

  function goalRate(err: number, attrs = avg, n = 4000) {
    const rng = seeded(42);
    let goals = 0;
    const results = new Set<string>();
    for (let i = 0; i < n; i++) {
      const zone = (i % 5) as Zone;
      const o = resolveShot({ zone, timingError: err, halfWidth: 0.05, attrs, pressure: 0, keeper }, rng);
      results.add(o.result);
      if (o.result === 'goal') goals++;
    }
    return { rate: goals / n, results };
  }

  it('cobrança perfeita converte bem mais que uma ruim, sem ser infalível', () => {
    const perfect = goalRate(0);
    const bad = { rate: (goalRate(0.4).rate + goalRate(-0.4).rate) / 2, results: goalRate(-0.4).results };
    expect(perfect.rate).toBeGreaterThan(0.75);
    expect(perfect.rate).toBeLessThan(0.98);
    expect(bad.rate).toBeLessThan(0.45);
    expect(bad.results.has('miss')).toBe(true);
  });

  it('produz gol, defesa, trave e fora', () => {
    const all = new Set([...goalRate(0).results, ...goalRate(0.15).results, ...goalRate(0.4).results]);
    expect([...all].sort()).toEqual(['goal', 'miss', 'post', 'saved']);
  });

  it('atributos altos aumentam a conversão com o mesmo timing', () => {
    const strong = { precision: 90, power: 90, curve: 90, composure: 90 };
    expect(goalRate(0.15, strong).rate).toBeGreaterThan(goalRate(0.15).rate + 0.05);
  });

  it('o ponto final respeita a zona escolhida', () => {
    const rng = seeded(3);
    const o = resolveShot({ zone: 4, timingError: 0, halfWidth: 0.05, attrs: avg, pressure: 0, keeper }, rng);
    expect(o.point.x).toBeGreaterThan(0.5);
    expect(o.point.y).toBeLessThan(0.4);
  });
});

describe('Goleiro do usuário', () => {
  it('classifica a reação pela fração do voo', () => {
    expect(gradeReaction(null)).toBe('none');
    expect(gradeReaction(0.2)).toBe('fast');
    expect(gradeReaction(0.5)).toBe('good');
    expect(gradeReaction(0.8)).toBe('late');
    expect(gradeReaction(0.95)).toBe('none');
    expect(reactionReach(0.2)).toBeGreaterThan(reactionReach(0.5));
    expect(reactionReach(0.5)).toBeGreaterThan(reactionReach(0.8));
  });

  const keeper = keeperFromRating(0.3);
  const sideOf = (x: number) => (x < -0.3 ? -1 : x > 0.3 ? 1 : 0) as -1 | 0 | 1;
  /** Simula um goleiro que vê a bola: `read` = acerta o lado; `at` = quando reage. */
  function saveRate(read: boolean, at: number | null, n = 4000) {
    const rng = seeded(11);
    let saves = 0;
    for (let i = 0; i < n; i++) {
      const os = opponentStrike(0.45, 0, rng);
      const side = at === null ? null : read ? sideOf(os.strike.point.x) : (sideOf(os.strike.point.x) === 1 ? -1 : 1);
      if (defendStrike(os, { side, at }, keeper, rng).result === 'saved') saves++;
    }
    return saves / n;
  }

  it('ler a bola e reagir rápido defende bastante; atrasado defende menos; parado quase nunca', () => {
    const fast = saveRate(true, 0.2);
    const late = saveRate(true, 0.8);
    expect(fast).toBeGreaterThan(0.35);
    expect(fast).toBeLessThan(0.7);
    expect(late).toBeLessThan(fast - 0.1);
    expect(saveRate(false, 0.2)).toBeLessThan(0.1);
    expect(saveRate(true, null)).toBeLessThan(0.15);
  });

  it('tremor sob pressão mantém o marcador dentro da barra', () => {
    for (let t = 0; t < 5; t += 0.013) {
      const p = meterPosition(t, 1.4, 0.05);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe('Career', () => {
  it('cria carreira com atributos modestos e calendário', () => {
    const c = createCareer(identity, seeded(1));
    expect(Object.values(c.attributes).every((v) => v >= 38 && v <= 45)).toBe(true);
    expect(c.schedule).toHaveLength(5);
    expect(nextFixture(c)).not.toBeNull();
  });

  it('o estilo de cobrança soma o bônus só no atributo escolhido', () => {
    const plain = createCareer(identity, seeded(4)).attributes;
    const bomb = createCareer({ ...identity, style: 'power' }, seeded(4)).attributes;
    expect(bomb.power).toBe(plain.power + 6);
    expect(bomb.precision).toBe(plain.precision);
  });

  it('turno único: todos se enfrentam exatamente uma vez', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const seen = new Set(roundRobin(ids).flat().map((p) => [...p].sort().join('-')));
    expect(seen.size).toBe(15);
  });

  const win: MatchStats = {
    won: true, scoreFor: 4, scoreAgainst: 2, goals: 4, kicks: 5, decisiveGoals: 1,
    perfects: 1, topCornerGoals: 1, saves: 0, objectiveMet: true, userKicks: [],
  };

  it('aplica recompensas, sobe de nível e concede pontos', () => {
    const c0 = createCareer(identity, seeded(1));
    const { career, rewards } = applyMatch(c0, win, seeded(2));
    expect(rewards.xp).toBe(20 + 40 + 15 + 30 + 40);
    expect(career.money).toBe(c0.money + rewards.money);
    expect(career.level).toBe(2);
    expect(career.skillPoints).toBe(3);
    expect(career.xp).toBe(rewards.xp - xpForLevel(1));
    expect(career.round).toBe(1);
    expect(career.history[0].won).toBe(true);
    expect(career.standings.reduce((n, s) => n + s.played, 0)).toBe(6);
    expect(c0.round).toBe(0); // original intacto
  });

  it('distribui pontos e treina com dinheiro', () => {
    let c = applyMatch(createCareer(identity, seeded(1)), win, seeded(2)).career;
    const before = c.attributes.precision;
    c = spendSkillPoint(c, 'precision');
    expect(c.attributes.precision).toBe(before + 1);
    expect(c.skillPoints).toBe(2);
    const cost = trainingCost(c.attributes.power);
    const money = c.money;
    c = train(c, 'power');
    expect(c.money).toBe(money - cost);
    const broke = { ...c, money: 0 };
    expect(train(broke, 'power')).toBe(broke);
  });

  it('fecha a temporada, gera propostas e inicia a seguinte', () => {
    let c = createCareer(identity, seeded(1));
    const rng = seeded(9);
    while (!seasonOver(c)) c = applyMatch(c, win, rng).career;
    expect(c.trophies.length).toBe(1); // 5 vitórias = campeão
    expect(c.offers.length).toBeGreaterThan(0);
    const next = startNextSeason(c, c.offers[0]);
    expect(next.clubId).toBe(c.offers[0]);
    expect(next.age).toBe(c.age + 1);
    expect(next.round).toBe(0);
    expect(next.standings.some((s) => s.clubId === next.clubId)).toBe(true);
  });

  it('partida jogada pelo MatchManager sempre tem vencedor e alimenta a carreira', () => {
    const c = createCareer(identity, seeded(1));
    const rng = seeded(5);
    for (let i = 0; i < 50; i++) {
      const m = new Match(matchSetup(c, nextFixture(c)!), rng);
      while (m.turn !== 'done') {
        if (m.turn === 'user') {
          const meter = m.meter();
          m.kickUser((Math.floor(rng() * 5)) as Zone, (rng() - 0.5) * 0.3, meter.halfWidth);
        } else {
          m.strikeOpponent();
          m.kickOpponent({ side: rng() < 0.2 ? null : (([-1, 0, 1] as const)[Math.floor(rng() * 3)]), at: rng() });
        }
      }
      const s = m.stats();
      expect(s.scoreFor).not.toBe(s.scoreAgainst);
      expect(s.kicks).toBe(m.shootout.a.length);
      expect(() => applyMatch(c, s, rng)).not.toThrow();
    }
  });
});

describe('SaveManager', () => {
  const mem = () => {
    const d = new Map<string, string>();
    return {
      getItem: (k: string) => d.get(k) ?? null,
      setItem: (k: string, v: string) => void d.set(k, v),
      removeItem: (k: string) => void d.delete(k),
    } as Storage;
  };

  it('salva e recarrega a carreira', () => {
    const st = mem();
    const c = createCareer(identity, seeded(1));
    expect(saveCareer(c, st)).toBe(true);
    const r = loadCareer(st);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.career).toEqual(c);
  });

  it('detecta salvamento corrompido ou de versão incompatível', () => {
    const st = mem();
    st.setItem('penalty-career/save', '{nao é json');
    expect(loadCareer(st).status).toBe('corrupt');
    st.setItem('penalty-career/save', JSON.stringify({ saveVersion: 99, career: {} }));
    expect(loadCareer(st).status).toBe('corrupt');
    st.setItem('penalty-career/save', JSON.stringify({ saveVersion: 1, career: { identity: {} } }));
    expect(loadCareer(st).status).toBe('corrupt');
    expect(loadCareer(mem()).status).toBe('none');
  });
});
