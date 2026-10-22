import Phaser from 'phaser';
import { FONT } from '../data/appearance';
import type { Special } from '../data/specials';
import { clubKit, figureSkin, type FigureSkin, type Part } from '../entities/figureArt';
import { Kicker } from '../entities/Figures';
import { GOAL, toScreen, type Stadium } from '../entities/Stadium';
import { ZONE_TARGETS } from '../systems/PenaltyResolver';
import type { Zone } from '../types';
import type { IncidentCtx } from './MatchEvents';

/** Cutscenes e alvos dos raids. */

export const sleep = (scene: Phaser.Scene, ms: number) => new Promise<void>((r) => scene.time.delayedCall(ms, r));
export const tween = (scene: Phaser.Scene, cfg: Phaser.Types.Tweens.TweenBuilderConfig) =>
  new Promise<void>((r) => scene.tweens.add({ ...cfg, onComplete: () => r() }));

const OL = 0x17110d;
type Limbs = { armL: Phaser.GameObjects.Container; armR: Phaser.GameObjects.Container; legL: Phaser.GameObjects.Container; legR: Phaser.GameObjects.Container };

/** Naves dos raids, cada uma com sua piada visual. */
export function ship(scene: Phaser.Scene, sp: Special): Phaser.GameObjects.Container {
  const c = scene.add.container(-200, -320).setDepth(46);
  const g = scene.add.graphics();
  const parts: Phaser.GameObjects.GameObject[] = [g];
  if (sp.ship === 'drone') {
    // Drone ciborgue: hexágono com um olho vermelho e hélices
    g.fillStyle(0x3a4452).lineStyle(2, OL).fillPoints([{ x: -50, y: 0 }, { x: -28, y: -24 }, { x: 28, y: -24 }, { x: 50, y: 0 }, { x: 28, y: 22 }, { x: -28, y: 22 }] as Phaser.Types.Math.Vector2Like[], true)
      .strokePoints([{ x: -50, y: 0 }, { x: -28, y: -24 }, { x: 28, y: -24 }, { x: 50, y: 0 }, { x: 28, y: 22 }, { x: -28, y: 22 }] as Phaser.Types.Math.Vector2Like[], true);
    g.fillStyle(0x111111).fillCircle(0, 0, 13).fillStyle(0xff3b3b).fillCircle(0, 0, 8).fillStyle(0xffd0d0).fillCircle(-3, -3, 2.4);
    for (const x of [-46, 46]) {
      const prop = scene.add.rectangle(x, -30, 46, 5, 0x9aa3ad).setStrokeStyle(1.5, OL);
      scene.tweens.add({ targets: prop, scaleX: { from: 1, to: -1 }, duration: 90, yoyo: true, repeat: -1 });
      parts.push(prop);
    }
    parts.push(scene.add.text(0, 34, 'PROTOCOLO RAID', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#5bd8ff' }).setOrigin(0.5).setResolution(2));
  } else {
    // Disco: casco, cúpula e o "tripulante" espiando
    const hull = sp.ship === 'dog' ? 0xb07a45 : sp.ship === 'cat' ? 0x24242a : 0xaeb6c2;
    g.fillStyle(0x9fe7ff, 0.95).fillEllipse(0, -16, 50, 34).lineStyle(2, OL).strokeEllipse(0, -16, 50, 34);
    if (sp.ship === 'saucer') g.fillStyle(0x7ddc6a).fillEllipse(0, -18, 18, 20).fillStyle(0x0d0d12).fillEllipse(-4, -20, 6, 4).fillEllipse(4, -20, 6, 4);
    if (sp.ship === 'cat') g.fillStyle(0xd9e85a).fillEllipse(-7, -18, 9, 7).fillEllipse(7, -18, 9, 7).fillStyle(0x111111).fillEllipse(-7, -18, 2, 6).fillEllipse(7, -18, 2, 6);
    if (sp.ship === 'dog') g.fillStyle(0x17110d).fillEllipse(0, -12, 10, 7).fillStyle(0xff6f91).fillEllipse(0, -4, 6, 9);
    g.fillStyle(hull).fillEllipse(0, 0, 130, 32).lineStyle(2, OL).strokeEllipse(0, 0, 130, 32);
    g.fillStyle(0x000000, 0.25).fillEllipse(0, 7, 96, 12);
    if (sp.ship === 'dog') {
      // orelhas caídas e rabo abanando
      g.fillStyle(0x6b4026).lineStyle(2, OL).fillEllipse(-62, 14, 20, 40).strokeEllipse(-62, 14, 20, 40).fillEllipse(62, 14, 20, 40).strokeEllipse(62, 14, 20, 40);
      const tail = scene.add.rectangle(70, -6, 30, 8, 0xb07a45).setOrigin(0, 0.5).setStrokeStyle(1.5, OL);
      scene.tweens.add({ targets: tail, rotation: { from: -0.6, to: -1.4 }, duration: 120, yoyo: true, repeat: -1 });
      parts.push(tail);
    }
    if (sp.ship === 'cat') {
      // orelhas pontudas, bigodes e um novelo pendurado
      g.fillStyle(0x24242a).lineStyle(2, OL).fillTriangle(-40, -6, -26, -40, -14, -10).strokeTriangle(-40, -6, -26, -40, -14, -10)
        .fillTriangle(40, -6, 26, -40, 14, -10).strokeTriangle(40, -6, 26, -40, 14, -10);
      g.lineStyle(1.5, 0xf4f1e8).lineBetween(-66, -2, -96, -10).lineBetween(-66, 4, -98, 4).lineBetween(66, -2, 96, -10).lineBetween(66, 4, 98, 4);
      const yarn = scene.add.container(0, 0);
      const yg = scene.add.graphics().lineStyle(1.5, 0xf4f1e8).lineBetween(0, 14, 0, 58).fillStyle(0xff4fa3).fillCircle(0, 64, 9).lineStyle(1, 0xffffff, 0.7).strokeCircle(0, 64, 6);
      yarn.add(yg);
      scene.tweens.add({ targets: yarn, rotation: { from: -0.35, to: 0.35 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      parts.push(yarn);
    }
    const lights = [-44, -22, 0, 22, 44].map((x, i) => scene.add.circle(x, 3, 4, [0xffd23f, 0x5bd8ff, 0xff4fa3][i % 3]));
    scene.tweens.add({ targets: lights, alpha: 0.2, duration: 200, yoyo: true, repeat: -1 });
    parts.push(...lights);
  }
  c.add(parts);
  return c;
}

// ---------- Linguagem de cinema ----------

/** Barras pretas de cinema; a função devolvida as recolhe. */
export function cinema(scene: Phaser.Scene): () => Promise<void> {
  const v = scene.cameras.main.worldView;
  const h = Math.round(v.height * 0.1);
  const top = scene.add.rectangle(v.x - 20, v.y - h, v.width + 40, h, 0x000000).setOrigin(0).setDepth(70);
  const bottom = scene.add.rectangle(v.x - 20, v.bottom, v.width + 40, h, 0x000000).setOrigin(0).setDepth(70);
  scene.tweens.add({ targets: top, y: v.y, duration: 380, ease: 'Quad.out' });
  scene.tweens.add({ targets: bottom, y: v.bottom - h, duration: 380, ease: 'Quad.out' });
  return async () => {
    scene.tweens.add({ targets: top, y: v.y - h, duration: 320, ease: 'Quad.in' });
    await tween(scene, { targets: bottom, y: v.bottom, duration: 320, ease: 'Quad.in' });
    top.destroy();
    bottom.destroy();
  };
}

export interface Speaker { name: string; color: string; head?: Part }

/** Fala com retrato e texto datilografado; avança com clique/toque/Espaço (ou sozinha, depois de um tempo). */
export function say(scene: Phaser.Scene, who: Speaker, text: string): Promise<void> {
  const v = scene.cameras.main.worldView;
  const w = Math.min(860, v.width - 28);
  const portrait = who.head ? 96 : 0;
  const pad = 18;
  const style = { fontFamily: FONT, fontSize: '22px', color: '#f4f1e8', wordWrap: { width: w - portrait - pad * 2 }, lineSpacing: 4 };
  const label = scene.add.text(0, 0, text, style).setResolution(2);
  const h = Math.max(portrait + 12, label.height + 64);
  const x = v.centerX - w / 2;
  // No alto da tela, para não cobrir os personagens (os pés ficam perto da barra de baixo)
  const y = v.y + v.height * 0.1 + (v.width > v.height ? 56 : v.height * 0.1);
  label.setPosition(x + portrait + pad, y + 40).setText('');
  const bg = scene.add.graphics().fillStyle(0x07090c, 0.94).lineStyle(3, Phaser.Display.Color.HexStringToColor(who.color).color)
    .fillRoundedRect(x, y, w, h, 14).strokeRoundedRect(x, y, w, h, 14);
  const name = scene.add.text(x + portrait + pad, y + 12, who.name.toUpperCase(), { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: who.color }).setResolution(2);
  const more = scene.add.text(x + w - 14, y + h - 10, 'ESPAÇO ou toque ›', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#9fb0a6' })
    .setOrigin(1, 1).setResolution(2).setAlpha(0);
  const objs: Phaser.GameObjects.GameObject[] = [bg, label, name, more];
  if (who.head) {
    const frame = scene.add.graphics().fillStyle(0x1b2430).fillRoundedRect(x + 10, y + 10, portrait - 6, h - 20, 10);
    const img = scene.add.image(x + 10 + (portrait - 6) / 2, y + h / 2 + 6, who.head.key);
    img.setScale(Math.min((portrait - 14) / img.width, (h - 24) / img.height) * 1.15);
    objs.splice(1, 0, frame, img);
  }
  const box = scene.add.container(0, 0, objs).setDepth(72).setAlpha(0);
  scene.tweens.add({ targets: box, alpha: 1, duration: 150 });

  return new Promise((resolve) => {
    let shown = 0;
    const typer = scene.time.addEvent({
      delay: 22, repeat: text.length - 1,
      callback: () => {
        label.setText(text.slice(0, ++shown));
        if (shown === text.length) more.setAlpha(1);
      },
    });
    const auto = scene.time.delayedCall(2600 + text.length * 50, () => done());
    const next = () => {
      if (shown < text.length) {
        shown = text.length;
        typer.remove();
        label.setText(text);
        more.setAlpha(1);
      } else done();
    };
    const onKey = (e: KeyboardEvent) => ['Space', 'Enter', 'NumpadEnter'].includes(e.code) && next();
    scene.input.on('pointerdown', next);
    scene.input.keyboard?.on('keydown', onKey);
    let over = false;
    function done() {
      if (over) return;
      over = true;
      typer.remove();
      auto.remove();
      scene.input.off('pointerdown', next);
      scene.input.keyboard?.off('keydown', onKey);
      box.destroy();
      resolve();
    }
  });
}

/** Capitão do time do raid, de frente (cutscenes e retratos). */
export function captainSkin(scene: Phaser.Scene, sp: Special): Promise<FigureSkin> {
  return figureSkin(scene, 'front', { skin: 0, hair: 0, hairColor: 0 }, clubKit(sp.team), { species: sp.species, skinColor: sp.skins[0], number: 10 });
}

/** Caminhada com passadas até `x`. */
async function walk(scene: Phaser.Scene, fig: Kicker, x: number, duration: number) {
  const tw = scene.tweens;
  const legs = [
    tw.add({ targets: fig.legL, rotation: { from: -0.45, to: 0.45 }, duration: 160, yoyo: true, repeat: -1 }),
    tw.add({ targets: fig.legR, rotation: { from: 0.45, to: -0.45 }, duration: 160, yoyo: true, repeat: -1 }),
    tw.add({ targets: [fig.armL, fig.armR], rotation: { from: -0.35, to: 0.35 }, duration: 160, yoyo: true, repeat: -1 }),
  ];
  await tween(scene, { targets: fig, x, duration, ease: 'Sine.inOut' });
  legs.forEach((t) => t.stop());
  fig.legL.rotation = fig.legR.rotation = fig.armL.rotation = fig.armR.rotation = 0;
}

/** Cone de luz entre a nave e o chão. */
function beam(scene: Phaser.Scene, color: number, x: number, groundY: number) {
  const top = 268;
  return scene.add.polygon(0, 0, [x + 8, top, x + 52, top, x + 110, groundY + 6, x - 50, groundY + 6], color, 0.3).setOrigin(0).setDepth(29).setAlpha(0);
}

function flail(scene: Phaser.Scene, p: Phaser.GameObjects.Container) {
  const fig = p as unknown as Limbs;
  scene.tweens.add({ targets: fig.armL, rotation: { from: 1.8, to: 3 }, duration: 110, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: fig.armR, rotation: { from: -1.8, to: -3 }, duration: 130, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: [fig.legL, fig.legR], rotation: { from: -0.5, to: 0.5 }, duration: 120, yoyo: true, repeat: -1 });
}

/** Nave chega sobre `x` e fica balançando; devolve a nave e para o balanço. */
async function arrive(scene: Phaser.Scene, sp: Special, x: number) {
  const craft = ship(scene, sp);
  await tween(scene, { targets: craft, x: x + 30, y: 250, duration: 1300, ease: 'Back.out' });
  // Só balança depois de chegar: dois tweens no mesmo y brigariam e prenderiam a nave fora da tela.
  const bob = scene.tweens.add({ targets: craft, y: 258, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  return { craft, stop: () => bob.stop() };
}

async function leave(scene: Phaser.Scene, craft: Phaser.GameObjects.Container) {
  await tween(scene, { targets: craft, x: craft.x - 60, duration: 160, yoyo: true });
  await tween(scene, { targets: craft, x: 1500, y: -420, scale: 0.4, duration: 700, ease: 'Back.in' });
  craft.destroy();
}

/** O raio puxa o jogador (girando e encolhendo) para dentro da nave. */
async function beamUp(scene: Phaser.Scene, sp: Special, player: Phaser.GameObjects.Container, yell: string) {
  const { craft, stop } = await arrive(scene, sp, player.x);
  const cone = beam(scene, sp.beam, player.x, player.y);
  await tween(scene, { targets: cone, alpha: 1, duration: 280 });
  flail(scene, player);
  const text = scene.add.text(player.x + 70, player.y - 190, yell, {
    fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#ffffff', stroke: '#17110d', strokeThickness: 6,
  }).setOrigin(0.5).setDepth(55).setRotation(-0.12);
  scene.tweens.add({ targets: text, scale: { from: 0.9, to: 1.15 }, duration: 160, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: text, y: 258, x: player.x + 90, alpha: 0, duration: 1900, ease: 'Sine.in' });
  await tween(scene, { targets: player, y: 288, x: player.x + 30, scale: 0.25, rotation: Math.PI * 4, duration: 1800, ease: 'Sine.in' });
  player.setVisible(false);
  text.destroy();
  stop();
  cone.destroy();
  await leave(scene, craft);
  scene.cameras.main.flash(220, 255, 255, 255, false);
  player.destroy();
}

/** Abdução no meio da disputa da carreira: o capitão avisa, o raio leva o jogador. */
export async function playRaid(scene: Phaser.Scene, ctx: IncidentCtx): Promise<void> {
  const sp = ctx.special!;
  const closeBars = cinema(scene);
  ctx.toast(sp.title, sp.intro);
  ctx.sfx.ufo();
  const [player, cap] = await Promise.all([ctx.spawnPlayer(), captainSkin(scene, sp)]);
  ctx.stadium.cheer(5);
  await sleep(scene, 900);
  await say(scene, { name: sp.captain, color: '#5bd8ff', head: cap.head }, sp.lines.abduct);
  await beamUp(scene, sp, player, 'AAAAAH!');
  await closeBars();
  await sleep(scene, 300);
}

// ---------- Chegada e despedida no planeta do raid ----------

export interface RaidCtx {
  sp: Special;
  stadium: Stadium;
  sfx: { ufo(): void; goal(): void; groan(): void };
  /** Você de costas na marca (já criado, invisível até a nave soltar) */
  player: Kicker;
  playerName: string;
  playerHead: Part;
  captain: FigureSkin;
  celebration?: string;
}

const CAPTAIN_SPOT = { x: 800, y: 640, scale: 1.2 };

/** Tonturinha: bolinhas girando sobre a cabeça. */
function dizzy(scene: Phaser.Scene, x: number, y: number) {
  const stars = [0, 1, 2].map(() => scene.add.circle(x, y, 5, 0xffd23f).setStrokeStyle(1.5, OL).setDepth(56));
  const t = { a: 0 };
  scene.tweens.add({
    targets: t, a: Math.PI * 2, duration: 700, repeat: -1,
    onUpdate: () => stars.forEach((st, i) => st.setPosition(x + Math.cos(t.a + i * 2.1) * 26, y + Math.sin(t.a + i * 2.1) * 8)),
  });
  return { destroy: () => { scene.tweens.killTweensOf(t); stars.forEach((st) => st.destroy()); } };
}

/** Cutscene de chegada: a nave solta o jogador tonto e o capitão faz o desafio e apresenta o alvo. */
export async function raidIntro(scene: Phaser.Scene, ctx: RaidCtx): Promise<void> {
  const { sp, player } = ctx;
  const closeBars = cinema(scene);
  const v = scene.cameras.main.worldView;
  const place = scene.add.text(v.centerX, v.y + v.height * 0.2, sp.place.toUpperCase(), {
    fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#ffffff', stroke: '#17110d', strokeThickness: 7, align: 'center', wordWrap: { width: v.width - 40 },
  }).setOrigin(0.5).setDepth(71).setAlpha(0);
  scene.tweens.add({ targets: place, alpha: 1, duration: 500 });
  ctx.sfx.ufo();

  // A nave chega e o raio desce o jogador, girando
  const home = { x: player.x, y: player.y, scale: player.scale };
  const { craft, stop } = await arrive(scene, sp, home.x);
  const cone = beam(scene, sp.beam, home.x, home.y);
  await tween(scene, { targets: cone, alpha: 1, duration: 280 });
  player.setPosition(home.x + 30, 288).setScale(0.25).setRotation(Math.PI * 4).setAlpha(1).setVisible(true);
  await tween(scene, { targets: player, x: home.x, y: home.y, scale: home.scale, rotation: 0, duration: 1500, ease: 'Sine.out' });
  await tween(scene, { targets: player, y: home.y - 14, duration: 140, yoyo: true, ease: 'Quad.out' });
  const stars = dizzy(scene, home.x, home.y - 168);
  scene.tweens.add({ targets: player.torso, rotation: { from: -0.12, to: 0.12 }, duration: 300, yoyo: true, repeat: 3 });
  await tween(scene, { targets: cone, alpha: 0, duration: 250 });
  cone.destroy();
  stop();
  void leave(scene, craft);
  scene.tweens.add({ targets: place, alpha: 0, delay: 600, duration: 500, onComplete: () => place.destroy() });
  ctx.stadium.cheer(4);

  // O capitão entra e provoca
  const cap = new Kicker(scene, v.right + 80, CAPTAIN_SPOT.y, ctx.captain).setScale(CAPTAIN_SPOT.scale).setDepth(31);
  await walk(scene, cap, Math.min(CAPTAIN_SPOT.x, v.right - 70), 1100);
  stars.destroy();
  const capSpeaker = { name: sp.captain, color: '#5bd8ff', head: ctx.captain.head };
  await say(scene, capSpeaker, sp.lines.arrive[0]);
  await say(scene, { name: ctx.playerName, color: '#ffd23f', head: ctx.playerHead }, sp.lines.reply);
  await say(scene, capSpeaker, sp.lines.arrive[1]);
  const demo = new RaidTarget(scene, sp, 2 as Zone);
  await say(scene, capSpeaker, sp.lines.target);
  demo.destroy();
  cap.setScale(-CAPTAIN_SPOT.scale, CAPTAIN_SPOT.scale);
  await walk(scene, cap, v.right + 90, 900);
  cap.destroy();
  scene.tweens.add({ targets: player, alpha: 0, duration: 200 });
  await closeBars();
  player.destroy();
}

/** Cutscene final: o capitão reage ao resultado e a nave leva você de volta à Terra. */
export async function raidOutro(scene: Phaser.Scene, ctx: RaidCtx, won: boolean): Promise<void> {
  const { sp, player } = ctx;
  const closeBars = cinema(scene);
  const v = scene.cameras.main.worldView;
  player.setAlpha(1).setVisible(true);
  const cap = new Kicker(scene, v.right + 80, CAPTAIN_SPOT.y, ctx.captain).setScale(CAPTAIN_SPOT.scale).setDepth(31);
  await walk(scene, cap, Math.min(CAPTAIN_SPOT.x, v.right - 70), 1000);
  if (won) {
    player.celebrate(ctx.celebration);
    cap.dejected();
    ctx.sfx.goal();
    ctx.stadium.cheer(3);
  } else {
    cap.celebrate('cel-dance');
    player.dejected();
    ctx.sfx.groan();
  }
  await say(scene, { name: sp.captain, color: '#5bd8ff', head: ctx.captain.head }, won ? sp.lines.win : sp.lines.lose);
  ctx.sfx.ufo();
  await beamUp(scene, sp, player, won ? 'ATÉ NUNCA MAIS!' : 'ME LEVA PRA CASA!');
  cap.destroy();
  await closeBars();
}

// ---------- Alvos temáticos ----------

const BOOM: Record<Special['target']['kind'], string> = { ship: 'KABUM!', drone: 'BZZZT!', bone: 'CRAC!', yarn: 'BOING!' };

/** Alvo flutuando numa zona do gol: acerte a bola nele (gol nessa zona) para derrubá-lo. */
export class RaidTarget extends Phaser.GameObjects.Container {
  readonly zone: Zone;
  private art: Phaser.GameObjects.Container;
  private ring: Phaser.GameObjects.Graphics;
  private tag: Phaser.GameObjects.Text;
  private kind: Special['target']['kind'];

  constructor(scene: Phaser.Scene, sp: Special, zone: Zone) {
    const p = toScreen(ZONE_TARGETS[zone]);
    super(scene, p.x, p.y);
    this.zone = zone;
    this.kind = sp.target.kind;
    this.art = scene.add.container(0, 0, this.draw(scene));
    this.ring = scene.add.graphics().lineStyle(3, 0xffd23f, 0.95).strokeCircle(0, 0, 36);
    const tag = this.tag = scene.add.text(0, -50, 'ALVO', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#14110a', backgroundColor: '#ffd23f', padding: { x: 6, y: 2 } })
      .setOrigin(0.5).setResolution(2);
    this.add([this.ring, this.art, tag]).setDepth(17).setScale(0);
    scene.add.existing(this);
    scene.tweens.add({ targets: this, scale: 1, duration: 320, ease: 'Back.out' });
    scene.tweens.add({ targets: this.art, y: -6, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    scene.tweens.add({ targets: this.ring, scale: { from: 0.9, to: 1.1 }, alpha: { from: 1, to: 0.45 }, duration: 500, yoyo: true, repeat: -1 });
  }

  private draw(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
    const g = scene.add.graphics();
    const out: Phaser.GameObjects.GameObject[] = [g];
    if (this.kind === 'ship') {
      // Nave-espiã: mini disco com um marcianinho de binóculo
      g.fillStyle(0x9fe7ff, 0.95).fillEllipse(0, -9, 26, 20).lineStyle(2, OL).strokeEllipse(0, -9, 26, 20);
      g.fillStyle(0x7ddc6a).fillEllipse(0, -9, 10, 12).fillStyle(0x0d0d12).fillCircle(-2.5, -11, 2.2).fillCircle(2.5, -11, 2.2);
      g.fillStyle(0xaeb6c2).fillEllipse(0, 0, 64, 18).lineStyle(2, OL).strokeEllipse(0, 0, 64, 18);
      const lights = [-20, 0, 20].map((x, i) => scene.add.circle(x, 2, 3, [0xffd23f, 0xff4fa3, 0x5bd8ff][i]));
      scene.tweens.add({ targets: lights, alpha: 0.2, duration: 180, yoyo: true, repeat: -1 });
      out.push(...lights);
    } else if (this.kind === 'drone') {
      // Drone de vigilância: olho vermelho e duas hélices
      g.fillStyle(0x3a4452).lineStyle(2, OL).fillRoundedRect(-20, -12, 40, 24, 8).strokeRoundedRect(-20, -12, 40, 24, 8);
      g.fillStyle(0x111111).fillCircle(0, 0, 8).fillStyle(0xff3b3b).fillCircle(0, 0, 5).fillStyle(0xffd0d0).fillCircle(-2, -2, 1.5);
      g.lineStyle(2, OL).lineBetween(-20, -8, -28, -16).lineBetween(20, -8, 28, -16);
      for (const x of [-28, 28]) {
        const prop = scene.add.rectangle(x, -17, 26, 4, 0x9aa3ad).setStrokeStyle(1, OL);
        scene.tweens.add({ targets: prop, scaleX: { from: 1, to: -1 }, duration: 80, yoyo: true, repeat: -1 });
        out.push(prop);
      }
    } else if (this.kind === 'bone') {
      // Osso voador, dourado e com asinhas batendo
      for (const s of [-1, 1]) {
        const wing = scene.add.ellipse(s * 12, -12, 18, 10, 0xffffff).setStrokeStyle(1.5, OL).setOrigin(s < 0 ? 1 : 0, 1);
        scene.tweens.add({ targets: wing, scaleY: { from: 1, to: 0.3 }, duration: 120, yoyo: true, repeat: -1 });
        out.unshift(wing);
      }
      g.fillStyle(0xf2d27a).lineStyle(2, OL);
      for (const [x, y] of [[-20, -5], [-20, 5], [20, -5], [20, 5]]) g.fillCircle(x, y, 7).strokeCircle(x, y, 7);
      g.fillRect(-20, -5, 40, 10).lineBetween(-14, -5, 14, -5).lineBetween(-14, 5, 14, 5);
      g.fillStyle(0xffffff, 0.7).fillCircle(-22, -7, 2);
    } else {
      // Novelo pendurado no travessão por um fio
      const crossbar = GOAL.ground - GOAL.height - this.y;
      g.lineStyle(1.5, 0xf4f1e8).lineBetween(0, crossbar, 0, -16);
      g.fillStyle(0xff4fa3).lineStyle(2, OL).fillCircle(0, 0, 17).strokeCircle(0, 0, 17);
      g.lineStyle(1.5, 0xffffff, 0.75).beginPath().arc(-4, -2, 12, -1.2, 1.3).strokePath().beginPath().arc(5, 3, 10, 1.8, 4.2).strokePath();
      g.lineStyle(1.5, 0xff4fa3).lineBetween(14, 10, 26, 22);
    }
    return out;
  }

  /** Bola acertou: o alvo gira, cai e explode em quadrinhos. */
  hit(): void {
    const scene = this.scene;
    scene.tweens.killTweensOf([this, this.art, this.ring]);
    this.ring.destroy();
    this.tag.destroy();
    scene.cameras.main.shake(180, 0.008);
    const pow = scene.add.text(this.x, this.y - 40, BOOM[this.kind], {
      fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: '#ffd23f', stroke: '#17110d', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(56).setScale(0.4).setRotation(-0.15);
    scene.tweens.add({ targets: pow, scale: 1.2, duration: 220, ease: 'Back.out' });
    scene.tweens.add({ targets: pow, alpha: 0, y: pow.y - 30, delay: 900, duration: 400, onComplete: () => pow.destroy() });
    // Fumaça saindo enquanto cai
    const smoke = scene.time.addEvent({
      delay: 70, repeat: 10, callback: () => {
        const puff = scene.add.circle(this.x, this.y, 6 + Math.random() * 6, 0x6f6f6f, 0.7).setDepth(16);
        scene.tweens.add({ targets: puff, scale: 2.4, alpha: 0, y: puff.y - 20, duration: 600, onComplete: () => puff.destroy() });
      },
    });
    scene.tweens.add({
      targets: this, y: GOAL.ground - 8, rotation: (Math.random() < 0.5 ? -1 : 1) * 7, duration: 750, ease: 'Quad.in',
      onComplete: () => {
        smoke.remove();
        for (let i = 0; i < 10; i++) {
          const bit = scene.add.circle(this.x, this.y, 4 + Math.random() * 4, [0xffd23f, 0xff6a2b, 0xf4f1e8][i % 3]).setDepth(16);
          const a = Math.random() * Math.PI;
          scene.tweens.add({ targets: bit, x: bit.x + Math.cos(a) * 70, y: bit.y - Math.sin(a) * 60, alpha: 0, duration: 520, ease: 'Quad.out', onComplete: () => bit.destroy() });
        }
        this.destroy();
      },
    });
  }
}
