import Phaser from 'phaser';
import { sfx, startAmbience, stopAmbience } from '../audio';
import { BOOT_COLORS, FONT, HAIR_COLORS, HAIR_STYLES, KEEPER_KITS, SKIN_TONES } from '../data/appearance';
import { IS_TOUCH } from '../device';
import type { GearVisual } from '../data/shop';
import { clubKit, figureSkin, type FigureSkin, type Kit } from '../entities/figureArt';
import { getSpecial, SPECIALS, type Special, type SpecialId } from '../data/specials';
import { INCIDENT_CHANCE, pickIncident, playIncident, weatherFx, type Incident } from './MatchEvents';
import { Ball, hex, Keeper, Kicker } from '../entities/Figures';
import { GOAL, SPOT, Stadium, toScreen } from '../entities/Stadium';
import { REACTION } from '../systems/GoalkeeperAI';
import type { Match } from '../systems/MatchManager';
import { frameResult, gradeTiming, meterPosition, ZONE_NAMES, ZONE_TARGETS } from '../systems/PenaltyResolver';
import type { Appearance, DefendedKick, GoalPoint, Grade, KickOutcome, MatchStats, MeterParams, Reaction, Side, Team, Zone } from '../types';

export interface Hud {
  update(match: Match): void;
  hint(text: string): void;
  toggleMute(): void;
}

export interface PenaltySceneData {
  match: Match;
  /** `gear`/`celebration` vêm da loja da carreira */
  player: { name: string; number: number; appearance: Appearance; gear?: GearVisual; celebration?: string };
  hud: Hud;
  onFinish(stats: MatchStats): void;
  /** Fundo animado do menu: os dois lados jogam sozinhos, sem som nem interface. */
  demo?: boolean;
  /** Partida de raid: estádio temático e adversários da espécie */
  special?: SpecialId;
  /** Sem imprevistos (partidas de raid e a disputa retomada depois de um) */
  noIncidents?: boolean;
  /** O jogador foi abduzido: o app pausa esta disputa e abre a partida do raid */
  onRaid?(id: SpecialId): void;
}

const SILENT = Object.fromEntries(Object.keys(sfx).map((k) => [k, () => {}])) as typeof sfx;

/** aim/power: sua cobrança · guard: você defende · flight: lance em andamento */
type Phase = 'wait' | 'aim' | 'power' | 'guard' | 'flight' | 'result' | 'final';

const GRADE_LABEL: Record<Grade, [string, string]> = {
  perfect: ['PERFEITA!', '#ffd23f'],
  good: ['BOA', '#5be08a'],
  ok: ['MEDIANA', '#e8e2d0'],
  bad: ['RUIM', '#ff6a5c'],
};
const REACTION_LABEL: Record<Reaction, [string, string, string]> = {
  fast: ['REFLEXO RÁPIDO!', '#5bd8ff', 'rápido'],
  good: ['BOM REFLEXO', '#5be08a', 'bom'],
  late: ['ATRASADO', '#ff9f43', 'atrasado'],
  none: ['NÃO REAGIU', '#9fb0a6', ''],
};
const RESULT_LABEL = {
  goal: ['GOL!', '#ffd23f'],
  saved: ['DEFENDIDO!', '#ff6a5c'],
  post: ['NA TRAVE!', '#ff9f43'],
  miss: ['PARA FORA!', '#ff6a5c'],
} as const;
/** Mesmos resultados vistos pelo seu goleiro. */
const DEFENSE_LABEL = {
  goal: ['GOL DO ADVERSÁRIO', '#ff6a5c'],
  saved: ['DEFENDEU!', '#ffd23f'],
  post: ['NA TRAVE!', '#5be08a'],
  miss: ['PARA FORA!', '#5be08a'],
} as const;

const KICKER_START = { x: 520, y: 704, scale: 1.3 };
const KICKER_PLANT = { x: 608, y: 574, scale: 1.16 };
const KEEPER_POS = { x: GOAL.cx, y: GOAL.ground, scale: 0.92 };
const BALL_REST = { x: SPOT.x, y: SPOT.y - 7 };
const METER = { x: 840, y: 650, w: 380, h: 22 };
const OPP_NUMBERS = [9, 7, 10, 11, 8, 5, 4, 3, 2, 6, 14, 17];
const GUARD_WAIT = 900;
/** Câmera lenta durante o voo da bola quando você está no gol. */
const SLOWMO = 0.35;
const DEFENSE_ACCENT = 0x5bd8ff;
/** Três faixas do gol para a reação: esquerda, centro, direita. */
const COL_W = (GOAL.halfW * 2) / 3;
const GOAL_LEFT = GOAL.cx - GOAL.halfW;

