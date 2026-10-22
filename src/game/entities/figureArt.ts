import Phaser from 'phaser';
import { BOOT_COLORS, HAIR_COLORS, SKIN_TONES } from '../data/appearance';
import { gearKey, type GearVisual } from '../data/shop';
import type { Species } from '../data/specials';
import type { Appearance, Team } from '../types';

/** Cores do uniforme em CSS (#rrggbb). */
export interface Kit { shirt: string; trim: string; shorts: string; socks: string }
/** Textura de uma peça e o ponto de articulação (origem) dentro dela. */
export interface Part { key: string; ox: number; oy: number }
/** `armL` difere de `arm` só quando há braçadeira (vai no braço esquerdo). */
/** `headScale`: espécies dos raids são cabeçudas de propósito (caricatura). */
export interface FigureSkin { leg: Part; shorts: Part; torso: Part; arm: Part; armL: Part; head: Part; headScale: number }
/** back = visto de costas (cobrador na partida); front = de frente (goleiro, retratos). */
export type View = 'back' | 'front';

/** Uniforme de linha de um clube. */
export const clubKit = (club: Team): Kit => ({ shirt: club.primary, trim: club.secondary, shorts: club.secondary, socks: club.primary });

/** Peças rasterizadas a 3x as unidades do corpo: ficam nítidas com o zoom da câmera. */
export const ART_SCALE = 3;
const OL = '#17110d';
const FONT = 'Bahnschrift, Arial Narrow, Arial, sans-serif';

const mix = (hex: string, to: number, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `#${[16, 8, 0].map((s) => Math.round(((n >> s) & 255) * (1 - amt) + to * amt).toString(16).padStart(2, '0')).join('')}`;
};
const dark = (hex: string, amt: number) => mix(hex, 0, amt);
const light = (hex: string, amt: number) => mix(hex, 255, amt);
const luma = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
};
/** Detalhe que precisa aparecer sobre um fundo escuro (chuteira, luva). */
const accentOn = (color: string, onDark: boolean) => (onDark && luma(color) < 0.3 ? '#e9e6dc' : color);
const xml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type VB = [number, number, number, number];
/** Desenho de uma peça: SVG interno + viewBox cuja origem (0,0) é o ponto de articulação. */
interface PartArt { key: string; vb: VB; body: string }

// ---------- Perna (quadril em 0,0) ----------
const LEG = 'M-7.2 0C-8 7-7.4 15-5.3 23.5C-6.8 27.5-6.9 33-4.4 44L4.4 44C6.9 33 6.8 27.5 5.3 23.5C7.4 15 8 7 7.2 0Z';
const SOCK = 'M-6.6 29C-6.5 35-5 40-4.4 44.6L4.4 44.6C5 40 6.5 35 6.6 29Z';

function legSvg(view: View, skin: string, kit: Kit, boot: string, bootAccent: string | undefined, socksLow: boolean): string {
  const front = view === 'front';
  const accent = bootAccent ?? accentOn(kit.trim === boot ? '#e9e6dc' : kit.trim, luma(boot) < 0.3);
  const sockTop = socksLow ? 37 : 29;
  const bootArt = front
    ? `<path d="M-5 43.4L5 43.4L6.2 49.6Q6.4 52.6 3.2 52.8L-3.2 52.8Q-6.4 52.6-6.2 49.6Z" fill="${boot}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
       <path d="M-2 45.6L2 45.6M-2.2 47.4L2.2 47.4" stroke="${luma(boot) < 0.5 ? '#e9e6dc' : '#3a3a3a'}" stroke-width=".7" stroke-linecap="round"/>
       <path d="M-5.5 50.3Q0 51.7 5.5 50.3" fill="none" stroke="${accent}" stroke-width="1.1"/>`
    : `<path d="M-4.9 43.4L4.9 43.4L5.4 49.8Q5.4 52.4 2.7 52.4L-2.7 52.4Q-5.4 52.4-5.4 49.8Z" fill="${boot}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
       <path d="M-3.3 46.4L3.3 46.4" stroke="${accent}" stroke-width="1.3" stroke-linecap="round"/>
       <path d="M-3 52.5v1.3M0 52.5v1.3M3 52.5v1.3" stroke="#bdbab2" stroke-width="1" stroke-linecap="round"/>`;
  return `<defs><clipPath id="c"><path d="${LEG}"/></clipPath></defs>
    <path d="${LEG}" fill="${skin}"/>
    <g clip-path="url(#c)">
      ${socksLow ? `<path d="M-6.4 27C-6.3 31-5.8 34-5.4 37L5.4 37C5.8 34 6.3 31 6.4 27Z" fill="#f2efe6" opacity=".9"/>` : ''}
      <path d="${SOCK.replace('M-6.6 29', `M-6.6 ${sockTop}`).replace('6.6 29Z', `6.6 ${sockTop}Z`)}" fill="${kit.socks}"/>
      <rect x="-9" y="${sockTop + 1.4}" width="18" height="${socksLow ? 3.4 : 2.4}" fill="${socksLow ? dark(kit.socks, 0.25) : kit.trim}"/>
      <ellipse cx="${front ? 0 : -0.8}" cy="${front ? 37 : 30}" rx="${front ? 2.6 : 3}" ry="${front ? 5.5 : 4.5}" fill="#fff" opacity=".13"/>
      <path d="M1.2-3C3 8 2.6 20 1.6 30C1.4 36 1.4 40 1.4 45L9 45L9-3Z" fill="#000" opacity=".17"/>
    </g>
    <path d="${LEG}" fill="none" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M-2.6 ${front ? 23 : 24}Q0 ${front ? 21.6 : 25.4} 2.6 ${front ? 23 : 24}" fill="none" stroke="${dark(skin, 0.25)}" stroke-width=".8" stroke-linecap="round"/>
    ${bootArt}`;
}

