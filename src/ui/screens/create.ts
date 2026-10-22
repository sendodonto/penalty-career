import { sfx } from '../../game/audio';
import { BOOT_COLORS, HAIR_COLORS, HAIR_STYLES, SKIN_ORDER, SKIN_TONES } from '../../game/data/appearance';
import { getClub, getLeague, STARTING_CLUB_ID } from '../../game/data/clubs';
import { NATIONALITIES } from '../../game/data/nations';
import { clubKit, figureMarkup, type View } from '../../game/entities/figureArt';
import { seeded } from '../../game/rng';
import { ATTR_KEYS, ATTR_LABELS, createCareer, overall, PLAYING_STYLES, STYLE_BONUS } from '../../game/systems/Career';
import type { Appearance, AttrKey, PlayerIdentity } from '../../game/types';
import type { App } from '../app';
import { avatar, badge, bar, esc } from '../components';
import { el } from './dom';

const BOOT_NAMES = ['Preta', 'Branca', 'Neon', 'Laranja', 'Azul'];

export function renderCreate(app: App): HTMLElement {
  const club = getClub(STARTING_CLUB_ID);
  const kit = clubKit(club);
  // Mesma semente na prévia e na criação: os atributos mostrados são exatamente os que o jogador recebe.
  const seed = Math.floor(Math.random() * 2 ** 31);
  const look: Appearance = { skin: 1, hair: 0, hairColor: 0, boots: 0 };
  let style: AttrKey = 'precision';
  let side: View = 'front';

  const swatches = (key: keyof Appearance, colors: string[], order = colors.map((_, i) => i), names?: string[]) =>
    order.map((i) => `<button type="button" class="swatch" style="--c:${colors[i]}" data-k="${key}" data-v="${i}" aria-label="${names?.[i] ?? `Opção ${i + 1}`}"></button>`).join('');

  const view = el(`<section class="screen create">
    <header class="topbar">
      <button class="btn ghost" data-back>Voltar</button><h1>Criar jogador</h1>
      <button type="button" class="btn ghost" data-random>Aleatório</button>
    </header>
    <form class="create-layout" novalidate>
      <aside class="panel create-stage">
        <div class="stage-pitch"><svg class="stage-figure" viewBox="-42 -142 84 150" role="img" aria-label="Prévia do jogador" data-figure></svg></div>
        <div class="view-toggle" role="group" aria-label="Vista do jogador">
          <button type="button" data-view="front">Frente</button><button type="button" data-view="back">Costas</button>
        </div>
        <div class="stage-caption">${badge(club, 30)}
          <div class="grow"><b data-cap-name>Seu jogador</b><span>${esc(club.name)} · Camisa <span data-cap-num>10</span></span></div>
          <div class="ovr small"><b data-ovr></b><span>OVR</span></div>
        </div>
        <div class="stage-attrs" data-attrs></div>
      </aside>
      <div class="create-steps">
        <section class="panel">
          <h2><span class="step">1</span>Identidade</h2>
          <label class="field"><span>Nome</span><input name="name" maxlength="18" required placeholder="Ex.: Rafael Duarte" autocomplete="off" /></label>
          <div class="row">
            <label class="field grow"><span>Nacionalidade</span><select name="nat">${NATIONALITIES.map((n) => `<option>${n}</option>`).join('')}</select></label>
            <label class="field num"><span>Camisa</span><input name="number" type="number" min="1" max="99" value="10" required /></label>
          </div>
        </section>
        <section class="panel">
          <h2><span class="step">2</span>Visual</h2>
          <div class="field"><span>Tom de pele</span><div class="swatches">${swatches('skin', SKIN_TONES, SKIN_ORDER)}</div></div>
          <div class="field"><span>Cabelo</span><div class="chips">${HAIR_STYLES.map((h, i) => `<button type="button" class="chip" data-k="hair" data-v="${i}">${h}</button>`).join('')}</div></div>
          <div class="field"><span>Cor do cabelo</span><div class="swatches">${swatches('hairColor', HAIR_COLORS)}</div></div>
          <div class="field"><span>Chuteira</span><div class="swatches">${swatches('boots', BOOT_COLORS, undefined, BOOT_NAMES)}</div></div>
        </section>
        <section class="panel">
          <h2><span class="step">3</span>Estilo de cobrança</h2>
          <div class="styles">${ATTR_KEYS.map((k) => `<button type="button" class="style-card" data-style="${k}">
            <b>${PLAYING_STYLES[k].name}</b><span>${PLAYING_STYLES[k].text}</span><em>+${STYLE_BONUS} ${ATTR_LABELS[k]}</em></button>`).join('')}</div>
        </section>
        <p class="form-error" data-error></p>
        <button class="btn primary big wide" type="submit">Assinar primeiro contrato</button>
      </div>
    </form>
  </section>`);

  const form = view.querySelector('form')!;
  const field = (n: string) => form.elements.namedItem(n) as HTMLInputElement;
  const num = () => Math.round(Number(field('number').value));
  const name = () => field('name').value.trim().replace(/\s+/g, ' ');
  const draft = (): PlayerIdentity => ({ name: name(), nationality: field('nat').value, number: num(), appearance: { ...look }, style });

  const refresh = () => {
    const n = num();
    const shirtName = name().split(' ').pop() || 'JOGADOR';
    view.querySelector('[data-figure]')!.innerHTML = `<ellipse cx="0" cy="1" rx="26" ry="4.5" fill="#000" opacity=".3"/>
      ${figureMarkup(side, look, kit, { number: n >= 1 && n <= 99 ? n : undefined, name: shirtName })}`;
    view.querySelector('[data-cap-name]')!.textContent = name() || 'Seu jogador';
    view.querySelector('[data-cap-num]')!.textContent = n >= 1 && n <= 99 ? String(n) : '–';
    const attrs = createCareer(draft(), seeded(seed)).attributes;
    view.querySelector('[data-ovr]')!.textContent = String(overall(attrs));
    view.querySelector('[data-attrs]')!.innerHTML = ATTR_KEYS.map((k) => `<div class="attr-mini${k === style ? ' boosted' : ''}">
      <span>${ATTR_LABELS[k]}</span>${bar(attrs[k])}<b>${attrs[k]}</b></div>`).join('');
    view.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => b.classList.toggle('on', look[b.dataset.k as keyof Appearance] === Number(b.dataset.v)));
    view.querySelectorAll<HTMLElement>('[data-style]').forEach((b) => b.classList.toggle('on', b.dataset.style === style));
    view.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === side));
  };
  refresh();

  view.querySelector('[data-back]')!.addEventListener('click', () => { sfx.click(); app.go('menu'); });
  view.querySelector('[data-random]')!.addEventListener('click', () => {
    const r = (n: number) => Math.floor(Math.random() * n);
    Object.assign(look, { skin: r(SKIN_TONES.length), hair: r(HAIR_STYLES.length), hairColor: r(HAIR_COLORS.length), boots: r(BOOT_COLORS.length) });
    style = ATTR_KEYS[r(ATTR_KEYS.length)];
    sfx.select();
    refresh();
  });
  form.addEventListener('input', refresh);
  form.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-k], [data-style], [data-view]');
    if (!b) return;
    sfx.select();
    if (b.dataset.k) look[b.dataset.k as keyof Appearance] = Number(b.dataset.v);
    if (b.dataset.style) style = b.dataset.style as AttrKey;
    if (b.dataset.view) side = b.dataset.view as View;
    refresh();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = num();
    const error = name().length < 2 ? 'Digite um nome com pelo menos 2 letras.' : !(n >= 1 && n <= 99) ? 'O número da camisa vai de 1 a 99.' : '';
    view.querySelector('[data-error]')!.textContent = error;
    if (error) return;
    app.commit(createCareer(draft(), seeded(seed)));
    sfx.whistle();
    view.replaceWith(firstClub(app));
  });
  return view;
}

