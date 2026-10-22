import Phaser from 'phaser';
import { FONT } from '../data/appearance';
import type { GoalPoint } from '../types';
import { hex } from './Figures';

/** Geometria do gol no mundo 1280x720. */
export const GOAL = { cx: 640, halfW: 210, ground: 372, height: 150 };
export const SPOT = { x: 640, y: 548 };
export const toScreen = (p: GoalPoint) => ({ x: GOAL.cx + p.x * GOAL.halfW, y: GOAL.ground - p.y * GOAL.height });

const BACK = { left: 452, right: 828, top: 214, bottom: 350 };
const GRASS_BANDS = [334, 352, 372, 396, 424, 456, 494, 540, 592, 652, 720, 796, 880, 980, 1100];
/** Arquibancada superior acima de y=0: só aparece com o celular em pé, que mostra mais altura. */
const STANDS_TOP = -460;

/** Mesma escala do zoom da câmera (1920/1280), para as texturas assadas ficarem nítidas. */
const BAKE = 1.5;

export class Stadium {
  crowd: Phaser.GameObjects.Image[] = [];
  private net: Phaser.GameObjects.Graphics;
  private netImage: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, homeColors: string[], awayColors: string[]) {
    // Graphics do Phaser é retesselado a cada quadro; o cenário estático vira textura uma vez por partida.
    this.bake('st-stands', STANDS_TOP, 334, (g) => this.drawStands(g));
    const palette = [...homeColors, ...homeColors, ...awayColors, '#d8d2c4', '#3b4452', '#7a6a58', '#b74e3a'].map(hex);
    for (let layer = 0; layer < 2; layer++) this.crowd.push(this.bake(`st-crowd${layer}`, STANDS_TOP, 334, (g) => this.drawCrowd(g, layer, palette)));
    this.bake('st-pitch', 300, 1100, (g) => this.drawPitch(g, homeColors[0]));
    this.addBoardTexts();
    this.netImage = this.bake('st-net', 0, 400, (g) => this.drawNetInto(g, null, 0));
    this.net = scene.add.graphics();
    this.drawFrame();
  }

  /** Desenha a faixa vertical [top, bottom) do mundo numa textura e a posiciona no lugar. */
  private bake(key: string, top: number, bottom: number, draw: (g: Phaser.GameObjects.Graphics) => void): Phaser.GameObjects.Image {
    const s = this.scene;
    if (s.textures.exists(key)) s.textures.remove(key);
    const g = s.make.graphics({}, false);
    g.translateCanvas(0, -top);
    draw(g);
    g.setScale(BAKE);
    s.textures.addDynamicTexture(key, 1280 * BAKE, (bottom - top) * BAKE)!.draw(g);
    g.destroy();
    return s.add.image(0, top, key).setOrigin(0).setScale(1 / BAKE);
  }

  private drawStands(g: Phaser.GameObjects.Graphics) {
    g.fillStyle(0x0b0f14).fillRect(0, STANDS_TOP, 1280, 334 - STANDS_TOP);
    // Degraus da arquibancada (os negativos formam o anel superior)
    for (let i = -16; i < 9; i++) {
      g.fillStyle(i % 2 ? 0x18202b : 0x141b24).fillRect(0, 34 + i * 29, 1280, 29);
    }
    g.fillStyle(0x05070a).fillRect(0, STANDS_TOP, 1280, 24);
    g.fillStyle(0x07090c).fillRect(0, 0, 1280, 34);
    // Holofotes
    for (const x of [120, 1160]) {
      g.fillStyle(0xfff6d8, 0.05).fillCircle(x, 18, 120);
      g.fillStyle(0x2a2f36).fillRect(x - 46, 6, 92, 26);
      for (let i = 0; i < 4; i++) g.fillStyle(0xfffbe8).fillRect(x - 42 + i * 22, 10, 18, 9);
    }
  }

  /** Torcida: duas camadas que pulam alternadas. */
  private drawCrowd(g: Phaser.GameObjects.Graphics, layer: number, palette: number[]) {
    for (let row = layer - 16; row < 9; row += 2) {
      if (row === -1) continue; // faixa dos holofotes entre os anéis
      const y = 52 + row * 29 - (row < 0 ? 14 : 0);
      for (let x = 6 + (row % 2) * 7; x < 1280; x += 14) {
        if (Math.random() < 0.12) continue;
        const col = palette[Math.floor(Math.random() * palette.length)];
        const jx = x + (Math.random() - 0.5) * 4;
        g.fillStyle(col, 0.9).fillRoundedRect(jx - 5, y, 10, 12, 3);
        g.fillStyle(0xc9a07a, 0.85).fillCircle(jx, y - 3, 3.6);
      }
    }
  }

  private addBoardTexts() {
    const ads = ['PENALTY CAREER', 'AURORA TÊXTIL', 'FARMÁCIA SOL', 'RÁDIO VALE FM', 'CAFÉ SERRANO'];
    for (let i = 0; i < 6; i++) {
      this.scene.add.text(i * 214 + 105, 317, ads[i % ads.length], { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#f4f1e8' })
        .setOrigin(0.5).setAlpha(0.85).setResolution(2);
    }
  }

  /** Placas de publicidade + gramado (placas entram aqui para ficarem na frente da torcida). */
  private drawPitch(g: Phaser.GameObjects.Graphics, home: string) {
    g.fillStyle(0x10161d).fillRect(0, 300, 1280, 34);
    for (let i = 0; i < 6; i++) g.fillStyle(i % 2 ? hex(home) : 0x1b2633).fillRect(i * 214, 303, 210, 28);
    for (let i = 0; i < GRASS_BANDS.length - 1; i++) {
      g.fillStyle(i % 2 ? 0x2f7d3b : 0x358a42).fillRect(0, GRASS_BANDS[i], 1280, GRASS_BANDS[i + 1] - GRASS_BANDS[i]);
    }
    g.fillStyle(0x000000, 0.12).fillRect(0, 334, 1280, 14);
    g.lineStyle(3, 0xf4f1e8, 0.85);
    g.lineBetween(0, GOAL.ground, 1280, GOAL.ground);
    g.strokePoints([{ x: 350, y: 372 }, { x: 330, y: 400 }, { x: 950, y: 400 }, { x: 930, y: 372 }] as Phaser.Types.Math.Vector2Like[]);
    g.strokePoints([{ x: 165, y: 372 }, { x: 60, y: 602 }, { x: 1220, y: 602 }, { x: 1115, y: 372 }] as Phaser.Types.Math.Vector2Like[]);
    g.beginPath();
    g.arc(640, 602, 150, Phaser.Math.DegToRad(18), Phaser.Math.DegToRad(162), false);
    g.strokePath();
    g.fillStyle(0xf4f1e8, 0.95).fillEllipse(SPOT.x, SPOT.y + 2, 16, 6);
    // Sombra do gol
    g.fillStyle(0x000000, 0.18).fillPoints([
      { x: GOAL.cx - GOAL.halfW, y: GOAL.ground }, { x: BACK.left, y: BACK.bottom },
      { x: BACK.right, y: BACK.bottom }, { x: GOAL.cx + GOAL.halfW, y: GOAL.ground },
    ] as Phaser.Types.Math.Vector2Like[], true);
  }

  /** Rede parada usa a textura; só durante o balanço do gol ela é desenhada ao vivo. */
  drawNet(bulge: { x: number; y: number } | null, amp: number) {
    this.net.clear();
    const live = !!bulge && amp > 0;
    this.netImage.setVisible(!live);
    if (live) this.drawNetInto(this.net, bulge, amp);
  }

  /** `bulge` empurra os nós para longe do ponto de impacto. */
  private drawNetInto(g: Phaser.GameObjects.Graphics, bulge: { x: number; y: number } | null, amp: number) {
    const push = (x: number, y: number) => {
      if (!bulge || amp <= 0) return [x, y];
      const dx = x - bulge.x;
      const dy = y - bulge.y;
      const f = amp * Math.exp(-(dx * dx + dy * dy) / 2600);
      const d = Math.hypot(dx, dy) || 1;
      return [x + (dx / d) * f, y + (dy / d) * f * 0.7 - f * 0.25];
    };
    g.fillStyle(0xffffff, 0.05).fillRect(BACK.left, BACK.top, BACK.right - BACK.left, BACK.bottom - BACK.top);
    g.lineStyle(1, 0xffffff, 0.38);
    for (let x = BACK.left; x <= BACK.right + 0.1; x += 15.04) {
      g.beginPath();
      for (let y = BACK.top; y <= BACK.bottom + 0.1; y += 8.5) {
        const [px, py] = push(x, y);
        if (y === BACK.top) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.strokePath();
    }
    for (let y = BACK.top; y <= BACK.bottom + 0.1; y += 13.6) {
      g.beginPath();
      for (let x = BACK.left; x <= BACK.right + 0.1; x += 9.4) {
        const [px, py] = push(x, y);
        if (x === BACK.left) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.strokePath();
    }
    // Laterais e teto
    const L = GOAL.cx - GOAL.halfW;
    const R = GOAL.cx + GOAL.halfW;
    const T = GOAL.ground - GOAL.height;
    g.lineStyle(1, 0xffffff, 0.28);
    for (let t = 0; t <= 1.001; t += 0.1) {
      g.lineBetween(L, T + (GOAL.ground - T) * t, BACK.left, BACK.top + (BACK.bottom - BACK.top) * t);
      g.lineBetween(R, T + (GOAL.ground - T) * t, BACK.right, BACK.top + (BACK.bottom - BACK.top) * t);
    }
    for (let t = 0; t <= 1.001; t += 0.05) {
      g.lineBetween(L + (R - L) * t, T, BACK.left + (BACK.right - BACK.left) * t, BACK.top);
    }
    g.lineStyle(1.5, 0xffffff, 0.5);
    g.lineBetween(L, GOAL.ground, BACK.left, BACK.bottom).lineBetween(R, GOAL.ground, BACK.right, BACK.bottom);
    g.strokeRect(BACK.left, BACK.top, BACK.right - BACK.left, BACK.bottom - BACK.top);
  }

  private drawFrame() {
    const g = this.scene.add.graphics().setDepth(3); // na frente da bola que entrou na rede (profundidade 2)
    const L = GOAL.cx - GOAL.halfW;
    const R = GOAL.cx + GOAL.halfW;
    const T = GOAL.ground - GOAL.height;
    g.fillStyle(0x000000, 0.25).fillRect(L - 4, GOAL.ground - 2, 9, 5).fillRect(R - 4, GOAL.ground - 2, 9, 5);
    g.fillStyle(0xf7f5ee);
    g.fillRoundedRect(L - 5, T - 5, 10, GOAL.height + 6, 3);
    g.fillRoundedRect(R - 5, T - 5, 10, GOAL.height + 6, 3);
    g.fillRoundedRect(L - 5, T - 5, R - L + 10, 10, 3);
    g.fillStyle(0xc9c6bc).fillRect(L + 2, T, 3, GOAL.height).fillRect(R + 2, T, 3, GOAL.height);
  }

  /** Torcida pulando; intensidade 0 = parada. */
  cheer(times: number) {
    this.crowd.forEach((c, i) =>
      this.scene.tweens.add({ targets: c, y: -5, duration: 150, delay: i * 75, yoyo: true, repeat: times * 2 - 1, ease: 'Quad.out' }),
    );
  }

  /** Ponto aproximado na rede de fundo, para onde a bola segue após cruzar a linha. */
  static backOf(p: { x: number; y: number }) {
    const tx = (p.x - (GOAL.cx - GOAL.halfW)) / (GOAL.halfW * 2);
    const ty = (p.y - (GOAL.ground - GOAL.height)) / GOAL.height;
    return { x: BACK.left + (BACK.right - BACK.left) * tx, y: BACK.top + (BACK.bottom - BACK.top) * ty };
  }
}
