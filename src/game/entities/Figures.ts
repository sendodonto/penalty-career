import Phaser from 'phaser';
import { ART_SCALE, type FigureSkin, type Part } from './figureArt';

export const hex = (s: string) => parseInt(s.replace('#', ''), 16);

type C = Phaser.GameObjects.Container;

/** Esqueleto articulado (quadris, tronco, ombros, cabeça) vestido com a arte vetorial de figureArt. */
abstract class Figure extends Phaser.GameObjects.Container {
  legL: C;
  legR: C;
  torso: C;
  armL: C;
  armR: C;
  head: C;

  constructor(scene: Phaser.Scene, x: number, y: number, skin: FigureSkin) {
    super(scene, x, y);
    const img = (p: Part, flip = false) => scene.add.image(0, 0, p.key).setOrigin(p.ox, p.oy).setScale(1 / ART_SCALE).setFlipX(flip);
    this.legL = scene.add.container(-7, -52, [img(skin.leg)]);
    this.legR = scene.add.container(7, -52, [img(skin.leg, true)]);
    const shorts = img(skin.shorts).setPosition(0, -62);
    this.torso = scene.add.container(0, -56);
    // De costas o braço esquerdo do jogador fica à esquerda da tela; de frente, à direita.
    this.armL = scene.add.container(-18.5, -38.5, [img(skin.armL)]);
    this.armR = scene.add.container(18.5, -38.5, [img(skin.arm, true)]);
    // Cabeça um pouco menor que o desenho: proporção de atleta, não de boneco.
    this.head = scene.add.container(0, -59, [img(skin.head).setScale(skin.headScale / ART_SCALE)]);
    this.torso.add([img(skin.torso), this.head, this.armL, this.armR]);
    this.add([this.legL, this.legR, shorts, this.torso]);
    scene.add.existing(this);
  }
}