// ---------- Calção (cintura em 0,0) ----------
const SHORTS = 'M-15 0L15 0L16.8 17.4Q9 20.6 1.3 17.2L0 11L-1.3 17.2Q-9 20.6-16.8 17.4Z';

/** Rabo saindo do calção (raids de cachorros e gatos), visível de costas. */
function tailSvg(species: Species | undefined, fur: string, view: View): string {
  if (view !== 'back' || (species !== 'dog' && species !== 'cat')) return '';
  const d = species === 'cat' ? 'M2 12C10 10 16 2 14-10C13-15 9-15 9-11C11-2 7 6 1 8Z' : 'M1 10C8 9 13 4 12-3C14 2 10 13 1 13Z';
  const tip = species === 'cat' ? `<circle cx="11.5" cy="-11.5" r="2.6" fill="${light(fur, 0.35)}"/>` : '';
  // Desloca para baixo e para fora do calção: senão a camisa cobre o rabo.
  return `<g transform="translate(13 7)"><path d="${d}" fill="${fur}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>${tip}</g>`;
}

function shortsSvg(kit: Kit, tail = ''): string {
  return `${tail}<defs><clipPath id="c"><path d="${SHORTS}"/></clipPath></defs>
    <path d="${SHORTS}" fill="${kit.shorts}"/>
    <g clip-path="url(#c)">
      <rect x="-19" y="-2" width="38" height="4.4" fill="${dark(kit.shorts, 0.2)}"/>
      <path d="M-15.8-2L-12.8-2L-14.2 22L-17.6 22Z M15.8-2L12.8-2L14.2 22L17.6 22Z" fill="${kit.trim}"/>
      <path d="M4-2L19-2L19 22L6 22Z" fill="#000" opacity=".15"/>
      <path d="M-6 4Q-5 10-7.4 15.6M7 5Q6.4 10 8.2 15" fill="none" stroke="#000" stroke-opacity=".12" stroke-width=".9"/>
    </g>
    <path d="${SHORTS}" fill="none" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>`;
}

// ---------- Tronco e pescoço (centro do tronco em 0,0) ----------
const SHIRT = 'M-10-44.5Q0-42 10-44.5L16.5-41.5Q19-40 19-36L17-27C16.5-20 16.8-8 16.6 3.5Q0 6.2-16.6 3.5C-16.8-8-16.5-20-17-27L-19-36Q-19-40-16.5-41.5Z';

