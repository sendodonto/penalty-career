import Phaser from 'phaser';
import { HAIR_COLORS, HAIR_STYLES, SKIN_TONES } from '../data/appearance';
import { figureSkin, type Kit } from '../entities/figureArt';
import { Kicker } from '../entities/Figures';
import type { Stadium } from '../entities/Stadium';
import type { Weather } from '../types';

/** Imprevistos que podem interromper a disputa entre uma cobrança e outra. */
export type Incident = 'invader' | 'dog' | 'blackout' | 'ufo';

/** Rótulos para a tela de resultado (clima e imprevistos). */
export const EVENT_LABEL: Record<string, string> = {
  rain: 'Chuva forte', snow: 'Neve', fog: 'Neblina',
  invader: 'Invasão de campo', dog: 'Cachorro no gramado', blackout: 'Apagão', ufo: 'Disco voador',
};

/** Sorteia o imprevisto, com pesos: invasões são comuns; óvnis, raros. */
export function pickIncident(r: number): Incident {
  return r < 0.4 ? 'invader' : r < 0.65 ? 'dog' : r < 0.88 ? 'blackout' : 'ufo';
}

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
  // Disco voador: desce, puxa a bola com o raio, devolve e vai embora.
  ctx.toast('ALIENÍGENAS?!', 'Um disco voador apareceu sobre o estádio...');
  ctx.sfx.ufo();
  const ufo = scene.add.container(-160, -260).setDepth(46);
  const body = scene.add.graphics();
  body.fillStyle(0x9fe7ff, 0.9).fillEllipse(0, -14, 44, 30).lineStyle(2, 0x17110d).strokeEllipse(0, -14, 44, 30);
  body.fillStyle(0xaeb6c2).fillEllipse(0, 0, 120, 30).strokeEllipse(0, 0, 120, 30);
  body.fillStyle(0x6c7686).fillEllipse(0, 6, 90, 12);
  const lights = [-40, -20, 0, 20, 40].map((x, i) => scene.add.circle(x, 2, 4, [0xffd23f, 0x5bd8ff, 0xff4fa3][i % 3]));
  ufo.add([body, ...lights]);
  scene.tweens.add({ targets: lights, alpha: 0.2, duration: 220, yoyo: true, repeat: -1 });
  const ballX = ctx.ballRest.x;
  await tween(scene, { targets: ufo, x: ballX, y: 300, duration: 1400, ease: 'Sine.out' });
  const cone = scene.add.polygon(0, 0, [ballX - 22, 314, ballX + 22, 314, ballX + 46, ctx.ballRest.y + 14, ballX - 46, ctx.ballRest.y + 14], 0x9dff8a, 0.26)
    .setOrigin(0).setDepth(45).setAlpha(0);
  await tween(scene, { targets: cone, alpha: 1, duration: 300 });
  await tween(scene, { targets: ctx.ball, y: ctx.ballRest.y - 90, rotation: 6, duration: 900, ease: 'Sine.inOut' });
  await sleep(scene, 500);
  await tween(scene, { targets: ctx.ball, y: ctx.ballRest.y, rotation: 0, duration: 700, ease: 'Bounce.out' });
  cone.destroy();
  await tween(scene, { targets: ufo, x: 1500, y: -300, duration: 900, ease: 'Sine.in' });
  ufo.destroy();
  ctx.stadium.cheer(3);
}