export class Kicker extends Figure {
  idle(): void {
    this.scene.tweens.add({ targets: this.torso, y: -55, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  /** Corrida até a bola; `onStrike` dispara no contato pé-bola. */
  runUp(to: { x: number; y: number; scale: number }, onStrike: () => void): void {
    const tw = this.scene.tweens;
    tw.killTweensOf([this, this.torso, this.legL, this.legR, this.armL, this.armR]);
    const stride = tw.add({ targets: this.legL, rotation: { from: -0.35, to: 0.35 }, duration: 130, yoyo: true, repeat: -1 });
    const stride2 = tw.add({ targets: this.legR, rotation: { from: 0.35, to: -0.35 }, duration: 130, yoyo: true, repeat: -1 });
    const swing = tw.add({ targets: [this.armL, this.armR], rotation: { from: -0.3, to: 0.3 }, duration: 130, yoyo: true, repeat: -1 });
    tw.add({ targets: this.torso, rotation: -0.08, duration: 200 });
    tw.add({
      targets: this, x: to.x, y: to.y, scale: to.scale, duration: 620, ease: 'Sine.in',
      onComplete: () => {
        stride.stop(); stride2.stop(); swing.stop();
        this.legL.rotation = 0.05;
        tw.add({ targets: this.armL, rotation: 0.9, duration: 160 });
        tw.add({ targets: this.armR, rotation: -0.5, duration: 160 });
        tw.chain({
          targets: this.legR,
          tweens: [
            { rotation: 0.6, scaleY: 0.65, duration: 150, ease: 'Quad.out' },
            { rotation: -0.42, scaleY: 0.8, duration: 80, ease: 'Quad.in', onComplete: onStrike },
            { rotation: -0.7, scaleY: 0.55, duration: 160, ease: 'Quad.out' },
            { rotation: 0, scaleY: 1, duration: 260, delay: 200 },
          ],
        });
      },
    });
  }

  /** Comemoração de gol; os estilos além dos braços erguidos vêm da loja. */
  celebrate(style?: string): void {
    const tw = this.scene.tweens;
    if (style === 'cel-plane') {
      tw.add({ targets: this.armL, rotation: 1.5, duration: 200 });
      tw.add({ targets: this.armR, rotation: -1.5, duration: 200 });
      tw.add({ targets: this.torso, rotation: 0.22, duration: 200 });
      tw.add({ targets: this, x: this.x + 110, y: this.y - 14, duration: 900, ease: 'Sine.out' });
      tw.add({ targets: this.legL, rotation: { from: -0.4, to: 0.4 }, duration: 140, yoyo: true, repeat: 3 });
      tw.add({ targets: this.legR, rotation: { from: 0.4, to: -0.4 }, duration: 140, yoyo: true, repeat: 3 });
    } else if (style === 'cel-jump') {
      tw.add({ targets: this.armL, rotation: 0.5, duration: 150 });
      tw.add({ targets: this.armR, rotation: { from: -2.2, to: -3 }, duration: 140, yoyo: true, repeat: 4 });
      tw.add({ targets: this, y: this.y - 30, duration: 260, yoyo: true, ease: 'Quad.out' });
    } else if (style === 'cel-dance') {
      tw.add({ targets: this.torso, rotation: { from: -0.2, to: 0.2 }, duration: 180, yoyo: true, repeat: 5 });
      tw.add({ targets: this.armL, rotation: { from: 0.4, to: 2.6 }, duration: 180, yoyo: true, repeat: 5 });
      tw.add({ targets: this.armR, rotation: { from: -2.6, to: -0.4 }, duration: 180, yoyo: true, repeat: 5 });
      tw.add({ targets: this, y: this.y - 6, duration: 180, yoyo: true, repeat: 5 });
    } else if (style === 'cel-knee') {
      tw.add({ targets: [this.legL, this.legR], scaleY: 0.55, duration: 160 });
      tw.add({ targets: this.armL, rotation: 2.6, duration: 200, ease: 'Back.out' });
      tw.add({ targets: this.armR, rotation: -2.6, duration: 200, ease: 'Back.out' });
      tw.add({ targets: this, y: this.y - 40, scale: this.scale * 0.94, duration: 700, ease: 'Quad.out' });
    } else {
      tw.add({ targets: this.armL, rotation: 2.7, duration: 220, ease: 'Back.out' });
      tw.add({ targets: this.armR, rotation: -2.7, duration: 220, ease: 'Back.out' });
      tw.add({ targets: this, y: this.y - 16, duration: 200, yoyo: true, repeat: 2, ease: 'Quad.out' });
    }
  }

  dejected(): void {
    const tw = this.scene.tweens;
    tw.add({ targets: this.head, y: -55, duration: 400 });
    tw.add({ targets: this.torso, rotation: 0.12, y: -53, duration: 400 });
    tw.add({ targets: this.armL, rotation: -0.25, duration: 400 });
    tw.add({ targets: this.armR, rotation: 0.25, duration: 400 });
  }
}

export class Keeper extends Figure {
  private sway?: Phaser.Tweens.Tween;

  ready(): void {
    this.legL.rotation = 0.2;
    this.legR.rotation = -0.2;
    this.armL.rotation = 0.55;
    this.armR.rotation = -0.55;
    this.torso.y = -52;
    const x = this.x;
    this.sway = this.scene.tweens.add({ targets: this, x: { from: x - 6, to: x + 6 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  /** Mergulho com as luvas chegando em (tx, ty) após `duration` ms; o corpo gira em torno dos pés. */
  dive(tx: number, ty: number, groundY: number, side: number, duration: number): void {
    this.sway?.stop();
    const tw = this.scene.tweens;
    tw.killTweensOf([this, this.legL, this.legR, this.armL, this.armR]); // permite corrigir o mergulho no ar
    const reach = 136 * this.scale;
    const h = groundY - ty;
    let rot = 0;
    let fx = tx;
    let fy = groundY;
    if (side === 0) {
      fy = Math.min(groundY, ty + reach);
    } else if (h >= reach * 0.7) {
      rot = side * 0.75;
      fx = tx - reach * Math.sin(rot);
      fy = Math.min(groundY, ty + reach * Math.cos(rot));
    } else {
      rot = side * Math.acos(Phaser.Math.Clamp(h / reach, 0.12, 1));
      fx = tx - reach * Math.sin(rot);
      fy = groundY;
    }
    const arms = side === 0 ? (h > reach * 0.7 ? 3.0 : 1.4) : 2.95;
    tw.add({ targets: this.armL, rotation: arms, duration: duration * 0.6, ease: 'Quad.out' });
    tw.add({ targets: this.armR, rotation: -arms, duration: duration * 0.6, ease: 'Quad.out' });
    tw.add({ targets: [this.legL, this.legR], rotation: side * 0.25, duration: duration * 0.6 });
    tw.add({ targets: this, x: fx, rotation: rot, duration, ease: 'Quad.out' });
    if (fy < groundY) {
      tw.chain({ targets: this, tweens: [
        { y: fy, duration, ease: 'Quad.out' },
        { y: groundY, duration: 320, ease: 'Quad.in', delay: 80 },
      ] });
    }
    if (side !== 0) tw.add({ targets: this, rotation: side * 1.45, delay: duration + 60, duration: 300, ease: 'Quad.in' });
  }

  celebrate(): void {
    this.scene.tweens.add({ targets: this.armR, rotation: -2.8, duration: 200, delay: 500, yoyo: true, repeat: 1 });
  }
}

export class Ball extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const g = scene.add.graphics();
    g.fillStyle(0xf7f5ee).fillCircle(0, 0, 9).lineStyle(1, 0x2b2b2b, 0.8).strokeCircle(0, 0, 9);
    g.fillStyle(0x1f1f1f);
    const pent = (cx: number, cy: number, r: number) =>
      g.fillPoints(Array.from({ length: 5 }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }), true);
    pent(0, 0, 3.4);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      pent(Math.cos(a) * 7.6, Math.sin(a) * 7.6, 2);
    }
    this.add(g);
    scene.add.existing(this);
  }
}