function torsoSvg(view: View, keeper: boolean, skin: string, kit: Kit, number?: number, name?: string, necklace?: string): string {
  const back = view === 'back';
  const trimOnShirt = kit.trim === kit.shirt ? '#fff' : accentOn(kit.trim, luma(kit.shirt) < 0.3);
  const details = keeper
    ? `<path d="M-20-19L20-33L20-27L-20-13Z" fill="#000" opacity=".13"/>
       <path d="M-20-7L20-21L20-16.5L-20-2.5Z" fill="#000" opacity=".1"/>`
    : `<path d="M-17.4-28L-16.6 4M17.4-28L16.6 4" stroke="${kit.trim}" stroke-width="2.2"/>
       <path d="M-19-37Q0-31.5 19-37" fill="none" stroke="#000" stroke-opacity=".08" stroke-width="1"/>`;
  const collar = back
    ? `<path d="M-7.5-44Q0-41 7.5-44" fill="none" stroke="${kit.trim}" stroke-width="2.6" stroke-linecap="round"/>`
    : `<path d="M-6-44.2L0-37.5L6-44.2Z" fill="${skin}"/>
       <path d="M-6.6-44.4L0-37L6.6-44.4" fill="none" stroke="${trimOnShirt}" stroke-width="2.2" stroke-linejoin="round"/>
       <path d="M-11.4-34.4L-5.8-34.4L-5.8-29.8Q-8.6-26.8-11.4-29.8Z" fill="${trimOnShirt}" stroke="${OL}" stroke-width=".6"/>`;
  let print = '';
  if (number !== undefined && back) {
    print = `<text x="0" y="-32.2" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="5" letter-spacing=".3" fill="${kit.trim}">${xml((name ?? '').toUpperCase().slice(0, 9))}</text>
       <text x="0" y="-9" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="20" fill="${kit.trim}" stroke="${dark(kit.shirt, 0.4)}" stroke-width=".6" paint-order="stroke">${number}</text>`;
  } else if (number !== undefined && !keeper) {
    print = `<text x="8.6" y="-28.4" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="7" fill="${trimOnShirt}">${number}</text>`;
  }
  return `<defs>
      <clipPath id="c"><path d="${SHIRT}"/></clipPath>
      <linearGradient id="g" x1="0" x2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".26"/><stop offset=".32" stop-color="#000" stop-opacity="0"/>
        <stop offset=".7" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".2"/>
      </linearGradient>
    </defs>
    <path d="M-4.6-51L4.6-51L5.2-41L-5.2-41Z" fill="${skin}" stroke="${OL}" stroke-width="1"/>
    <path d="M1.4-51L4.6-51L5.2-41L1.6-41Z" fill="#000" opacity=".16"/>
    <path d="${SHIRT}" fill="${kit.shirt}"/>
    <g clip-path="url(#c)">
      ${details}
      <rect x="-21" y="-52" width="42" height="59" fill="url(#g)"/>
      <path d="M-7-14Q-4-6-8 2M8-18Q5-10 9-2" fill="none" stroke="#000" stroke-opacity=".1" stroke-width=".9"/>
    </g>
    <path d="${SHIRT}" fill="none" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    ${collar}${print}
    ${necklace ? (back
      ? `<path d="M-4.6-46.8Q0-44.4 4.6-46.8" fill="none" stroke="${necklace}" stroke-width="1.1"/>`
      : `<path d="M-4.8-47Q0-36.8 4.8-47" fill="none" stroke="${necklace}" stroke-width="1"/><circle cx="0" cy="-38.6" r="1.4" fill="${necklace}" stroke="${OL}" stroke-width=".4"/>`) : ''}`;
}

// ---------- Braço (ombro em 0,0, pendurado para baixo) ----------
const ARM = 'M-5.2 4C-5.8 11-5 17-4 20.5C-4.7 24-4.2 29-3.1 33L3.1 33C4.2 29 4.7 24 4 20.5C5 17 5.8 11 5.2 4Z';
const HAND = 'M-3.7 31.4C-4.4 35.8-3 39.6 0 39.8C3 39.6 4.4 35.8 3.7 31.4Z';
const SLEEVE = 'M-5.6-3C-3.4-6.6 3.4-6.6 5.6-3L6.8 10.2Q0 12.2-6.8 10.2Z';
const LONG_SLEEVE = 'M-5.8-3C-3.4-6.8 3.4-6.8 5.8-3L6.4 11C5.6 17 5.4 22 5 28.5L-5 28.5C-5.4 22-5.6 17-6.4 11Z';
const GLOVE = 'M-5.8 27L5.8 27L6.8 33C7.2 40 5.2 44.6 0 45C-5.2 44.6-7.2 40-6.8 33Z';

