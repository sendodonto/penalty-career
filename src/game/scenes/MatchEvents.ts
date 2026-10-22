import Phaser from 'phaser';
import { HAIR_COLORS, HAIR_STYLES, SKIN_TONES } from '../data/appearance';
import { figureSkin, type Kit } from '../entities/figureArt';
import { Kicker } from '../entities/Figures';
import type { Stadium } from '../entities/Stadium';
import type { Special } from '../data/specials';
import type { Incident } from '../data/incidents';
import type { Weather } from '../types';

/** Imprevistos que podem interromper a disputa entre uma cobrança e outra. */
export { EVENT_LABEL, INCIDENT_CHANCE, pickIncident, type Incident } from '../data/incidents';

const VIEW = { left: -260, top: -520, width: 1800, height: 1700 };

function texture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h).destroy();
}

/** Clima da partida: partículas e tom de luz por cima do estádio (abaixo da interface). */
export function weatherFx(scene: Phaser.Scene, weather: Weather): void {
  if (weather === 'clear') return;
  const overlay = (color: number, alpha: number) => scene.add.rectangle(VIEW.left, VIEW.top, VIEW.width, VIEW.height, color, alpha).setOrigin(0).setDepth(43);
  if (weather === 'rain') {
    overlay(0x0a1424, 0.22);
    texture(scene, 'fx-rain', 2, 18, (g) => g.fillStyle(0xdde8ff).fillRect(0, 0, 2, 18));
    scene.add.particles(0, 0, 'fx-rain', {
      x: { min: VIEW.left, max: VIEW.left + VIEW.width }, y: VIEW.top, lifespan: 1500, speedY: { min: 950, max: 1250 }, speedX: -140,
      rotate: 8, alpha: { start: 0.5, end: 0.2 }, scaleY: { min: 0.6, max: 1.3 }, quantity: 5, frequency: 16,
    }).setDepth(44);
    // Relâmpago ocasional
    scene.time.addEvent({ delay: 7000, loop: true, callback: () => Math.random() < 0.5 && scene.cameras.main.flash(140, 210, 220, 255, false) });
  } else if (weather === 'snow') {
    overlay(0xdfe8f5, 0.08);
    texture(scene, 'fx-snow', 8, 8, (g) => g.fillStyle(0xffffff).fillCircle(4, 4, 3.2));
    scene.add.particles(0, 0, 'fx-snow', {
      x: { min: VIEW.left, max: VIEW.left + VIEW.width }, y: VIEW.top, lifespan: 11000, speedY: { min: 90, max: 170 }, speedX: { min: -40, max: 40 },
      scale: { min: 0.4, max: 1 }, alpha: { min: 0.5, max: 0.95 }, quantity: 2, frequency: 45,
    }).setDepth(44);
  } else {
    overlay(0xd8dde3, 0.14);
    for (let i = 0; i < 4; i++) {
      const cloud = scene.add.ellipse(200 + i * 320, 180 + (i % 2) * 220, 900, 260, 0xffffff, 0.13).setDepth(44);
      scene.tweens.add({ targets: cloud, x: cloud.x + 160, duration: 9000 + i * 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }
}

const sleep = (scene: Phaser.Scene, ms: number) => new Promise<void>((r) => scene.time.delayedCall(ms, r));
const tween = (scene: Phaser.Scene, cfg: Phaser.Types.Tweens.TweenBuilderConfig) =>
  new Promise<void>((r) => scene.tweens.add({ ...cfg, onComplete: () => r() }));

const r = (n: number) => Math.floor(Math.random() * n);
const randomLook = () => ({ skin: r(SKIN_TONES.length), hair: r(HAIR_STYLES.length), hairColor: r(HAIR_COLORS.length) });
const STEWARD: Kit = { shirt: '#f2d000', trim: '#1b1b1f', shorts: '#1b1b1f', socks: '#1b1b1f' };

/** Corredor de frente atravessando o campo, com passadas e braços em movimento. */
async function runner(scene: Phaser.Scene, kit: Kit, fromX: number, toX: number, y: number, duration: number, delay: number) {
  const fig = new Kicker(scene, fromX, y, await figureSkin(scene, 'front', randomLook(), kit, { keeper: false })).setScale(0.95).setDepth(25);
  scene.tweens.add({ targets: fig.legL, rotation: { from: -0.55, to: 0.55 }, duration: 140, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: fig.legR, rotation: { from: 0.55, to: -0.55 }, duration: 140, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: [fig.armL, fig.armR], rotation: { from: -0.6, to: 0.6 }, duration: 140, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: fig, y: y - 6, duration: 140, yoyo: true, repeat: -1 });
  await tween(scene, { targets: fig, x: toX, duration, delay, ease: 'Linear' });
  fig.destroy();
}

export interface IncidentCtx {
  stadium: Stadium;
  ball: Phaser.GameObjects.Container;
  ballRest: { x: number; y: number };
  toast(title: string, sub: string): void;
  sfx: { goal(): void; groan(): void; ufo(): void; click(): void };
  /** Raid: o jogador em pé na marca, para ser abduzido */
  spawnPlayer(): Promise<Phaser.GameObjects.Container>;
  special?: Special;
}

/** Executa o imprevisto inteiro e resolve quando o jogo pode continuar. */
export async function playIncident(scene: Phaser.Scene, kind: Incident, ctx: IncidentCtx): Promise<void> {
  if (kind === 'invader') {
    ctx.toast('INVASÃO DE CAMPO!', 'Um torcedor entrou correndo... e os seguranças vão atrás.');
    ctx.sfx.goal();
    ctx.stadium.cheer(4);
    await Promise.all([
      runner(scene, { shirt: '#f4f1e8', trim: '#d62828', shorts: '#1d3b8a', socks: '#f4f1e8' }, -80, 1360, 470, 3200, 0),
      runner(scene, STEWARD, -80, 1360, 488, 3000, 650),
      runner(scene, STEWARD, -80, 1360, 455, 3000, 900),
    ]);
    return;
  }
  if (kind === 'dog') {
    ctx.toast('CACHORRO NO GRAMADO!', 'O jogo para até alguém pegar o visitante.');
    texture(scene, 'fx-dog', 64, 44, (g) => {
      g.lineStyle(2, 0x17110d);
      g.fillStyle(0xa8693f).fillEllipse(30, 22, 40, 18).strokeEllipse(30, 22, 40, 18);
      g.fillRect(14, 26, 5, 14).fillRect(40, 26, 5, 14).strokeRect(14, 26, 5, 14).strokeRect(40, 26, 5, 14);
      g.fillCircle(52, 14, 9).strokeCircle(52, 14, 9);
      g.fillStyle(0x6b4026).fillEllipse(48, 7, 6, 10).fillEllipse(56, 7, 6, 10);
      g.fillStyle(0x17110d).fillCircle(55, 13, 1.6).fillCircle(60, 16, 2);
      g.lineStyle(3, 0xa8693f).lineBetween(10, 18, 2, 8);
    });
    const dog = scene.add.image(1360, 500, 'fx-dog').setDepth(25).setFlipX(true).setScale(1.2);
    scene.tweens.add({ targets: dog, y: 492, duration: 110, yoyo: true, repeat: -1 });
    ctx.sfx.click();
    await Promise.all([
      tween(scene, { targets: dog, x: 640, duration: 1400, ease: 'Sine.out' }).then(() => sleep(scene, 500))
        .then(() => tween(scene, { targets: dog, x: -100, duration: 1300, ease: 'Sine.in' })),
      runner(scene, STEWARD, 1400, -120, 520, 3200, 400),
    ]);
    dog.destroy();
    return;
  }
  if (kind === 'blackout') {
    ctx.toast('APAGÃO!', 'Os refletores falharam por alguns segundos.');
    ctx.sfx.groan();
    const dark = scene.add.rectangle(VIEW.left, VIEW.top, VIEW.width, VIEW.height, 0x000000, 0).setOrigin(0).setDepth(48);
    await tween(scene, { targets: dark, fillAlpha: 0.85, duration: 120 });
    await sleep(scene, 1100);
    for (const a of [0.25, 0.85, 0.15, 0.8]) {
      dark.setFillStyle(0x000000, a);
      ctx.sfx.click();
      await sleep(scene, 120);
    }
    await tween(scene, { targets: dark, fillAlpha: 0, duration: 450 });
    dark.destroy();
    ctx.stadium.cheer(2);
    return;
  }
  await playRaid(scene, ctx);
}

/** Naves dos raids, cada uma com sua piada visual. */
function ship(scene: Phaser.Scene, sp: Special): Phaser.GameObjects.Container {
  const c = scene.add.container(-200, -320).setDepth(46);
  const g = scene.add.graphics();
  const OL = 0x17110d;
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
    parts.push(scene.add.text(0, 34, 'PROTOCOLO RAID', { fontFamily: 'Bahnschrift, Arial', fontSize: '12px', fontStyle: 'bold', color: '#5bd8ff' }).setOrigin(0.5).setResolution(2));
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

/** Raid: a nave chega, o raio pega o jogador (que se debate e gira) e some no céu com ele. */
async function playRaid(scene: Phaser.Scene, ctx: IncidentCtx): Promise<void> {
  const sp = ctx.special!;
  ctx.toast(sp.title, sp.intro);
  ctx.sfx.ufo();
  const player = await ctx.spawnPlayer();
  const craft = ship(scene, sp);
  await tween(scene, { targets: craft, x: player.x + 30, y: 250, duration: 1300, ease: 'Back.out' });
  // Só balança depois de chegar: dois tweens no mesmo y brigariam e prenderiam a nave fora da tela.
  const bob = scene.tweens.add({ targets: craft, y: 258, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  const top = 268;
  const cone = scene.add.polygon(0, 0, [player.x + 8, top, player.x + 52, top, player.x + 110, player.y + 6, player.x - 50, player.y + 6], sp.beam, 0.3)
    .setOrigin(0).setDepth(29).setAlpha(0);
  await tween(scene, { targets: cone, alpha: 1, duration: 280 });
  // Debate-se no ar: braços e pernas agitando
  const flail = (p: Phaser.GameObjects.Container) => {
    const fig = p as unknown as { armL: Phaser.GameObjects.Container; armR: Phaser.GameObjects.Container; legL: Phaser.GameObjects.Container; legR: Phaser.GameObjects.Container };
    scene.tweens.add({ targets: fig.armL, rotation: { from: 1.8, to: 3 }, duration: 110, yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: fig.armR, rotation: { from: -1.8, to: -3 }, duration: 130, yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: [fig.legL, fig.legR], rotation: { from: -0.5, to: 0.5 }, duration: 120, yoyo: true, repeat: -1 });
  };
  flail(player);
  ctx.stadium.cheer(5);
  const yell = scene.add.text(player.x + 70, player.y - 190, 'AAAAAH!', {
    fontFamily: 'Bahnschrift, Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffffff', stroke: '#17110d', strokeThickness: 6,
  }).setOrigin(0.5).setDepth(55).setRotation(-0.12);
  scene.tweens.add({ targets: yell, scale: { from: 0.9, to: 1.15 }, duration: 160, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: yell, y: top - 10, x: player.x + 90, alpha: 0, duration: 1900, ease: 'Sine.in' });
  await tween(scene, { targets: player, y: top + 20, x: player.x + 30, scale: 0.25, rotation: Math.PI * 4, duration: 1800, ease: 'Sine.in' });
  player.setVisible(false);
  yell.destroy();
  bob.stop();
  cone.destroy();
  await tween(scene, { targets: craft, x: craft.x - 60, duration: 160, yoyo: true });
  await tween(scene, { targets: craft, x: 1500, y: -420, scale: 0.4, duration: 700, ease: 'Back.in' });
  scene.cameras.main.flash(220, 255, 255, 255, false);
  craft.destroy();
  player.destroy();
  await sleep(scene, 400);
}