function firstClub(app: App): HTMLElement {
  const c = app.career!;
  const club = getClub(c.clubId);
  const style = c.identity.style ? PLAYING_STYLES[c.identity.style].name : null;
  const view = el(`<section class="screen narrow enter">
    <div class="panel signing">
      <p class="kicker-line">Primeiro contrato profissional</p>
      <div class="signing-club">${badge(club, 96)}<div><h1>${esc(club.name)}</h1><p>${esc(club.city)} · ${esc(getLeague(club.league).name)}</p></div></div>
      <p>O ${esc(club.name)} disputa a Série B e aposta em você como cobrador oficial. Converta pênaltis, conquiste o acesso, as copas e chame a atenção dos gigantes da Europa e da seleção.</p>
      <div class="signing-player">${avatar(c.identity.appearance, club, c.identity.number, 110)}
        <div class="grow"><h2>${esc(c.identity.name)} <small>OVR ${overall(c.attributes)}${style ? ` · ${style}` : ''}</small></h2>
        ${ATTR_KEYS.map((k) => `<div class="attr-mini"><span>${ATTR_LABELS[k]}</span>${bar(c.attributes[k])}<b>${c.attributes[k]}</b></div>`).join('')}</div>
      </div>
      <button class="btn primary big" data-go>Ir para o painel da carreira</button>
    </div>
  </section>`);
  view.querySelector('[data-go]')!.addEventListener('click', () => { sfx.click(); app.go('dashboard'); });
  return view;
}