function armSvg(keeper: boolean, skin: string, kit: Kit, gear: GearVisual = {}, armband = false): string {
  if (keeper) {
    const strap = luma(kit.trim) < 0.3 ? '#2b2f36' : kit.trim;
    return `<defs><clipPath id="s"><path d="${LONG_SLEEVE}"/></clipPath><clipPath id="g"><path d="${GLOVE}"/></clipPath></defs>
      <path d="${LONG_SLEEVE}" fill="${kit.shirt}"/>
      <g clip-path="url(#s)">
        <ellipse cx="0" cy="16" rx="4.4" ry="3.6" fill="${dark(kit.shirt, 0.22)}"/>
        <rect x="-9" y="25.4" width="18" height="3.2" fill="${dark(kit.shirt, 0.3)}"/>
        <path d="M1.4-8L9-8L9 30L1.6 30Z" fill="#000" opacity=".16"/>
      </g>
      <path d="${LONG_SLEEVE}" fill="none" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="${GLOVE}" fill="#f2efe6"/>
      <g clip-path="url(#g)">
        <rect x="-9" y="26" width="18" height="5" fill="${strap}"/>
        <path d="M1.8 26L9 26L9 46L1 46Z" fill="#000" opacity=".1"/>
      </g>
      <path d="M-2.6 38.4v4.4M0 38.6v5M2.6 38.4v4.4" stroke="#bdb8ab" stroke-width=".8" stroke-linecap="round"/>
      <path d="${GLOVE}" fill="none" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>`;
  }
  const limb = gear.sleeves ?? skin;
  const hand = gear.gloves ?? skin;
  return `<defs><clipPath id="a"><path d="${ARM}"/></clipPath><clipPath id="s"><path d="${SLEEVE}"/></clipPath></defs>
    <path d="${ARM}" fill="${limb}"/>
    <g clip-path="url(#a)"><path d="M1.2 0L9 0L9 36L1 36Z" fill="#000" opacity=".17"/></g>
    <path d="${ARM}" fill="none" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    ${gear.wrist ? `<rect x="-3.9" y="27.6" width="7.8" height="3.6" rx="1" fill="${gear.wrist}" stroke="${OL}" stroke-width=".7"/>` : ''}
    <path d="${HAND}" fill="${hand}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M-3 33.6Q-4.3 35.6-2.3 36.6" fill="none" stroke="${dark(hand, 0.3)}" stroke-width=".7"/>
    <path d="M-2.4 20.4Q0 21.4 2.4 20.4" fill="none" stroke="${dark(limb, 0.22)}" stroke-width=".7"/>
    <path d="${SLEEVE}" fill="${kit.shirt}"/>
    <g clip-path="url(#s)">
      <rect x="-9" y="7.8" width="18" height="2.8" fill="${kit.trim}"/>
      ${armband && gear.armband ? `<rect x="-9" y="2" width="18" height="4.4" fill="${gear.armband}"/><rect x="-9" y="2" width="18" height=".8" fill="${OL}" opacity=".35"/>` : ''}
      <path d="M1.4-8L9-8L9 14L1.6 14Z" fill="#000" opacity=".16"/>
    </g>
    <path d="${SLEEVE}" fill="none" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>`;
}

// ---------- Cabeça (centro em 0,0) ----------
const FACE = 'M-10.4-2C-10.4-12-6-14.6 0-14.6C6-14.6 10.4-12 10.4-2C10.4 6 6.4 12.2 0 12.6C-6.4 12.2-10.4 6-10.4-2Z';

/** Cabelo black power: contorno das bolhas por baixo, preenchimento por cima, para um contorno único. */
function afro(hair: string, cy: number): string {
  const blobs: [number, number, number][] = [[0, cy, 14.2]];
  for (let a = 0; a < 360; a += 32) {
    const r = (a * Math.PI) / 180;
    blobs.push([Math.cos(r) * 12.6, cy + Math.sin(r) * 12.6, 4.8]);
  }
  const circles = (attrs: string) => blobs.map(([x, y, r]) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r}" ${attrs}/>`).join('');
  return `<g>${circles(`fill="${OL}" stroke="${OL}" stroke-width="2.4"`)}</g><g>${circles(`fill="${hair}"`)}</g>
    <path d="M-7 ${cy - 11}Q0 ${cy - 15} 7 ${cy - 11}" fill="none" stroke="${light(hair, 0.3)}" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`;
}

