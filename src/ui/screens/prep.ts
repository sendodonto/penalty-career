import { sfx } from '../../game/audio';
import { IS_TOUCH } from '../../game/device';
import { ATTR_KEYS, ATTR_LABELS, matchSetup, nextFixture } from '../../game/systems/Career';
import type { App } from '../app';
import { badge, bar, esc } from '../components';
import { el } from './dom';

export function renderPrep(app: App): HTMLElement {
  const c = app.career!;
  const f = nextFixture(c);
  if (!f) {
    queueMicrotask(() => app.go('dashboard'));
    return el('<section class="screen"></section>');
  }
  const club = f.team;
  const setup = matchSetup(c, f);
  const view = el(`<section class="screen narrow prep">
    <header class="topbar"><button class="btn ghost" data-a="back">Voltar ao painel</button><h1>Preparação</h1></header>
    <div class="panel prep-head" style="--home:${club.primary};--away:${f.opponent.primary}">
      <p class="kicker-line">${esc(f.comp.name)} · ${esc(f.stage)}${f.comp.kind === 'national' ? ' · Seleção' : ''}</p>
      <div class="prep-teams">
        <div>${badge(club, 88)}<b>${esc(club.name)}</b></div>
        <span class="vs">x</span>
        <div>${badge(f.opponent, 88)}<b>${esc(f.opponent.name)}</b></div>
      </div>
      <p class="muted">Disputa direta de pênaltis. Você bate todas as cobranças do seu time e defende as do ${esc(f.opponent.short)}.</p>
    </div>
    <div class="prep-grid">
      <div class="panel">
        <h2>Objetivo</h2>
        <p class="objective-big">${esc(f.objective.text)}</p>
        <h2>Adversário</h2>
        <div class="attr-mini"><span>Goleiro</span>${bar(setup.oppKeeper.read * 100)}<b>${Math.round(setup.oppKeeper.read * 100)}</b></div>
        <div class="attr-mini"><span>Cobradores</span>${bar(setup.oppSkill * 100)}<b>${Math.round(setup.oppSkill * 100)}</b></div>
        <div class="attr-mini"><span>Pressão</span>${bar(f.difficulty * 100, 100, 'heat')}<b>${Math.round(f.difficulty * 100)}</b></div>
      </div>
      <div class="panel">
        <h2>Seu cobrador</h2>
        ${ATTR_KEYS.map((k) => `<div class="attr-mini"><span>${ATTR_LABELS[k]}</span>${bar(c.attributes[k])}<b>${c.attributes[k]}</b></div>`).join('')}
        <h2>Como cobrar</h2>
        <ol class="howto">${IS_TOUCH ? `
          <li>Toque na zona do gol onde quer chutar: a barra de precisão começa a correr.</li>
          <li>Toque na tela com o marcador na faixa dourada. Cedo puxa a bola para fora; tarde, para cima.</li>
          <li>Na vez deles, você é o goleiro: no chute o jogo fica em câmera lenta. Toque o lado do gol para onde a bola vai. Quanto mais rápido, mais longe você alcança.</li>` : `
          <li>Escolha a zona com <kbd>A</kbd>/<kbd>D</kbd>, setas, <kbd>1</kbd>–<kbd>5</kbd> ou clicando no gol.</li>
          <li>Confirme com <kbd>Espaço</kbd>: a barra de precisão começa a correr.</li>
          <li>Pare o marcador na faixa dourada. Cedo puxa a bola para fora; tarde, para cima.</li>
          <li>Na vez deles, você é o goleiro: no chute o jogo fica em câmera lenta. Veja a bola e reaja com <kbd>A</kbd> (esquerda), <kbd>S</kbd>/<kbd>Espaço</kbd> (centro) ou <kbd>D</kbd> (direita). Quanto mais rápido, mais longe você alcança.</li>`}
        </ol>
      </div>
    </div>
    <button class="btn primary big wide" data-a="play">Entrar em campo</button>
  </section>`);
  view.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
    if (a) sfx.click();
    if (a === 'back') app.go('dashboard');
    if (a === 'play') app.startMatch();
  });
  return view;
}
