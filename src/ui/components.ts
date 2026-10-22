import { clubKit, figureMarkup, type Kit } from '../game/entities/figureArt';
import { sfx } from '../game/audio';
import type { Appearance, Team } from '../game/types';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

export const money = (n: number) => `$ ${n.toLocaleString('pt-BR')}`;

/** Escudo do clube desenhado em SVG a partir das cores. */
export function badge(club: Team, size = 48): string {
  return `<svg class="badge" width="${size}" height="${size * 1.15}" viewBox="0 0 40 46" aria-label="${esc(club.name)}" role="img">
    <clipPath id="shield-${club.id}"><path d="M20 1 L38 6 V22 C38 34 30 41 20 45 C10 41 2 34 2 22 V6 Z"/></clipPath>
    <path d="M20 1 L38 6 V22 C38 34 30 41 20 45 C10 41 2 34 2 22 V6 Z" fill="${club.primary}"/>
    <rect x="0" y="18" width="40" height="8.5" fill="${club.secondary}" clip-path="url(#shield-${club.id})"/>
    <path d="M20 1 L38 6 V22 C38 34 30 41 20 45 C10 41 2 34 2 22 V6 Z" fill="none" stroke="${club.secondary}" stroke-width="2.4"/>
    <text x="20" y="24.6" text-anchor="middle" font-family="Bahnschrift, Segoe UI, sans-serif" font-weight="700" font-size="8.4" fill="${club.primary}">${club.short}</text>
  </svg>`;
}

/** Uniforme neutro para quando o jogador ainda não tem clube. */
export const NEUTRAL_KIT: Kit = { shirt: '#3a4656', trim: '#e8e2d0', shorts: '#e8e2d0', socks: '#3a4656' };

/** Retrato do jogador (busto de frente) com a mesma arte usada na partida. */
export function avatar(look: Appearance, club: Team | null, number: number, size = 120): string {
  const kit = club ? clubKit(club) : NEUTRAL_KIT;
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="-26 -136 52 52" role="img" aria-label="Retrato do jogador">
    <rect x="-26" y="-136" width="52" height="52" fill="#1b2430"/>
    <ellipse cx="0" cy="-96" rx="30" ry="22" fill="${kit.shirt}" opacity=".18"/>
    ${figureMarkup('front', look, kit, { number })}
  </svg>`;
}

export function bar(value: number, max = 100, cls = ''): string {
  return `<div class="bar ${cls}"><span style="width:${Math.max(0, Math.min(100, (value / max) * 100))}%"></span></div>`;
}

/** Confirmação modal; resolve true/false. */
export function confirmDialog(title: string, text: string, confirmLabel: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal-backdrop';
    el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">${esc(title)}</h2><p>${esc(text)}</p>
      <div class="row end"><button class="btn ghost" data-v="0">Cancelar</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(confirmLabel)}</button></div></div>`;
    const done = (v: boolean) => { el.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') done(false); };
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b) { sfx.click(); done(b.dataset.v === '1'); } else if (e.target === el) done(false);
    });
    document.addEventListener('keydown', onKey);
    document.body.append(el);
    el.querySelector<HTMLButtonElement>('[data-v="0"]')!.focus();
  });
}

export function toast(text: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}