/** 0 curto · 1 raspado · 2 black power · 3 rabo de cavalo · 4 moicano · 5 careca */
function headSvg(view: View, skin: string, hair: string, style: number, trim: string, headband?: string): string {
  const sh = dark(skin, 0.3);
  const shine = (c: string) => `<path d="M-6-12.6Q0-15.8 6-12.6" fill="none" stroke="${light(c, 0.35)}" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>`;
  const ears = [-1, 1].map((s) => `<ellipse cx="${s * 10.5}" cy=".2" rx="2.5" ry="3.6" fill="${skin}" stroke="${OL}" stroke-width="1"/>
    <path d="M${s * 10.3}-1.6Q${s * 11.6} .2 ${s * 10.3} 2" fill="none" stroke="${sh}" stroke-width=".7"/>`).join('');
  const face = `<defs><clipPath id="f"><path d="${FACE}"/></clipPath></defs>
    <path d="${FACE}" fill="${skin}"/>
    <g clip-path="url(#f)"><path d="M3.4-16C8.4-8 9-2 3 14L14 14L14-16Z" fill="#000" opacity=".14"/></g>
    <path d="${FACE}" fill="none" stroke="${OL}" stroke-width="1.2"/>`;
  const mohawk = (bottom: number) => `<path d="M-3.2-16.6C-1.6-18.6 1.6-18.6 3.2-16.6L2.8 ${bottom}Q0 ${bottom + 1.2}-2.8 ${bottom}Z" fill="${hair}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>`;
  const stubble = `<path d="${FACE}" fill="${hair}" opacity=".18" clip-path="url(#f)"/>`;

  if (view === 'back') {
    const cap = 'M-11 0C-11.6-11-6.6-16.8 0-16.8C6.6-16.8 11.6-11 11 0C10.6 5.6 7.4 9.2 4.2 10.4Q0 11.4-4.2 10.4C-7.4 9.2-10.6 5.6-11 0Z';
    let hairDraw: string;
    if (style === 2) hairDraw = afro(hair, -4);
    else if (style === 4) hairDraw = `${stubble}${mohawk(9)}`;
    else if (style === 5) hairDraw = shine(skin);
    else {
      hairDraw = `<path d="${cap}" fill="${hair}" fill-opacity="${style === 1 ? 0.82 : 1}" stroke="${OL}" stroke-width="1.2"/>${shine(hair)}
        ${style === 3 ? `<path d="M-2.4 3C-3.6 9-2.6 15.6 0 19.4C2.6 15.6 3.6 9 2.4 3Z" fill="${hair}" stroke="${OL}" stroke-width="1.1"/>
          <rect x="-2.9" y="2.6" width="5.8" height="2.4" rx="1" fill="${accentOn(trim, true)}" stroke="${OL}" stroke-width=".6"/>` : ''}`;
    }
    return `${ears}${face}${hairDraw}${headband ? `<path d="M-11.4-3.6Q0-6.2 11.4-3.6L11.6-.4Q0-3 -11.6-.4Z" fill="${headband}" stroke="${OL}" stroke-width=".8"/>` : ''}`;
  }

  const fronts: Record<number, string> = {
    0: 'M-10.9-2.5C-11.6-12.4-6.6-17 0-17C6.6-17 11.6-12.4 10.9-2.5C10-6.6 8.4-8.6 6.4-9C4.2-7.4 1.2-8-.8-9.4C-3-7.8-6-7.8-8.2-8.8C-9.6-7.4-10.4-5.4-10.9-2.5Z',
    1: 'M-10.7-4C-11.1-12.8-6.2-15.8 0-15.8C6.2-15.8 11.1-12.8 10.7-4C8.4-9 4.4-10.4 0-10.4C-4.4-10.4-8.4-9-10.7-4Z',
    2: 'M-10.6-3C-11-11-6-15 0-15C6-15 11-11 10.6-3C9-8 5-9.6 0-9.6C-5-9.6-9-8-10.6-3Z',
    3: 'M-10.8-3C-11-13-6-16.4 0-16.4C6-16.4 11-13 10.8-3C9-9.2 5-11.4 0-11.6C-5-11.4-9-9.2-10.8-3Z',
  };
  const behind = style === 2 ? afro(hair, -5) : style === 3 ? `<circle cx="0" cy="-17.4" r="4.4" fill="${hair}" stroke="${OL}" stroke-width="1.1"/>` : '';
  const top = fronts[style]
    ? `<path d="${fronts[style]}" fill="${hair}" fill-opacity="${style === 1 ? 0.85 : 1}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>${style === 1 ? '' : shine(hair)}`
    : style === 4 ? `${stubble}${mohawk(-10.6)}` : shine(skin);
  const eyes = [-1, 1].map((s) => `<ellipse cx="${s * 4.1}" cy="-.6" rx="2.35" ry="1.75" fill="#fbf8f2"/>
    <circle cx="${s * 3.9}" cy="-.4" r="1.25" fill="#2b1d14"/><circle cx="${s * 3.9 + 0.4}" cy="-.9" r=".4" fill="#fff"/>
    <path d="M${s * 6.4}-.9Q${s * 4.1}-2.9 ${s * 1.8}-.9" fill="none" stroke="${OL}" stroke-width=".75"/>
    <path d="M${s * 6.4}-4.6Q${s * 4.3}-5.9 ${s * 2.1}-4.9" fill="none" stroke="${style === 5 ? sh : dark(hair, 0.1)}" stroke-width="1.35" stroke-linecap="round"/>`).join('');
  return `${behind}${ears}${face}${eyes}
    <path d="M.3-.2Q1.6 3.8-.5 4.4" fill="none" stroke="${sh}" stroke-width=".9" stroke-linecap="round"/>
    <path d="M-2.9 7.3Q0 8.7 2.9 7.3" fill="none" stroke="${dark(skin, 0.45)}" stroke-width="1" stroke-linecap="round"/>
    ${top}${headband ? `<path d="M-11-9.4Q0-12.6 11-9.4L11.2-6.2Q0-9.4 -11.2-6.2Z" fill="${headband}" stroke="${OL}" stroke-width=".8"/>` : ''}`;
}

