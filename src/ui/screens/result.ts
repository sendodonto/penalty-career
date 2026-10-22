import { sfx } from '../../game/audio';
import { getClub } from '../../game/data/clubs';
import { seasonOver } from '../../game/systems/Career';
import { ZONE_NAMES } from '../../game/systems/PenaltyResolver';
import type { App } from '../app';
import { badge, esc, money } from '../components';
import { el } from './dom';

const RESULT = { goal: 'Gol', saved: 'Defendido', post: 'Trave', miss: 'Para fora' };
const GRADE = { perfect: 'Perfeita', good: 'Boa', ok: 'Mediana', bad: 'Ruim' };

export function renderResult(app: App): HTMLElement {
  const r = app.lastResult;
  if (!r) {
    queueMicrotask(() => app.go('dashboard'));
    return el('<section class="screen"></section>');
  }
  const { stats: s, rewards: w, career: c } = r;
  const club = getClub(c.clubId);
  const opp = getClub(r.opponentId);
  const view = el(`<section class="screen narrow result">
    <div class="panel result-head ${s.won ? 'won' : 'lost'}">
      <p class="kicker-line">${s.won ? 'Vitória nos pênaltis' : 'Derrota nos pênaltis'}</p>
      <div class="result-score">${badge(club, 64)}<b>${s.scoreFor}</b><span>x</span><b>${s.scoreAgainst}</b>${badge(opp, 64)}</div>
      <p>${esc(club.name)} contra ${esc(opp.name)}</p>
    </div>
    <div class="prep-grid">
      <div class="panel">
        <h2>Suas cobranças <small>${s.goals} de ${s.kicks}</small></h2>
        <ol class="kick-list">${s.userKicks.map((k, i) => `<li class="${k.result === 'goal' ? 'hit' : 'miss'}">
          <span>${i + 1}</span><b>${RESULT[k.result]}</b><small>${ZONE_NAMES[k.zone]} · batida ${GRADE[k.grade].toLowerCase()}</small></li>`).join('')}</ol>
        <div class="objective ${s.objectiveMet ? 'ok' : 'fail'}"><span>Objetivo</span><b>${s.objectiveMet ? 'Cumprido' : 'Não cumprido'}</b></div>
      </div>
      <div class="panel">
        <h2>Recompensas</h2>
        <ul class="rewards">
          <li><span>Experiência</span><b>+${w.xp} XP</b></li>
          <li><span>Pagamento</span><b>+${money(w.money)}</b></li>
          <li><span>Reputação</span><b>${w.reputation >= 0 ? '+' : ''}${w.reputation}</b></li>
          ${s.saves ? `<li><span>Defesas como goleiro</span><b>${s.saves}</b></li>` : ''}
          ${s.decisiveGoals ? `<li><span>Cobranças decisivas</span><b>${s.decisiveGoals}</b></li>` : ''}
        </ul>
        ${w.levelsGained ? `<div class="levelup"><b>Subiu para o nível ${c.level}!</b><span>+${w.pointsGained} pontos de habilidade para distribuir no painel.</span></div>` : ''}
        ${seasonOver(c) ? '<div class="levelup"><b>Fim da temporada</b><span>Veja a classificação final e as propostas no painel.</span></div>' : ''}
      </div>
    </div>
    <button class="btn primary big wide" data-a="back">Voltar ao painel</button>
  </section>`);
  view.querySelector('[data-a="back"]')!.addEventListener('click', () => { sfx.click(); app.go('dashboard'); });
  return view;
}
