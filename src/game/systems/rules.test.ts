import { describe, expect, it } from 'vitest';
import type { MatchStats, PlayerIdentity, Zone } from '../types';
import { INCIDENT_CHANCE, pickIncident } from '../data/incidents';
import { applyMatch, applyRaid, buyItem, createCareer, effectiveAttributes, equipped, matchSetup, nextFixture, pickWeather, seasonOver, spendSkillPoint, startNextSeason, toggleEquip, train, trainingCost } from './Career';
import { alive, fixtureFor, groupsComp, knockoutComp, maxMatches, playRound, simulateRest, stageLabel } from './Competition';
import { roundRobin } from './League';
import { Match } from './MatchManager';
import { gradeReaction, reactionReach } from './GoalkeeperAI';
import { defendStrike, gradeTiming, keeperFromRating, meterPosition, opponentStrike, resolveShot } from './PenaltyResolver';
import { loadCareer, saveCareer, validateCareer } from './SaveManager';
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

describe('Competições', () => {
  const sim = (h: string, a: string): [number, number] => (h < a ? [4, 3] : [3, 4]);

  it('turno único: todos se enfrentam exatamente uma vez', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const seen = new Set(roundRobin(ids).flat().map((p) => [...p].sort().join('-')));
    expect(seen.size).toBe(15);
  });

  it('mata-mata elimina, marca a fase da queda e coroa um campeão', () => {
    const c = knockoutComp('cup', 'cup', 'Copa', ['me', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(stageLabel(c)).toBe('Quartas de final');
    expect(fixtureFor(c, 'me')).toEqual({ opponent: 'b', home: true });
    playRound(c, 'me', [5, 4], sim);
    expect(stageLabel(c)).toBe('Semifinal');
    playRound(c, 'me', [2, 4], sim);
    expect(alive(c, 'me')).toBe(false);
    expect(c.exit).toBe('Semifinal');
    simulateRest(c, sim);
    expect(c.champion).not.toBeNull();
  });

  it('grupos viram mata-mata com os dois primeiros de cada grupo', () => {
    const groups = [0, 1, 2, 3].map((g) => [0, 1, 2, 3].map((i) => `t${g}${i}`));
    const c = groupsComp('wc', 'national', 'Copa do Mundo', groups);
    expect(maxMatches(c)).toBe(6);
    for (let r = 0; r < 3; r++) playRound(c, null, null, sim);
    expect(c.format).toBe('knockout');
    expect(c.bracket).toHaveLength(8);
    expect(new Set(c.bracket).size).toBe(8);
    simulateRest(c, sim);
    expect(c.bracket).toHaveLength(1);
  });
});

describe('Career', () => {
  const win: MatchStats = {
    won: true, scoreFor: 4, scoreAgainst: 2, goals: 4, kicks: 5, decisiveGoals: 1,
    perfects: 1, topCornerGoals: 1, saves: 0, objectiveMet: true, userKicks: [], events: [],
  };
  const loss: MatchStats = { ...win, won: false, scoreFor: 2, scoreAgainst: 4, goals: 2, decisiveGoals: 0, objectiveMet: false };

  it('começa na Série B com liga e copa nacional intercaladas', () => {
    const c = createCareer(identity, seeded(1));
    expect(Object.values(c.attributes).every((v) => v >= 38 && v <= 45)).toBe(true);
    expect(c.clubId).toBe('ituano');
    expect(c.comps.map((x) => x.name)).toEqual(['Brasileirão Série B', 'Copa do Brasil']);
    expect(c.calendar.filter((id) => id === 'league')).toHaveLength(7);
    expect(c.calendar.filter((id) => id === 'cup')).toHaveLength(3);
    expect(c.calendar[0]).toBe('league');
    expect(nextFixture(c)?.comp.name).toBe('Brasileirão Série B');
  });

  it('o estilo de cobrança soma o bônus só no atributo escolhido', () => {
    const plain = createCareer(identity, seeded(4)).attributes;
    const bomb = createCareer({ ...identity, style: 'power' }, seeded(4)).attributes;
    expect(bomb.power).toBe(plain.power + 6);
    expect(bomb.precision).toBe(plain.precision);
  });

  it('aplica recompensas pelo salário, sobe de nível e concede pontos', () => {
    const c0 = createCareer(identity, seeded(1));
    const { career, rewards } = applyMatch(c0, win, seeded(2));
    expect(rewards.xp).toBe(20 + 40 + 15 + 30 + 40);
    expect(rewards.money).toBe(Math.round(c0.contract.salary * (1 + 0.5 + 0.4 + 0.5)));
    expect(career.money).toBe(c0.money + rewards.money);
    expect(career.level).toBe(2);
    expect(career.skillPoints).toBe(3);
    expect(career.calendar).toHaveLength(c0.calendar.length - 1);
    expect(career.history[0]).toMatchObject({ comp: 'Brasileirão Série B', won: true });
    expect(career.comps[0].standings.reduce((n, s) => n + s.played, 0)).toBe(8);
    expect(c0.calendar).toHaveLength(10); // original intacto
  });

  it('eliminado na copa: os jogos restantes dela saem do calendário', () => {
    let c = createCareer(identity, seeded(1));
    const rng = seeded(3);
    while (c.calendar[0] !== 'cup') c = applyMatch(c, win, rng).career;
    c = applyMatch(c, loss, rng).career;
    expect(c.calendar.includes('cup')).toBe(false);
    expect(c.comps.find((x) => x.id === 'cup')!.exit).toBe('Quartas de final');
  });

  it('temporada perfeita: títulos, acesso, vaga continental e propostas', () => {
    let c = createCareer(identity, seeded(1));
    const rng = seeded(9);
    while (!seasonOver(c)) c = applyMatch(c, win, rng).career;
    expect(c.trophies.map((t) => t.name).sort()).toEqual(['Brasileirão Série B', 'Copa do Brasil']);
    expect(c.leagueOf.ituano).toBe('br-a');
    expect(c.continental).toBe(true);
    expect(c.offers[0].renewal).toBe(true);
    const stay = startNextSeason(c, undefined, seeded(5));
    expect(stay.comps.filter((x) => x.kind !== 'national').map((x) => x.name)).toEqual(['Brasileirão Série A', 'Copa do Brasil', 'Copa Libertadores']);
    expect(stay.comps.find((x) => x.kind === 'national')?.name).toBe('Copa América'); // temporada 2: meio do ciclo
    expect(stay.calendar.filter((id) => id === 'cont')).toHaveLength(3);
    expect(stay.season).toBe(2);
    expect(stay.age).toBe(c.age + 1);
  });

  it('transferência muda clube, liga e contrato', () => {
    let c = createCareer(identity, seeded(1));
    while (!seasonOver(c)) c = applyMatch(c, win, seeded(c.matchesPlayed)).career;
    const offer = c.offers.find((o) => !o.renewal)!;
    const next = startNextSeason(c, offer.clubId, seeded(6));
    expect(next.clubId).toBe(offer.clubId);
    expect(next.contract.salary).toBe(offer.salary);
    expect(next.contract.until).toBe(next.season + offer.seasons - 1);
    expect(next.comps[0].teams).toContain(offer.clubId);
    expect(() => startNextSeason(c, 'real-madrid')).toThrow();
  });

  it('Copa do Mundo a cada 4 temporadas, só com convocação', () => {
    const star = { ...createCareer(identity, seeded(1)), season: 3 };
    star.attributes = { precision: 80, power: 80, curve: 80, composure: 80 };
    star.calendar = [];
    star.offers = [{ clubId: 'ituano', salary: 500, seasons: 2, renewal: true }];
    const wc = startNextSeason(star, undefined, seeded(2));
    expect(wc.calledUp).toBe(true);
    const nat = wc.comps.find((x) => x.kind === 'national')!;
    expect(nat.name).toBe('Copa do Mundo');
    expect(nat.teams).toContain('n-brasil');
    expect(wc.calendar.filter((id) => id === 'nat')).toHaveLength(6);
    expect(wc.calendar[wc.calendar.length - 1]).toBe('nat');

    const rookie = { ...star, attributes: { precision: 40, power: 40, curve: 40, composure: 40 }, reputation: 5 };
    const noCall = startNextSeason(rookie, undefined, seeded(2));
    expect(noCall.calledUp).toBe(false);
    expect(noCall.calendar.includes('nat')).toBe(false);
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

  it('temporadas inteiras pelo MatchManager sempre terminam e reiniciam', () => {
    let c = createCareer(identity, seeded(1));
    const rng = seeded(5);
    for (let guard = 0; guard < 200 && c.season < 5; guard++) {
      if (seasonOver(c)) {
        c = startNextSeason(c, c.offers[Math.floor(rng() * c.offers.length)].clubId, rng);
        continue;
      }
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
      c = applyMatch(c, s, rng).career;
      expect(validateCareer(c)).toBeNull();
    }
    expect(c.season).toBe(5);
  });
});

describe('Loja e clima', () => {
  it('compra desconta o saldo e já equipa; reputação e saldo bloqueiam', () => {
    const c0 = { ...createCareer(identity, seeded(1)), money: 5000, reputation: 10 };
    const r = buyItem(c0, 'boots-neon');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.career.money).toBe(3500);
    expect(equipped(r.career).boots).toBe('boots-neon');
    expect(buyItem(r.career, 'boots-neon')).toMatchObject({ ok: false });
    expect(buyItem(c0, 'armband-captain')).toMatchObject({ ok: false, reason: 'Disponível com reputação 35' });
    expect(buyItem({ ...c0, money: 10 }, 'boots-white')).toMatchObject({ ok: false, reason: 'Saldo insuficiente' });
    const off = toggleEquip(r.career, 'boots-neon');
    expect(equipped(off).boots).toBeUndefined();
    expect(validateCareer(off)).toBeNull();
  });

  it('chuteira rara soma bônus nos atributos em campo, sem passar de 99', () => {
    let c = { ...createCareer(identity, seeded(1)), money: 99999, reputation: 60 };
    const r = buyItem(c, 'boots-gold');
    if (!r.ok) throw new Error(r.reason);
    c = r.career;
    expect(effectiveAttributes(c).power).toBe(c.attributes.power + 2);
    expect(effectiveAttributes({ ...c, attributes: { ...c.attributes, power: 99 } }).power).toBe(99);
    expect(matchSetup(c, nextFixture(c)!).attrs.composure).toBe(c.attributes.composure + 1);
  });

  it('chuva deixa os goleiros escorregarem; neve deixa a barra mais nervosa', () => {
    const c = createCareer(identity, seeded(1));
    const f = nextFixture(c)!;
    const dry = matchSetup(c, f, 'clear');
    const wet = matchSetup(c, f, 'rain');
    expect(wet.oppKeeper.reach).toBeLessThan(dry.oppKeeper.reach);
    expect(wet.ownKeeper.reach).toBeLessThan(dry.ownKeeper.reach);
    expect(matchSetup(c, f, 'snow').difficulty).toBeGreaterThan(dry.difficulty);
    expect(pickWeather(c, f, () => 0.28)).toBe('clear'); // neve só na Europa
  });

  it('raid: vitória dá troféu da espécie, dinheiro e XP, sem mexer na temporada', () => {
    const c = createCareer(identity, seeded(1));
    const s: MatchStats = { won: true, scoreFor: 5, scoreAgainst: 4, goals: 5, kicks: 6, decisiveGoals: 1, perfects: 0, topCornerGoals: 0, saves: 1, objectiveMet: true, userKicks: [], events: [] };
    const { career, rewards } = applyRaid(c, s, 'mars');
    expect(rewards.titles).toEqual(['Copa Intergaláctica']);
    expect(career.money).toBe(c.money + 6000);
    expect(career.trophies.at(-1)).toMatchObject({ name: 'Copa Intergaláctica', clubId: 's-earth' });
    expect(career.calendar).toEqual(c.calendar);
    expect(career.news[0]).toMatch(/^RAID ALIENÍGENA: .* Marcianos FC/);
    const lost = applyRaid(c, { ...s, won: false, scoreFor: 3, scoreAgainst: 4 }, 'raid').career;
    expect(lost.trophies).toHaveLength(0);
    expect(validateCareer(lost)).toBeNull();
  });

  it('imprevistos ficam raros e sem raid no menu', () => {
    for (let r = 0; r < 1; r += 0.01) expect(pickIncident(r, false)).not.toBe('raid');
    expect(pickIncident(0.99, true)).toBe('raid');
    expect(INCIDENT_CHANCE).toBeLessThanOrEqual(0.05);
  });

  it('imprevistos da partida viram notícia', () => {
    const c = createCareer(identity, seeded(1));
    const s: MatchStats = { won: true, scoreFor: 4, scoreAgainst: 3, goals: 4, kicks: 5, decisiveGoals: 0, perfects: 0, topCornerGoals: 0, saves: 0, objectiveMet: false, userKicks: [], events: ['rain', 'raid'] };
    const next = applyMatch(c, s, seeded(2)).career;
    expect(next.news[0]).toMatch(/^Raid! O cobrador foi abduzido no meio da disputa em Ituano x /);
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

  it('migra a carreira da versão 1 para clubes reais', () => {
    const st = mem();
    const v1 = {
      identity, age: 21, clubId: 'nautico', attributes: { precision: 60, power: 55, curve: 50, composure: 58 },
      level: 6, xp: 12, skillPoints: 2, money: 4000, reputation: 22, season: 4, round: 5,
      schedule: [], standings: [], history: [], trophies: [{ season: 2, name: 'Liga Regional', clubId: 'nautico' }], matchesPlayed: 18, offers: [],
    };
    st.setItem('penalty-career/save', JSON.stringify({ saveVersion: 1, career: v1 }));
    const r = loadCareer(st);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.career.clubId).toBe('gremio');
    expect(r.career).toMatchObject({ level: 6, money: 4000, reputation: 22, season: 4, age: 21 });
    expect(r.career.trophies).toHaveLength(1);
    expect(validateCareer(r.career)).toBeNull();
    expect(JSON.parse(st.getItem('penalty-career/save')!).saveVersion).toBe(2);
  });

  it('detecta salvamento corrompido ou de versão incompatível', () => {
    const st = mem();
    st.setItem('penalty-career/save', '{nao é json');
    expect(loadCareer(st).status).toBe('corrupt');
    st.setItem('penalty-career/save', JSON.stringify({ saveVersion: 99, career: {} }));
    expect(loadCareer(st).status).toBe('corrupt');
    st.setItem('penalty-career/save', JSON.stringify({ saveVersion: 2, career: { identity: {} } }));
    expect(loadCareer(st).status).toBe('corrupt');
    expect(loadCareer(mem()).status).toBe('none');
  });
});