// ---------- Cabeças dos raids (bem caricatas de propósito) ----------
function speciesHead(view: View, sp: Species, skin: string): string {
  const back = view === 'back';
  const outline = (d: string, fill: string) => `<path d="${d}" fill="${fill}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>`;
  if (sp === 'alien') {
    // Cabeção em gota, olhões pretos e anteninhas com bolinhas
    const head = 'M-13-6C-13-19-7-23 0-23C7-23 13-19 13-6C13 4 6 12 0 12.6C-6 12-13 4-13-6Z';
    const antennae = [-1, 1].map((x) => `<path d="M${x * 4}-21Q${x * 8}-30 ${x * 11}-31" fill="none" stroke="${OL}" stroke-width="1.4"/>
      <circle cx="${x * 11}" cy="-31" r="2.6" fill="#ffd23f" stroke="${OL}" stroke-width=".9"/>`).join('');
    if (back) return `${antennae}${outline(head, skin)}<path d="M-6-18Q0-21 6-18" fill="none" stroke="${light(skin, 0.4)}" stroke-width="1.4" stroke-linecap="round"/>`;
    const eyes = [-1, 1].map((x) => `<ellipse cx="${x * 5.6}" cy="-5" rx="5" ry="3.2" transform="rotate(${x * 24} ${x * 5.6} -5)" fill="#0d0d12"/>
      <circle cx="${x * 5.6 + 1.4}" cy="-6" r="1.1" fill="#fff"/><circle cx="${x * 5.6 - 1.2}" cy="-4" r=".6" fill="#fff"/>`).join('');
    return `${antennae}${outline(head, skin)}${eyes}
      <path d="M-2.4 5Q0 6.8 2.4 5" fill="none" stroke="${OL}" stroke-width=".9" stroke-linecap="round"/>
      <ellipse cx="-9.5" cy="2" rx="2.2" ry="1.3" fill="#ff7ad9" opacity=".45"/><ellipse cx="9.5" cy="2" rx="2.2" ry="1.3" fill="#ff7ad9" opacity=".45"/>`;
  }
  if (sp === 'cyborg') {
    // Cabeça metálica com rebites, visor vermelho e anteninha piscante
    const head = 'M-11-12Q-11-16-7-16L7-16Q11-16 11-12L11 6Q11 12 4 12.6L-4 12.6Q-11 12-11 6Z';
    const rivets = [[-8.6, -13.4], [8.6, -13.4], [-8.6, 9.6], [8.6, 9.6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="${dark(skin, 0.4)}"/>`).join('');
    const bolts = [-1, 1].map((x) => `<rect x="${x > 0 ? 10.4 : -13.4}" y="-3" width="3" height="6" rx="1" fill="${dark(skin, 0.25)}" stroke="${OL}" stroke-width=".8"/>`).join('');
    const antenna = `<path d="M5-16L7-23" stroke="${OL}" stroke-width="1.2"/><circle cx="7" cy="-23.6" r="1.8" fill="#ff3b3b" stroke="${OL}" stroke-width=".6"/>`;
    if (back) return `${antenna}${bolts}${outline(head, skin)}${rivets}<path d="M-11-2L11-2M0-16L0 12" stroke="${dark(skin, 0.2)}" stroke-width=".8"/>`;
    return `${antenna}${bolts}${outline(head, skin)}${rivets}
      <rect x="-10" y="-6" width="20" height="5" rx="2.5" fill="#2a0607" stroke="${OL}" stroke-width=".8"/>
      <rect x="-8.6" y="-4.8" width="9" height="2.6" rx="1.3" fill="#ff3b3b"/><rect x="-7.6" y="-4.4" width="3" height="1" fill="#ffd0d0"/>
      <path d="M-4.6 5.4h9.2M-4.6 7.6h9.2" stroke="${dark(skin, 0.45)}" stroke-width="1" stroke-linecap="round"/>
      <path d="M2-12L6-12L8-9" fill="none" stroke="${dark(skin, 0.3)}" stroke-width=".7"/>`;
  }
  if (sp === 'dog') {
    // Orelhas caídas, focinho, nariz brilhante e língua de fora
    const ears = [-1, 1].map((x) => `<ellipse cx="${x * 11.4}" cy="1" rx="3.8" ry="8.6" transform="rotate(${x * -12} ${x * 11.4} 1)" fill="${dark(skin, 0.35)}" stroke="${OL}" stroke-width="1.1"/>`).join('');
    if (back) return `${outline(FACE, skin)}${ears}<path d="M-5-11Q0-13.5 5-11" fill="none" stroke="${light(skin, 0.3)}" stroke-width="1.3" stroke-linecap="round"/>`;
    const eyes = [-1, 1].map((x) => `<circle cx="${x * 4.4}" cy="-3.4" r="2" fill="#1a120c"/><circle cx="${x * 4.4 + 0.7}" cy="-4.1" r=".7" fill="#fff"/>
      <path d="M${x * 6.6}-7.6Q${x * 4.4}-9.4 ${x * 2.2}-7.8" fill="none" stroke="${OL}" stroke-width="1" stroke-linecap="round"/>`).join('');
    return `${outline(FACE, skin)}${ears}${eyes}
      <ellipse cx="0" cy="4.2" rx="6.4" ry="4.6" fill="${light(skin, 0.45)}" stroke="${OL}" stroke-width=".9"/>
      <ellipse cx="0" cy="1.6" rx="2.6" ry="1.8" fill="#17110d"/><circle cx="-.8" cy="1" r=".6" fill="#fff"/>
      <path d="M-2.6 6.4Q0 7.8 2.6 6.4" fill="none" stroke="${OL}" stroke-width=".9"/>
      <path d="M-1.6 7.2Q-1.8 12 0 12.4Q1.8 12 1.6 7.2Z" fill="#ff6f91" stroke="${OL}" stroke-width=".7"/>`;
  }
  // Gato: orelhas pontudas, olhos de fenda, bigodes e boquinha em "w"
  const ears = [-1, 1].map((x) => `<path d="M${x * 4}-12.6L${x * 10.6}-21L${x * 10.8}-8Z" fill="${skin}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M${x * 6}-12L${x * 9.6}-17.6L${x * 9.6}-10Z" fill="#ff9fc4"/>`).join('');
  const stripes = `<path d="M-3-14.4L-2.4-10M0-14.6L0-10.4M3-14.4L2.4-10" stroke="${dark(skin, 0.3)}" stroke-width="1.1" stroke-linecap="round"/>`;
  if (back) return `${ears}${outline(FACE, skin)}${stripes}`;
  const eyes = [-1, 1].map((x) => `<ellipse cx="${x * 4.4}" cy="-2.6" rx="2.6" ry="2.2" fill="#d9e85a" stroke="${OL}" stroke-width=".6"/>
    <ellipse cx="${x * 4.4}" cy="-2.6" rx=".6" ry="1.9" fill="#111"/>`).join('');
  const whiskers = [-1, 1].map((x) => `<path d="M${x * 5}3.4L${x * 13}1.6M${x * 5}4.6L${x * 13}5M${x * 5}5.8L${x * 12}8" stroke="${OL}" stroke-width=".55"/>`).join('');
  return `${ears}${outline(FACE, skin)}${stripes}${eyes}${whiskers}
    <path d="M-1.4 1.6L1.4 1.6L0 3.2Z" fill="#ff7aa8" stroke="${OL}" stroke-width=".5"/>
    <path d="M-3 4.6Q-1.5 6.2 0 4.6Q1.5 6.2 3 4.6" fill="none" stroke="${OL}" stroke-width=".8" stroke-linecap="round"/>`;
}

// ---------- Personagem completo ----------

/** `species`/`skinColor`: jogadores dos raids (cabeça e pele/pelo/metal próprios). */
export interface FigureOpts { number?: number; name?: string; keeper?: boolean; gear?: GearVisual; species?: Species; skinColor?: string }

function partsArt(view: View, look: Appearance, kit: Kit, o: FigureOpts) {
  const skin = o.skinColor ?? SKIN_TONES[look.skin] ?? SKIN_TONES[0];
  const hair = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0];
  const g = o.gear ?? {};
  const boot = g.boots?.color ?? BOOT_COLORS[look.boots ?? 0] ?? BOOT_COLORS[0];
  const keeper = o.keeper ?? view === 'front';
  const gk = keeper ? '' : gearKey(g);
  const k = (part: string, ...p: unknown[]) => `fig-${part}-${view}-${keeper ? 'gk' : 'pl'}-${o.species ?? 'h'}-${p.join('-')}-${gk}`;
  const part = (key: string, vb: VB, body: string): PartArt => ({ key, vb, body });
  return {
    leg: part(k('leg', skin, kit.socks, kit.trim, boot), [-9, -3, 18, 59], legSvg(view, skin, kit, boot, g.boots?.accent, !!g.socksLow)),
    shorts: part(k('shorts', kit.shorts, kit.trim, skin), [-19, -12, 52, 36], shortsSvg(kit, tailSvg(o.species, skin, view))),
    torso: part(k('torso', skin, kit.shirt, kit.trim, o.number ?? '', o.name ?? ''), [-21, -52, 42, 59], torsoSvg(view, keeper, skin, kit, o.number, o.name, keeper ? undefined : g.necklace)),
    arm: part(k('arm', skin, kit.shirt, kit.trim), [-9, -7, 18, 53], armSvg(keeper, skin, kit, keeper ? {} : g)),
    armL: part(k('armL', skin, kit.shirt, kit.trim), [-9, -7, 18, 53], armSvg(keeper, skin, kit, keeper ? {} : g, true)),
    head: part(k('head', skin, hair, look.hair, kit.trim), [-20, -34, 40, 56],
      o.species ? speciesHead(view, o.species, skin) : headSvg(view, skin, hair, look.hair, kit.trim, keeper ? undefined : g.headband)),
  };
}

const pending = new Map<string, Promise<void>>();

/** Cria (uma vez) a textura a partir do SVG e devolve a peça com a origem no ponto (0,0) do desenho. */
function texture(scene: Phaser.Scene, { key, vb, body }: PartArt): Promise<Part> {
  const part = { key, ox: -vb[0] / vb[2], oy: -vb[1] / vb[3] };
  if (scene.textures.exists(key)) return Promise.resolve(part);
  let p = pending.get(key);
  if (!p) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vb[2] * ART_SCALE}" height="${vb[3] * ART_SCALE}" viewBox="${vb.join(' ')}">${body}</svg>`;
    p = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
        resolve();
      };
      // Sem a arte a peça aparece como textura ausente, mas a partida segue.
      img.onerror = () => resolve();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }).finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p.then(() => part);
}