const keeperKit = (club: Team): Kit => {
  const color = KEEPER_KITS[[...club.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % KEEPER_KITS.length];
  return { shirt: color, trim: '#111111', shorts: '#1d1d1f', socks: color };
};
const OPP_NAMES = ['SILVA', 'ROCHA', 'MOURA', 'NUNES', 'PIRES'];
const flightMs = (speed: number) => 560 - speed * 260;

/** Cobrança adversária em que você é o goleiro: você reage vendo a bola. */
interface Guard {
  struck: boolean;
  /** duração do voo (ms de jogo) e fração já percorrida */
  flight: number;
  t: number;
  side: Side | null;
  reactAt: number;
  outcome: DefendedKick | null;
}

export class PenaltyScene extends Phaser.Scene {
  private d!: PenaltySceneData;
  private phase: Phase = 'wait';
  private zone: Zone = 2;
  private meterParams: MeterParams | null = null;
  private meterStart = 0;
  private meterStop: number | null = null;
  private trail: number[] = [];
  private guard: Guard | null = null;
  /** Um Espaço que pulou o lance anterior não pode confirmar/chutar o seguinte. */
  private inputLockUntil = 0;

  private stadium!: Stadium;
  private kicker?: Kicker;
  private keeper?: Keeper;
  private ball!: Ball;
  private shadow!: Phaser.GameObjects.Ellipse;
  private zoneMarkers: Phaser.GameObjects.Graphics[] = [];
  private zoneLabels: Phaser.GameObjects.Text[] = [];
  private hoverZone: Zone | null = null;
  private meterG!: Phaser.GameObjects.Graphics;
  private meterTitle!: Phaser.GameObjects.Text;
  private meterLeft!: Phaser.GameObjects.Text;
  private meterRight!: Phaser.GameObjects.Text;
  private pressureTag!: Phaser.GameObjects.Text;
  private gradeText!: Phaser.GameObjects.Text;
  private kickBtn!: Phaser.GameObjects.Container;
  private kickBtnBg!: Phaser.GameObjects.Graphics;
  private kickBtnLabel!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Container;
  private bannerTitle!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private bannerPrompt!: Phaser.GameObjects.Text;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private autoNext?: Phaser.Time.TimerEvent;
  private meterUi: Phaser.GameObjects.GameObject[] = [];
  /** Vezes já jogadas e imprevistos já ocorridos nesta partida */
  private turns = 0;
  private incidents = 0;
  private meterBox!: Phaser.GameObjects.Container;
  /** Escala base da faixa de resultado (menor em pé, onde a tela é estreita). */
  private bannerScale = 1;
  private guardCols!: Phaser.GameObjects.Graphics;
  private guardLabels: Phaser.GameObjects.Text[] = [];
  private skins!: { user: FigureSkin; opp: FigureSkin[]; keeperOwn: FigureSkin; keeperOpp: FigureSkin };
  /** Invalida o carregamento assíncrono da arte se a cena reiniciar antes de terminar. */
  private run = 0;
  private reactCue!: Phaser.GameObjects.Text;

  constructor() {
    super('penalty');
  }

  private get sfx() {
    return this.d.demo ? SILENT : sfx;
  }

  init(data: PenaltySceneData) {
    this.d = data;
    this.run++;
    this.meterUi = [];
    this.phase = 'wait';
    this.zone = 2;
    this.guardLabels = [];
    this.zoneMarkers = [];
    this.zoneLabels = [];
    this.kicker = undefined;
    this.keeper = undefined;
    this.guard = null;
    this.turns = 0;
    this.incidents = 0;
  }

  create() {
    const { club, opponent } = this.d.match.setup;
    // No menu o lance fica à direita, livre do logo e dos botões.
    const sp = this.raid;
    this.stadium = new Stadium(this, [club.primary, club.secondary], [opponent.primary, opponent.secondary], sp?.theme, sp?.species);
    const weather = this.d.match.setup.weather;
    weatherFx(this, weather);
    if (weather !== 'clear' && !this.d.match.events.includes(weather)) this.d.match.events.push(weather);

    this.shadow = this.add.ellipse(BALL_REST.x, SPOT.y + 1, 18, 6, 0x000000, 0.35).setDepth(5);
    this.ball = new Ball(this, BALL_REST.x, BALL_REST.y).setDepth(20);
    this.createZones();
    this.createGuardCols();
    this.createMeter();
    this.createBanner();

    if (!this.textures.exists('confetti')) this.add.graphics().fillStyle(0xffffff).fillRect(0, 0, 6, 10).generateTexture('confetti', 6, 10).destroy();
    this.confetti = this.add.particles(0, 0, 'confetti', {
      speed: { min: 60, max: 260 }, angle: { min: 40, max: 140 }, gravityY: 300, lifespan: 2200,
      rotate: { min: 0, max: 360 }, scale: { start: 1, end: 0.6 }, emitting: false,
      tint: [hex(club.primary), hex(club.secondary), 0xffd23f, 0xf4f1e8],
    }).setDepth(40);

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // No gol: tocar/clicar em qualquer ponto escolhe o lado pela posição horizontal.
      if (this.phase === 'guard' && !this.d.demo) return this.keeperReact(this.sideAt(p.worldX));
      // Na barra: tocar em qualquer lugar do campo também chuta (alvo grande no celular).
      if (this.phase === 'power' && over.length === 0) return this.shoot();
      if (over.length === 0 && (this.phase === 'result' || this.phase === 'final')) this.advance();
    });
    this.applyLayout();
    this.scale.on('resize', this.applyLayout, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.applyLayout, this);
      stopAmbience();
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;
    });

    if (this.d.demo) this.meterUi.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    const run = this.run;
    void this.loadSkins().then(() => {
      if (run !== this.run || !this.sys.isActive()) return;
      if (!this.d.demo) {
        startAmbience();
        this.sfx.whistle();
      }
      this.nextTurn();
    });
  }

  private get raid(): Special | undefined {
    return this.d.special ? getSpecial(this.d.special) : undefined;
  }

  /** Espécie e cor de pele/pelo/metal sorteada para um jogador do time do raid. */
  private raidOpts() {
    const sp = this.raid;
    return sp ? { species: sp.species, skinColor: sp.skins[Math.floor(Math.random() * sp.skins.length)] } : {};
  }

  /** Arte dos personagens da partida: você, cinco cobradores adversários e os dois goleiros. */
  private async loadSkins() {
    const { club, opponent } = this.d.match.setup;
    const p = this.d.player;
    const [user, keeperOwn, keeperOpp, ...opp] = await Promise.all([
      figureSkin(this, 'back', p.appearance, clubKit(club), { number: p.number, name: p.name.split(' ').pop(), gear: p.gear }),
      figureSkin(this, 'front', this.randomLook(), keeperKit(club)),
      figureSkin(this, 'front', this.randomLook(), keeperKit(opponent), this.raidOpts()),
      ...(this.raid?.names ?? OPP_NAMES).map((name, i) => figureSkin(this, 'back', this.randomLook(), clubKit(opponent), { number: OPP_NUMBERS[i], name, ...this.raidOpts() })),
    ]);
    this.skins = { user, keeperOwn, keeperOpp, opp };
  }

  update(time: number) {
    if (this.phase === 'power' && this.meterParams) {
      const pos = this.shotPosition(time);
      this.trail.unshift(pos);
      this.trail.length = Math.min(this.trail.length, 6);
      this.drawShotMeter(pos, time);
    } else if (this.guard) {
      const g = this.guard;
      // A bola está quase chegando e você não reagiu: o goleiro fica.
      if (g.struck && !g.outcome && g.t >= REACTION.late) this.resolveGuard();
      this.drawReactionMeter();
    }
  }

  // ---------- Turnos ----------

  private nextTurn(afterIncident = false) {
    this.autoNext?.remove();
    this.guard = null;
    this.setSlowMo(false);
    this.reactCue.setVisible(false);
    this.banner.setVisible(false);
    this.kicker?.destroy();
    this.keeper?.destroy();
    this.tweens.killTweensOf(this.ball);
    this.ball.setPosition(BALL_REST.x, BALL_REST.y).setScale(1).setAlpha(1).setRotation(0).setDepth(20);
    this.shadow.setPosition(BALL_REST.x, SPOT.y + 1).setScale(1).setAlpha(1);
    this.stadium.drawNet(null, 0);
    this.meterStop = null;
    this.trail = [];
    this.gradeText.setText('');

    const m = this.d.match;
    this.d.hud.update(m);
    if (m.turn === 'done') return this.finale();
    // Imprevisto entre cobranças: no máximo 1 por partida, nunca antes da primeira.
    // Só em desenvolvimento: window.__forceIncident = 'raid' (e __forceRaid = 'mars') forçam o próximo (testes visuais).
    const dev = import.meta.env.DEV ? (window as unknown as { __forceIncident?: Incident; __forceRaid?: SpecialId }) : undefined;
    const forced = dev?.__forceIncident;
    const allowRaid = !!this.d.onRaid && !this.d.demo;
    if (!afterIncident && this.turns > 0 && !this.d.noIncidents && (forced || (this.incidents < 1 && Math.random() < INCIDENT_CHANCE))) {
      const kind = forced ?? pickIncident(Math.random(), allowRaid);
      const special = kind === 'raid' ? getSpecial(dev?.__forceRaid ?? '') ?? SPECIALS[Math.floor(Math.random() * SPECIALS.length)] : undefined;
      if (dev) delete dev.__forceIncident;
      const run = this.run;
      this.incidents++;
      m.events.push(kind);
      this.phase = 'wait';
      this.setZonesVisible(false);
      this.d.hud.hint('');
      void playIncident(this, kind, {
        stadium: this.stadium, ball: this.ball, ballRest: BALL_REST, sfx: this.sfx, special,
        toast: (title, sub) => !this.d.demo && this.showBanner(title, '#5bd8ff', sub, ''),
        spawnPlayer: async () => new Kicker(this, KICKER_START.x, KICKER_START.y, this.skins.user).setScale(KICKER_START.scale).setDepth(30),
      }).then(() => {
        if (run !== this.run || !this.sys.isActive()) return;
        if (special && this.d.onRaid) return this.d.onRaid(special.id);
        this.nextTurn(true);
      });
      return;
    }
    this.turns++;

    const user = m.turn === 'user';
    const kickerSkin = user ? this.skins.user : this.skins.opp[m.oppKicks.length % this.skins.opp.length];
    this.keeper = new Keeper(this, KEEPER_POS.x, KEEPER_POS.y, user ? this.skins.keeperOpp : this.skins.keeperOwn)
      .setScale(KEEPER_POS.scale).setDepth(10);
    this.keeper.ready();
    this.kicker = new Kicker(this, KICKER_START.x, KICKER_START.y, kickerSkin)
      .setScale(KICKER_START.scale).setDepth(30).setAlpha(0);
    this.tweens.add({ targets: this.kicker, alpha: 1, duration: 220 });
    this.kicker.idle();
    if (!user && this.raid) this.speech(this.raid.taunts[Math.floor(Math.random() * this.raid.taunts.length)]);
    this.inputLockUntil = this.time.now + 300;
    this.setZonesVisible(!this.d.demo && user);
    this.drawGuardCols(user || this.d.demo ? 'off' : 'wait');

    const pressure = m.pressure();
    this.pressureTag.setVisible(pressure >= 0.7).setText(pressure === 1 ? 'COBRANÇA DECISIVA' : 'PRESSÃO');
    if (user) {
      this.phase = 'aim';
      this.meterParams = m.meter();
      this.setMeterMode('shot');
      this.drawShotMeter(null, this.time.now);
    } else {
      this.phase = 'guard';
      this.meterParams = null;
      this.guard = { struck: false, flight: 0, t: 0, side: null, reactAt: 0, outcome: null };
      this.setMeterMode('reflex');
      this.gradeText.setText('AGUARDE O CHUTE').setColor('#9fb0a6').setScale(1);
      this.time.delayedCall(GUARD_WAIT, () => this.opponentRunUp());
    }
    this.refreshUi();
    if (this.d.demo) this.playDemoTurn(user);
  }

  /** Modo demonstração: mira, barra e pulo do goleiro escolhidos ao acaso, pelas mesmas regras. */
  private playDemoTurn(user: boolean) {
    const rnd = () => Math.random();
    if (user) {
      this.time.delayedCall(600, () => {
        this.zone = Math.floor(rnd() * 5) as Zone;
        this.inputLockUntil = 0;
        this.confirmAim();
        this.inputLockUntil = 0;
        this.time.delayedCall(250 + rnd() * 700, () => this.shoot());
      });
    }
    // No gol, a reação da demonstração é agendada no chute (opponentStrike).
  }

  private randomLook(): Appearance {
    const r = (n: number) => Math.floor(Math.random() * n);
    return { skin: r(SKIN_TONES.length), hair: r(HAIR_STYLES.length), hairColor: r(HAIR_COLORS.length), boots: r(BOOT_COLORS.length) };
  }

  private onKey(e: KeyboardEvent) {
    if (e.repeat || this.d.demo) return;
    const k = e.code;
    if (k === 'KeyM') return this.d.hud.toggleMute();
    const confirm = k === 'Space' || k === 'Enter' || k === 'NumpadEnter';
    if (confirm) e.preventDefault();
    if (this.phase === 'guard') {
      const side: Side | null = k === 'ArrowLeft' || k === 'KeyA' ? -1 : k === 'ArrowRight' || k === 'KeyD' ? 1
        : confirm || k === 'ArrowDown' || k === 'KeyS' || k === 'ArrowUp' || k === 'KeyW' ? 0 : null;
      if (side !== null) this.keeperReact(side);
      return;
    }
    if (this.phase === 'aim') {
      if (k === 'ArrowLeft' || k === 'KeyA') return this.selectZone(Math.max(0, this.zone - 1) as Zone);
      if (k === 'ArrowRight' || k === 'KeyD') return this.selectZone(Math.min(4, this.zone + 1) as Zone);
      if (/^(Digit|Numpad)[1-5]$/.test(k)) return this.selectZone((Number(k.slice(-1)) - 1) as Zone);
    }
    if (!confirm && !(this.phase === 'power' && (k === 'Escape' || k === 'Backspace'))) return;
    if (this.phase === 'aim') this.confirmAim();
    else if (this.phase === 'power') confirm ? this.shoot() : this.backToAim();
    else if (this.phase === 'result' || this.phase === 'final') this.advance();
  }

  private selectZone(z: Zone) {
    if (z !== this.zone) this.sfx.select();
    this.zone = z;
    this.refreshUi();
  }

  private advance() {
    if (this.phase === 'result') {
      this.sfx.transition();
      this.nextTurn();
    } else if (this.phase === 'final') {
      this.phase = 'wait';
      this.d.onFinish(this.d.match.stats());
    }
  }

  // ---------- Sua cobrança ----------

  private confirmAim() {
    if (this.phase !== 'aim' || !this.meterParams || this.time.now < this.inputLockUntil) return;
    this.sfx.click();
    this.phase = 'power';
    this.meterStart = this.time.now;
    this.inputLockUntil = this.time.now + 150;
    this.refreshUi();
  }

  private backToAim() {
    this.phase = 'aim';
    this.trail = [];
    this.drawShotMeter(null, this.time.now);
    this.refreshUi();
  }

  private shotPosition(time: number): number {
    const p = this.meterParams!;
    return meterPosition((time - this.meterStart) / 1000, p.speed, p.wobble);
  }

  private shoot() {
    if (this.phase !== 'power' || !this.meterParams || this.time.now < this.inputLockUntil) return;
    const pos = this.shotPosition(this.time.now);
    this.meterStop = pos;
    this.trail = [];
    this.drawShotMeter(pos, this.time.now);
    const error = pos - this.meterParams.center;
    this.popGrade(...GRADE_LABEL[gradeTiming(error, this.meterParams.halfWidth)]);
    this.phase = 'flight';
    this.refreshUi();
    const o = this.d.match.kickUser(this.zone, error, this.meterParams.halfWidth);
    this.kicker!.runUp(KICKER_PLANT, () => {
      this.sfx.kick();
      const flight = flightMs(o.speed);
      this.flyBall(o.point, flight, () => this.impact(o, true));
      this.time.delayedCall(70, () => this.diveKeeper(o, flight - 50));
    });
  }

  private popGrade(label: string, color: string) {
    this.gradeText.setText(label).setColor(color).setScale(1.4);
    this.tweens.add({ targets: this.gradeText, scale: 1, duration: 180, ease: 'Back.out' });
  }

  // ---------- Você no gol ----------

  private opponentRunUp() {
    if (!this.guard || this.phase !== 'guard') return;
    this.kicker!.runUp(KICKER_PLANT, () => this.opponentStrike());
  }

  private setSlowMo(on: boolean) {
    const scale = on ? SLOWMO : 1;
    if (this.time.timeScale === scale) return;
    this.time.timeScale = scale;
    this.tweens.timeScale = scale;
  }

  /** Contato pé-bola: câmera lenta, e você tem o voo inteiro para reagir. */
  private opponentStrike() {
    const g = this.guard!;
    g.struck = true;
    this.sfx.kick();
    const s = this.d.match.strikeOpponent();
    g.flight = flightMs(s.speed);
    this.setSlowMo(true);
    this.gradeText.setText('');
    if (!this.d.demo) {
      this.drawGuardCols('react');
      this.reactCue.setVisible(true).setScale(1.4).setAlpha(1);
      this.tweens.add({ targets: this.reactCue, scale: 1, duration: 120, ease: 'Back.out' });
    }
    this.refreshUi();
    this.flyBall(s.point, g.flight, () => {
      this.setSlowMo(false);
      this.reactCue.setVisible(false);
      this.resolveGuard();
      this.impact(g.outcome!, false);
    }, (u) => (g.t = u));
    if (this.d.demo) {
      const read = Math.random() < 0.65;
      const side = (read ? this.ballSide(s.point) : [-1, 0, 1][Math.floor(Math.random() * 3)]) as Side;
      this.time.delayedCall(g.flight * (0.15 + Math.random() * 0.5), () => this.keeperReact(side));
    }
  }

  private sideAt(worldX: number): Side {
    return worldX < GOAL_LEFT + COL_W ? -1 : worldX > GOAL_LEFT + COL_W * 2 ? 1 : 0;
  }

  /** Sua reação: lado do mergulho; a altura o goleiro acerta sozinho. */
  private keeperReact(side: Side) {
    const g = this.guard;
    if (!g || g.outcome) return;
    if (!g.struck) return this.d.hud.hint(`Espere o chute: ${IS_TOUCH ? 'toque' : 'reaja'} quando a bola sair do pé do batedor`);
    g.side = side;
    g.reactAt = g.t;
    this.sfx.select();
    this.resolveGuard();
  }

  private resolveGuard() {
    const g = this.guard!;
    if (g.outcome) return;
    const o = this.d.match.kickOpponent({ side: g.side, at: g.side === null ? null : g.reactAt });
    g.outcome = o;
    const [label, color] = REACTION_LABEL[o.reaction];
    this.popGrade(label, color);
    this.diveKeeper(o, Math.max(60, (1 - g.t) * g.flight));
    this.reactCue.setVisible(false);
    if (!this.d.demo) this.drawGuardCols('done');
    this.refreshUi();
  }

  // ---------- Animação (só reproduz o resultado já resolvido) ----------

  private ballSide(p: GoalPoint) {
    return p.x < -0.3 ? -1 : p.x > 0.3 ? 1 : 0;
  }

  /** Ponto onde a bola encerra o voo: na trave, além do gol, ou no plano do gol. */
  private flightEnd(point: GoalPoint) {
    const p = { ...point };
    if (frameResult(p) === 'post') {
      if (Math.abs(p.x) > 0.95) p.x = Math.sign(p.x) * 1;
      else p.y = 1;
    }
    return toScreen(p);
  }

  private flyBall(point: GoalPoint, duration: number, onArrive: () => void, onProgress?: (u: number) => void) {
    const start = { x: this.ball.x, y: this.ball.y };
    const end = this.flightEnd(point);
    const side = Math.sign(point.x);
    const ctrl = { x: (start.x + end.x) / 2 - side * 26, y: Math.min(start.y, end.y) - 30 - point.y * 40 };
    const t = { v: 0 };
    this.tweens.add({
      targets: t, v: 1, duration, ease: 'Linear',
      onUpdate: () => {
        const u = t.v;
        const x = (1 - u) ** 2 * start.x + 2 * (1 - u) * u * ctrl.x + u * u * end.x;
        const y = (1 - u) ** 2 * start.y + 2 * (1 - u) * u * ctrl.y + u * u * end.y;
        this.ball.setPosition(x, y).setScale(1 - 0.45 * u).setRotation(u * 9);
        this.shadow.setPosition(x, Phaser.Math.Linear(SPOT.y + 1, GOAL.ground + 3, u)).setScale(1 - 0.45 * u).setAlpha(0.35 - 0.2 * u);
        onProgress?.(u);
      },
      onComplete: onArrive,
    });
  }

  private diveKeeper(o: KickOutcome, duration: number) {
    const end = this.flightEnd(o.point);
    const sameSide = o.dive === this.ballSide(o.point);
    let tx: number;
    let ty: number;
    if (o.result === 'saved') {
      tx = end.x; ty = end.y;
    } else if (sameSide && o.dive !== 0) {
      // Acertou o canto mas não alcança: fica alguns centímetros curto.
      tx = end.x - Math.sign(end.x - GOAL.cx) * 34;
      ty = Math.min(GOAL.ground - 10, end.y + 18);
    } else if (o.dive === 0) {
      tx = GOAL.cx; ty = this.ballSide(o.point) === 0 ? Math.max(end.y, GOAL.ground - GOAL.height) : GOAL.ground - 100;
    } else {
      tx = GOAL.cx + o.dive * GOAL.halfW * 0.7; ty = GOAL.ground - GOAL.height * 0.45;
    }
    this.keeper!.dive(tx, ty, GOAL.ground, o.dive, duration);
  }

  private impact(o: KickOutcome, user: boolean) {
    const end = { x: this.ball.x, y: this.ball.y };
    const side = Math.sign(o.point.x) || 1;
    const tw = this.tweens;
    if (o.result === 'goal') {
      if (user) this.sfx.goal(); else this.sfx.groan();
      const back = Stadium.backOf(end);
      this.ball.setDepth(2);
      tw.add({ targets: this.ball, x: back.x, y: back.y, scale: 0.48, duration: 110 });
      tw.add({ targets: this.shadow, alpha: 0, duration: 200 });
      const amp = { v: 0 };
      tw.add({
        targets: amp, v: 16, duration: 120, yoyo: true, hold: 60, ease: 'Quad.out',
        onUpdate: () => this.stadium.drawNet(back, amp.v),
        onComplete: () => this.stadium.drawNet(null, 0),
      });
      tw.add({ targets: this.ball, y: GOAL.ground - 26, duration: 520, delay: 200, ease: 'Bounce.out' });
      this.kicker!.celebrate(user ? this.d.player.celebration : this.raid ? 'cel-dance' : undefined);
      if (user) {
        this.stadium.cheer(4);
        this.burstConfetti(25);
      }
    } else if (o.result === 'saved') {
      this.sfx.save();
      tw.add({ targets: this.ball, x: end.x + side * 90, y: GOAL.ground + 70, scale: 0.75, rotation: -6, duration: 420, ease: 'Quad.out' });
      tw.add({ targets: this.shadow, x: end.x + side * 90, y: GOAL.ground + 76, duration: 420 });
      this.keeper!.celebrate();
      this.kicker!.dejected();
      if (!user) {
        this.sfx.goal();
        this.stadium.cheer(4);
        this.burstConfetti(20);
      }
    } else if (o.result === 'post') {
      this.sfx.post();
      this.cameras.main.shake(200, 0.006);
      tw.add({ targets: this.ball, x: end.x - side * 70, y: GOAL.ground + 120, scale: 0.8, duration: 520, ease: 'Quad.out' });
      tw.add({ targets: this.shadow, x: end.x - side * 70, y: GOAL.ground + 126, alpha: 0.3, duration: 520 });
      this.kicker!.dejected();
      if (!user) this.stadium.cheer(2);
    } else {
      if (user) this.sfx.groan(); else this.sfx.goal();
      this.ball.setDepth(2);
      const dir = { x: end.x - SPOT.x, y: end.y - SPOT.y };
      tw.add({ targets: this.ball, x: end.x + dir.x * 0.25, y: end.y + dir.y * 0.25, scale: 0.4, alpha: 0, duration: 380 });
      tw.add({ targets: this.shadow, alpha: 0, duration: 200 });
      this.kicker!.dejected();
      if (!user) this.stadium.cheer(2);
    }
    this.time.delayedCall(550, () => this.showResult(o, user));
  }

  private showResult(o: KickOutcome, user: boolean) {
    const m = this.d.match;
    if (this.d.demo) {
      this.phase = 'result';
      this.autoNext = this.time.delayedCall(1100, () => this.advance());
      return;
    }
    this.d.hud.update(m); // o resultado já estava resolvido; o placar só muda agora
    const s = m.shootout;
    const score = `${s.goals('a')} x ${s.goals('b')}`;
    const decided = m.turn === 'done';
    const prompt = decided ? 'ESPAÇO ou clique para o apito final' : 'ESPAÇO ou clique para continuar';
    if (user) {
      const [title, color] = RESULT_LABEL[o.result];
      this.showBanner(title, color, `${GRADE_LABEL[o.grade][0].replace('!', '')} · ${ZONE_NAMES[o.zone]} · ${score}`, prompt);
    } else {
      const k = o as DefendedKick;
      const [title, color] = DEFENSE_LABEL[o.result];
      const why = k.reaction === 'none' ? 'Você não reagiu'
        : k.dive !== this.ballSide(k.point) ? 'Pulou para o lado errado' : `Lado certo, reflexo ${REACTION_LABEL[k.reaction][2]}`;
      this.showBanner(title, color, `${why} · ${m.setup.opponent.short} · ${score}`, prompt);
    }
    this.phase = 'result';
    this.setZonesVisible(false);
    this.drawGuardCols('off');
    if (!user && !decided) this.autoNext = this.time.delayedCall(2000, () => this.phase === 'result' && this.advance());
  }

  private finale() {
    const m = this.d.match;
    if (this.d.demo) return this.d.onFinish(m.stats());
    const won = m.shootout.winner() === 'a';
    this.sfx.whistle();
    if (won) {
      this.stadium.cheer(6);
      this.burstConfetti(50);
    }
    this.setZonesVisible(false);
    this.drawGuardCols('off');
    this.pressureTag.setVisible(false);
    this.d.hud.hint('');
    this.showBanner(won ? 'VITÓRIA!' : 'DERROTA', won ? '#ffd23f' : '#ff6a5c',
      `${m.setup.club.short} ${m.shootout.goals('a')} x ${m.shootout.goals('b')} ${m.setup.opponent.short}`, 'ESPAÇO ou clique para ver o resultado');
    this.phase = 'final';
    this.refreshUi();
  }

  /** Balão de fala sobre o cobrador adversário (raids). */
  private speech(text: string) {
    const label = this.add.text(0, 0, text, { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#14110a', wordWrap: { width: 220 }, align: 'center' })
      .setOrigin(0.5).setResolution(2);
    const w = label.width + 26;
    const h = label.height + 16;
    const bg = this.add.graphics().fillStyle(0xffffff).lineStyle(2, 0x17110d)
      .fillRoundedRect(-w / 2, -h / 2, w, h, 12).strokeRoundedRect(-w / 2, -h / 2, w, h, 12)
      .fillTriangle(-10, h / 2 - 1, 8, h / 2 - 1, -18, h / 2 + 16).lineBetween(-10, h / 2, -18, h / 2 + 16).lineBetween(8, h / 2, -18, h / 2 + 16);
    const bubble = this.add.container(KICKER_START.x + 120, KICKER_START.y - 230, [bg, label]).setDepth(55).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: bubble, scale: 1, alpha: 1, duration: 220, ease: 'Back.out' });
    this.tweens.add({ targets: bubble, alpha: 0, delay: 1700, duration: 300, onComplete: () => bubble.destroy() });
  }

  /** Confete caindo das arquibancadas, longe do gol para não esconder o lance. */
  private burstConfetti(perSide: number) {
    for (const x of [140, 380, 900, 1140]) this.confetti.explode(perSide, x, 30);
  }

  // ---------- Interface dentro do campo ----------

  private createZones() {
    ZONE_TARGETS.forEach((t, i) => {
      const p = toScreen(t);
      const g = this.add.graphics({ x: p.x, y: p.y }).setDepth(15);
      // No toque o alvo é maior que o desenho (dedo cobre a zona).
      const hit = IS_TOUCH ? new Phaser.Geom.Rectangle(-40, -36, 80, 72) : new Phaser.Geom.Rectangle(-26, -26, 52, 52);
      g.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
      g.on('pointerover', () => { this.hoverZone = i as Zone; this.refreshUi(); });
      g.on('pointerout', () => { this.hoverZone = null; this.refreshUi(); });
      g.on('pointerdown', () => {
        if (this.phase === 'power' && IS_TOUCH) return this.shoot();
        if (this.phase !== 'aim') return;
        if (IS_TOUCH) {
          this.selectZone(i as Zone);
          return this.confirmAim();
        }
        if (this.zone !== i) this.selectZone(i as Zone); else this.confirmAim();
      });
      this.zoneMarkers.push(g);
      this.zoneLabels.push(this.add.text(p.x - 17, p.y - 19, String(i + 1), { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#ffffff' })
        .setDepth(16).setResolution(3));
    });
  }

  private createGuardCols() {
    this.guardCols = this.add.graphics().setDepth(14);
    (IS_TOUCH ? ['ESQUERDA', 'CENTRO', 'DIREITA'] : ['← A', '↓ S · ESPAÇO', 'D →']).forEach((label, i) => {
      this.guardLabels.push(this.add.text(GOAL_LEFT + COL_W * (i + 0.5), GOAL.ground + 12, label, {
        fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: '#07090cd9', padding: { x: 8, y: 3 },
      }).setOrigin(0.5, 0).setDepth(55).setResolution(2));
    });
    this.reactCue = this.add.text(GOAL.cx, GOAL.ground - GOAL.height - 34, 'REAJA!',
      { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#5bd8ff' }).setOrigin(0.5).setDepth(55).setResolution(2).setVisible(false);
  }

  /** Faixas esquerda/centro/direita sobre o gol: apagadas antes do chute, acesas na reação. */
  private drawGuardCols(state: 'off' | 'wait' | 'react' | 'done') {
    const g = this.guardCols.clear();
    this.guardLabels.forEach((t, i) => t.setVisible(state !== 'off')
      .setAlpha(state === 'wait' ? 0.6 : state === 'done' && this.guard?.side !== i - 1 ? 0.25 : 1)
      .setColor(state === 'done' && this.guard?.side === i - 1 ? '#5bd8ff' : '#ffffff'));
    if (state === 'off') return;
    const top = GOAL.ground - GOAL.height;
    for (let i = 0; i < 3; i++) {
      const x = GOAL_LEFT + COL_W * i;
      const chosen = state === 'done' && this.guard?.side === i - 1;
      if (state === 'react' || chosen) g.fillStyle(DEFENSE_ACCENT, chosen ? 0.3 : 0.1).fillRect(x + 3, top + 3, COL_W - 6, GOAL.height - 6);
      g.lineStyle(2, chosen ? DEFENSE_ACCENT : 0xffffff, state === 'wait' ? 0.25 : chosen ? 1 : state === 'react' ? 0.7 : 0.15)
        .strokeRect(x + 3, top + 3, COL_W - 6, GOAL.height - 6);
    }
  }

  private setZonesVisible(v: boolean) {
    [...this.zoneMarkers, ...this.zoneLabels].forEach((o) => o.setVisible(v));
  }

  private refreshUi() {
    const accent = 0xffd23f;
    const accentCss = '#ffd23f';
    const open = this.phase === 'aim';
    this.zoneMarkers.forEach((g, i) => {
      g.clear();
      const sel = i === this.zone;
      const alpha = !open && !sel ? 0.15 : 1;
      g.setAlpha(alpha);
      this.zoneLabels[i].setAlpha(alpha).setColor(sel ? accentCss : '#ffffff');
      g.fillStyle(sel ? accent : 0x0b0f14, sel ? 0.3 : this.hoverZone === i && open ? 0.45 : 0.28).fillRoundedRect(-22, -22, 44, 44, 8);
      g.lineStyle(sel ? 3 : 2, sel ? accent : 0xffffff, sel ? 1 : 0.85).strokeRoundedRect(-22, -22, 44, 44, 8);
      if (sel) g.fillStyle(accent).fillCircle(0, 0, 4);
    });

    // No toque a mira se confirma tocando a zona; o botão aparece só para chutar.
    this.kickBtn.setVisible(!this.d.demo && (this.phase === 'power' || (this.phase === 'aim' && !IS_TOUCH)));
    this.kickBtnLabel.setText(this.phase === 'power' ? 'CHUTAR' : 'CONFIRMAR');
    this.kickBtnBg.clear().fillStyle(0xffd23f).fillRoundedRect(-62, -20, 124, 40, 8);
    const hints: Partial<Record<Phase, string>> = IS_TOUCH ? {
      aim: 'Toque na zona do gol onde quer chutar',
      power: 'Toque na tela quando o marcador estiver na faixa dourada',
      guard: 'VOCÊ NO GOL: espere o chute e toque o lado para onde a bola vai',
    } : {
      aim: 'A/D ou ←/→ para mirar  ·  1–5 escolhe a zona  ·  ESPAÇO ou clique para confirmar',
      power: 'ESPAÇO, clique ou CHUTAR para parar o marcador na faixa dourada  ·  ESC volta à mira',
      guard: 'VOCÊ NO GOL: espere o chute e veja a bola  ·  ← A esquerda  ·  ↓ S ou ESPAÇO centro  ·  → D direita  ·  ou clique no gol',
    };
    // Depois do chute o "REAJA!" sobre o gol já diz o que fazer.
    this.d.hud.hint(this.phase === 'guard' && this.guard?.struck ? '' : hints[this.phase] ?? '');
  }

  /**
   * Deitado (16:9) a câmera mostra o campo todo; em pé (9:16) ela fecha no lance e a barra e o
   * botão vão para baixo, maiores. Tudo continua nas coordenadas do mundo 1280x720.
   */
  private applyLayout() {
    const { width, height } = this.scale.gameSize;
    const cam = this.cameras.main.setSize(width, height);
    if (height > width) {
      const VIEW_W = 560;
      const zoom = width / VIEW_W;
      cam.setZoom(zoom).centerOn(640, 425);
      const bottom = 425 + height / zoom / 2; // barra e botão presos ao rodapé, seja qual for a altura da tela
      const s = 1.25;
      this.meterBox.setScale(s).setPosition(640 - s * (METER.x + METER.w / 2), bottom - 160 - s * METER.y);
      this.kickBtn.setPosition(640, bottom - 52).setScale(1.9);
      this.banner.setPosition(640, 468);
      this.bannerScale = 0.7;
    } else {
      cam.setZoom(width / 1280).centerOn(this.d.demo ? 420 : 640, 360);
      this.meterBox.setScale(1).setPosition(0, 0);
      this.kickBtn.setPosition(METER.x - (IS_TOUCH ? 128 : 100), METER.y + METER.h / 2).setScale(IS_TOUCH ? 1.45 : 1);
      this.banner.setPosition(640, 140);
      this.bannerScale = 1;
    }
    if (this.banner.visible) this.banner.setScale(this.bannerScale);
  }

  private createMeter() {
    const { x, y, w, h } = METER;
    const txt = (tx: number, ty: number, size: number, color: string) =>
      this.add.text(tx, ty, '', { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color }).setResolution(2);
    const panel = this.add.graphics().fillStyle(0x07090c, 0.8).fillRoundedRect(x - 16, y - 44, w + 32, h + 82, 12);
    this.meterTitle = txt(x, y - 34, 14, '#e8e2d0');
    this.pressureTag = txt(x + 160, y - 33, 12, '#ff6a5c').setVisible(false);
    this.tweens.add({ targets: this.pressureTag, alpha: { from: 1, to: 0.35 }, duration: 420, yoyo: true, repeat: -1 });
    this.gradeText = txt(x + w, y - 38, 20, '#ffd23f').setOrigin(1, 0);
    this.meterLeft = txt(x, y + h + 12, 11, '#9fb0a6');
    this.meterRight = txt(x + w, y + h + 12, 11, '#9fb0a6').setOrigin(1, 0);
    this.meterG = this.add.graphics();
    const hit = this.add.zone(x + w / 2, y + h / 2, w + 20, h + 24).setInteractive();
    hit.on('pointerdown', () => this.phase === 'power' && this.shoot());
    this.meterBox = this.add.container(0, 0, [panel, this.meterTitle, this.pressureTag, this.gradeText, this.meterLeft, this.meterRight, this.meterG, hit])
      .setDepth(50);

    this.kickBtnBg = this.add.graphics();
    this.kickBtnLabel = this.add.text(0, 0, 'CONFIRMAR', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#14110a' })
      .setOrigin(0.5).setResolution(2);
    this.kickBtn = this.add.container(0, 0, [this.kickBtnBg, this.kickBtnLabel]).setDepth(50)
      .setSize(124, 40).setInteractive({ useHandCursor: true });
    this.meterUi.push(this.meterBox, this.kickBtn);
    this.kickBtn.on('pointerdown', () => {
      if (this.phase === 'aim') this.confirmAim();
      else if (this.phase === 'power') this.shoot();
    });
  }

  private setMeterMode(mode: 'shot' | 'reflex') {
    const shot = mode === 'shot';
    this.meterTitle.setText(shot ? 'PRECISÃO E FORÇA' : 'REAÇÃO DO GOLEIRO');
    this.meterLeft.setText(shot ? 'CEDO · a bola abre' : 'RÁPIDO · mais alcance');
    this.meterRight.setText(shot ? 'TARDE · a bola sobe' : 'TARDE · bola chegando');
  }

  /** Trilho, marcações a cada 10% e moldura comuns às duas barras. */
  private meterBase(g: Phaser.GameObjects.Graphics) {
    const { x, y, w, h } = METER;
    g.fillStyle(0x222b36).fillRoundedRect(x, y, w, h, 5);
    g.fillStyle(0xffffff, 0.18);
    for (let i = 1; i < 10; i++) g.fillRect(x + (w * i) / 10 - 0.5, y + h + 2, 1, 5);
  }

  private band(g: Phaser.GameObjects.Graphics, from: number, to: number, color: number, alpha: number) {
    const { x, y, w, h } = METER;
    const a = Phaser.Math.Clamp(from, 0, 1);
    const b = Phaser.Math.Clamp(to, 0, 1);
    if (b > a) g.fillStyle(color, alpha).fillRect(x + a * w, y, (b - a) * w, h);
  }

  private needle(g: Phaser.GameObjects.Graphics, pos: number, color = 0xffffff) {
    const { x, y, w, h } = METER;
    const mx = x + pos * w;
    g.fillStyle(0x000000, 0.45).fillRect(mx - 3, y - 6, 6, h + 12);
    g.fillStyle(color).fillRect(mx - 2, y - 7, 4, h + 14);
    g.fillTriangle(mx - 8, y - 13, mx + 8, y - 13, mx, y - 4);
  }

  private drawShotMeter(pos: number | null, time: number) {
    const g = this.meterG.clear();
    this.meterBase(g);
    const p = this.meterParams;
    if (!p) return;
    const active = this.phase === 'power' || this.meterStop !== null;
    const dim = active ? 1 : 0.5;
    const pulse = active && this.meterStop === null ? 0.75 + 0.25 * Math.sin(time / 90) : 1;
    this.band(g, p.center - p.halfWidth * 5, p.center + p.halfWidth * 5, 0x6f7f8f, 0.65 * dim);
    this.band(g, p.center - p.halfWidth * 2.5, p.center + p.halfWidth * 2.5, 0x5be08a, 0.85 * dim);
    this.band(g, p.center - p.halfWidth, p.center + p.halfWidth, 0xffd23f, dim * pulse);
    this.trail.slice(1).forEach((t, i) => g.fillStyle(0xffffff, 0.22 - i * 0.04).fillRect(METER.x + t * METER.w - 2, METER.y, 4, METER.h));
    if (pos !== null) this.needle(g, pos);
  }

  /** Barra de reação: o marcador acompanha o voo da bola; congela quando você reage. */
  private drawReactionMeter() {
    const g = this.meterG.clear();
    const gd = this.guard!;
    this.meterBase(g);
    const dim = gd.struck ? 1 : 0.45;
    this.band(g, 0, REACTION.fast, DEFENSE_ACCENT, dim);
    this.band(g, REACTION.fast, REACTION.good, 0x5be08a, 0.85 * dim);
    this.band(g, REACTION.good, REACTION.late, 0xa0602a, 0.8 * dim);
    this.band(g, REACTION.late, 1, 0x8a3a33, 0.8 * dim);
    if (!gd.struck) return;
    const reacted = gd.outcome !== null && gd.side !== null;
    this.needle(g, reacted ? gd.reactAt : gd.t, reacted ? DEFENSE_ACCENT : 0xffffff);
  }

  private createBanner() {
    const band = this.add.graphics().fillStyle(0x07090c, 0.86).fillRect(-640, -72, 1280, 144);
    band.fillStyle(0xffd23f).fillRect(-640, -72, 1280, 3).fillRect(-640, 69, 1280, 3);
    this.bannerTitle = this.add.text(0, -26, '', { fontFamily: FONT, fontSize: '68px', fontStyle: 'bold', color: '#ffd23f' })
      .setOrigin(0.5).setResolution(2);
    this.bannerSub = this.add.text(0, 22, '', { fontFamily: FONT, fontSize: '20px', color: '#e8e2d0' }).setOrigin(0.5).setResolution(2);
    this.bannerPrompt = this.add.text(0, 50, '', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#9fb0a6' })
      .setOrigin(0.5).setResolution(2);
    this.banner = this.add.container(640, 140, [band, this.bannerTitle, this.bannerSub, this.bannerPrompt]).setDepth(60).setVisible(false);
  }

  private showBanner(title: string, color: string, sub: string, prompt: string) {
    this.bannerTitle.setText(title).setColor(color).setScale(1.35);
    this.bannerSub.setText(sub);
    this.bannerPrompt.setText(prompt).setAlpha(0);
    this.banner.setVisible(true).setScale(this.bannerScale, 0);
    this.tweens.add({ targets: this.banner, scaleY: this.bannerScale, duration: 160, ease: 'Quad.out' });
    this.tweens.add({ targets: this.bannerTitle, scale: 1, duration: 260, ease: 'Back.out' });
    this.tweens.add({ targets: this.bannerPrompt, alpha: { from: 0, to: 1 }, delay: 350, duration: 300 });
  }
}
