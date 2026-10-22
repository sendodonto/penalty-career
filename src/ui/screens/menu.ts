import { sfx } from '../../game/audio';
import { getClub } from '../../game/data/clubs';
import { nextFixture, overall } from '../../game/systems/Career';
import { deleteCareer } from '../../game/systems/SaveManager';
import type { Career } from '../../game/types';
import type { App } from '../app';
import { avatar, badge, confirmDialog, esc } from '../components';
import { el } from './dom';

function continueCard(c: Career): string {
  const club = getClub(c.clubId);
  const f = nextFixture(c);
  return `<button class="continue-card" data-a="continue">
    ${avatar(c.identity.appearance, club, c.identity.number, 68)}
    <span class="cc-body">
      <small>Continuar carreira</small>
      <b>${esc(c.identity.name)}</b>
      <span class="cc-club">${badge(club, 16)} ${esc(club.name)} · Temporada ${c.season}</span>
      <span class="cc-next">${f ? `Próximo jogo: contra ${esc(f.opponent.name)}` : 'Temporada encerrada: veja as propostas'}</span>
    </span>
    <span class="cc-ovr"><b>${overall(c.attributes)}</b><small>OVR</small></span>
  </button>`;
}

export function renderMenu(app: App): HTMLElement {
  const s = app.saveState;
  const c = s.status === 'ok' ? s.career : null;
  const view = el(`<section class="screen menu">
    <div class="menu-inner">
      <p class="kicker-line">Modo carreira · Disputas de pênaltis</p>
      <h1 class="logo">PENALTY<br><em>CAREER</em></h1>
      <p class="tagline">Do clube pequeno ao estrelato, uma cobrança de cada vez.</p>
      ${s.status === 'corrupt' ? `<p class="warn">O salvamento encontrado está corrompido ou é incompatível (${esc(s.reason)}). Apague-o para começar de novo.</p>` : ''}
      <nav class="menu-actions">
        ${c ? continueCard(c) : ''}
        <button class="btn ${c ? 'ghost' : 'primary'} big" data-a="new" ${s.status === 'corrupt' ? 'disabled' : ''}>Nova carreira</button>
        <div class="menu-row">
          <button class="btn ghost" data-a="settings">Configurações</button>
          ${s.status !== 'none' ? '<button class="btn ghost danger-text" data-a="delete">Apagar carreira</button>' : ''}
        </div>
      </nav>
    </div>
    <p class="menu-foot">Progresso salvo automaticamente neste navegador</p>
  </section>`);

  view.addEventListener('click', async (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
    if (!a) return;
    sfx.click();
    if (a === 'continue') app.go('dashboard');
    if (a === 'settings') app.go('settings');
    if (a === 'new') {
      if (c && !(await confirmDialog('Nova carreira', 'Começar de novo substitui a carreira salva atual. Deseja continuar?', 'Substituir', true))) return;
      app.go('create');
    }
    if (a === 'delete') {
      if (!(await confirmDialog('Apagar carreira', 'Todo o progresso salvo será perdido. Esta ação não pode ser desfeita.', 'Apagar', true))) return;
      deleteCareer();
      app.career = null;
      app.saveState = { status: 'none' };
      app.go('menu');
    }
  });
  return view;
}