/** Monta (ou reaproveita) as texturas de um personagem para a partida. */
export async function figureSkin(scene: Phaser.Scene, view: View, look: Appearance, kit: Kit, o: FigureOpts = {}): Promise<FigureSkin> {
  const a = partsArt(view, look, kit, o);
  const [leg, shorts, torso, arm, armL, head] = await Promise.all([a.leg, a.shorts, a.torso, a.arm, a.armL, a.head].map((p) => texture(scene, p)));
  return { leg, shorts, torso, arm, armL, head, headScale: o.species ? 1.22 : 0.9 };
}

let uid = 0;

/** Peça posicionada no esqueleto; ids prefixados para não colidirem no mesmo documento HTML. */
function place(p: PartArt, x: number, y: number, prefix: string, flip = false, scale = 1): string {
  const body = p.body.replace(/id="(\w+)"/g, `id="${prefix}$1"`).replace(/url\(#(\w+)\)/g, `url(#${prefix}$1)`);
  const [vx, vy, vw, vh] = p.vb;
  return `<g transform="translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}${scale !== 1 ? ` scale(${scale})` : ''}">
    <svg x="${vx}" y="${vy}" width="${vw}" height="${vh}" viewBox="${p.vb.join(' ')}" overflow="visible">${body}</svg></g>`;
}

/**
 * Personagem inteiro em pé, como SVG para o HTML (prévia da criação, retratos).
 * Mesmo esqueleto de Figures.ts: pés em y=0, quadris em -52, tronco em -56.
 */
export function figureMarkup(view: View, look: Appearance, kit: Kit, o: FigureOpts = {}): string {
  const a = partsArt(view, look, kit, { keeper: false, ...o });
  const id = `fg${++uid}-`;
  return place(a.leg, -7, -52, `${id}a`) + place(a.leg, 7, -52, `${id}b`, true)
    + place(a.shorts, 0, -62, `${id}c`)
    + place(a.torso, 0, -56, `${id}d`)
    + place(a.head, 0, -115, `${id}e`, false, 0.9)
    + place(view === 'back' ? a.armL : a.arm, -18.5, -94.5, `${id}f`) + place(view === 'back' ? a.arm : a.armL, 18.5, -94.5, `${id}g`, true);
}
