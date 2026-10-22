import { sfx } from '../../game/audio';
import { getClub, LEAGUE_NAMES } from '../../game/data/clubs';
import { sortStandings } from '../../game/systems/League';
import {
  ATTR_HINTS, ATTR_KEYS, ATTR_LABELS, leagueName, leaguePosition, MAX_ATTR, nextFixture, overall, PLAYING_STYLES,
  spendSkillPoint, startNextSeason, train, trainingCost, xpForLevel,
} from '../../game/systems/Career';
import type { AttrKey, Career } from '../../game/types';
import type { App } from '../app';
import { avatar, badge, bar, esc, money, toast } from '../components';
import { el } from './dom';

export function renderDashboard(app: App): HTMLElement {
  const c = app.career;
  if (!c) return el('<section class="screen"><p>Nenhuma carreira carregada.</p></section>');
  const view = el(`<section class="screen dashboard">${dashboardHtml(c)}</section>`);

  view.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-a]:not([disabled])')?.dataset.a;
    if (!a) return;
    const [cmd, arg] = a.split(':');
    const cur = app.career!;
    if (cmd === 'menu') { sfx.click(); return app.go('menu'); }
    if (cmd === 'play') { sfx.click(); return app.go('prep'); }
    if (cmd === 'point') app.commit(spendSkillPoint(cur, arg as AttrKey));
    if (cmd === 'train') {
      app.commit(train(cur, arg as AttrKey));
      toast(`Treino concluído: ${ATTR_LABELS[arg as AttrKey]} +1`);
    }
    if (cmd === 'accept' || cmd === 'stay') {
      const next = startNextSeason(cur, cmd === 'accept' ? arg : undefined);
      app.commit(next);
      toast(cmd === 'accept' ? `Contrato assinado com ${getClub(arg).name}!` : 'Você renovou com o clube para a nova temporada.');
      sfx.whistle();
    } else sfx.select();
    view.innerHTML = dashboardHtml(app.career!);
  });
  return view;
}

function dashboardHtml(c: Career): string {
  const club = getClub(c.clubId);
  const need = xpForLevel(c.level);
  const f = nextFixture(c);
  const table = sortStandings(c.standings);

  const attrs = ATTR_KEYS.map((k) => {
    const v = c.attributes[k];
    const cost = trainingCost(v);
    return `<div class="attr-row">
      <div class="attr-label"><b>${ATTR_LABELS[k]}</b><small>${ATTR_HINTS[k]}</small></div>
      ${bar(v)}<strong class="attr-val">${v}</strong>
      <div class="attr-actions">
        ${c.skillPoints > 0 ? `<button class="btn small primary" data-a="point:${k}" ${v >= MAX_ATTR ? 'disabled' : ''} aria-label="Usar ponto em ${ATTR_LABELS[k]}">+1 ponto</button>` : ''}
        <button class="btn small ghost" data-a="train:${k}" ${c.money < cost || v >= MAX_ATTR ? 'disabled' : ''} title="Sessão de treino individual">Treinar ${money(cost)}</button>
      </div></div>`;
  }).join('');

  const next = f
    ? `<div class="panel next-match">
        <h2>Próxima partida <small>${leagueName(c)} · Rodada ${f.round + 1} de ${c.schedule.length}</small></h2>
        <div class="versus">${badge(club, 56)}<span class="vs">x</span>${badge(f.opponent, 56)}</div>
        <p class="versus-names"><b>${esc(club.name)}</b> contra <b>${esc(f.opponent.name)}</b> · ${f.home ? 'em casa' : 'fora'}</p>
        <div class="objective"><span>Objetivo do clube</span><b>${esc(f.objective.text)}</b></div>
        <div class="diff"><span>Dificuldade</span>${bar(f.difficulty * 100, 100, 'heat')}</div>
        <button class="btn primary big" data-a="play">Preparar disputa</button>
      </div>`
    : seasonEnd(c);

  return `
    <header class="topbar">
      <div class="brand">PENALTY <em>CAREER</em></div>
      <p class="topbar-info">Temporada ${c.season} · ${LEAGUE_NAMES[club.tier]}</p>
      <button class="btn ghost" data-a="menu">Menu</button>
    </header>
    <div class="dash-grid">
      <div class="col">
        <div class="panel player-card" style="--club:${club.primary}">
          <div class="pc-top">${avatar(c.identity.appearance, club, c.identity.number, 112)}
            <div><p class="pc-name">${esc(c.identity.name)}</p>
            <p class="pc-meta">${esc(c.identity.nationality)} · ${c.age} anos · Camisa ${c.identity.number}${c.identity.style ? ` · ${PLAYING_STYLES[c.identity.style].name}` : ''}</p>
            <p class="pc-club">${badge(club, 22)} ${esc(club.name)}</p></div>
            <div class="ovr"><b>${overall(c.attributes)}</b><span>OVR</span></div>
          </div>
          <div class="pc-stats">
            <div><span>Nível ${c.level}</span>${bar(c.xp, need, 'xp')}<small>${c.xp} / ${need} XP</small></div>
            <div><span>Reputação</span>${bar(c.reputation, 100, 'rep')}<small>${c.reputation} / 100</small></div>
            <div class="money"><span>Saldo</span><b>${money(c.money)}</b></div>
          </div>
        </div>
        <div class="panel">
          <h2>Atributos ${c.skillPoints > 0 ? `<span class="pill">${c.skillPoints} ponto${c.skillPoints > 1 ? 's' : ''} para distribuir</span>` : ''}</h2>
          ${attrs}
        </div>
      </div>
      <div class="col">
        ${next}
        <div class="panel">
          <h2>Últimos resultados</h2>
          ${c.history.length ? `<ul class="results">${c.history.slice(0, 5).map((h) => {
            const o = getClub(h.opponentId);
            return `<li><span class="res ${h.won ? 'w' : 'l'}">${h.won ? 'V' : 'D'}</span>${badge(o, 20)}<span class="grow">${esc(o.name)}</span>
              <b>${h.scoreFor} x ${h.scoreAgainst}</b><small>${h.goals}/${h.kicks} gols${h.objectiveMet ? ' · objetivo cumprido' : ''}</small></li>`;
          }).join('')}</ul>` : '<p class="muted">Nenhuma partida disputada ainda.</p>'}
        </div>
      </div>
      <div class="col">
        <div class="panel">
          <h2>Classificação <small>${leagueName(c)}</small></h2>
          <table class="table"><thead><tr><th>#</th><th>Clube</th><th>J</th><th>V</th><th>Saldo</th><th>Pts</th></tr></thead><tbody>
          ${table.map((s, i) => {
            const cl = getClub(s.clubId);
            return `<tr class="${s.clubId === c.clubId ? 'me' : ''}"><td>${i + 1}</td><td class="club-cell">${badge(cl, 18)} ${esc(cl.short)}</td>
              <td>${s.played}</td><td>${s.won}</td><td>${s.scored - s.conceded > 0 ? '+' : ''}${s.scored - s.conceded}</td><td><b>${s.pts}</b></td></tr>`;
          }).join('')}</tbody></table>
        </div>
        <div class="panel">
          <h2>Carreira</h2>
          <div class="career-nums"><div><b>${c.matchesPlayed}</b><span>Partidas</span></div>
            <div><b>${c.history.filter((h) => h.won).length}</b><span>Vitórias recentes</span></div>
            <div><b>${c.trophies.length}</b><span>Títulos</span></div></div>
          ${c.trophies.length ? `<ul class="trophies">${c.trophies.map((t) => `<li><b>${esc(t.name)}</b> · Temporada ${t.season} · ${esc(getClub(t.clubId).short)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>
    </div>`;
}

function seasonEnd(c: Career): string {
  const pos = leaguePosition(c);
  const champion = c.trophies.some((t) => t.season === c.season);
  return `<div class="panel next-match season-end">
    <h2>Temporada ${c.season} encerrada</h2>
    <p class="season-pos">${champion ? 'Campeão da ' + esc(leagueName(c)) + '!' : `${pos}º lugar na ${esc(leagueName(c))}`}</p>
    ${c.offers.length ? '<p>Propostas recebidas:</p>' : '<p class="muted">Nenhum clube maior fez proposta. Aumente sua reputação na próxima temporada.</p>'}
    <ul class="offers">${c.offers.map((id) => {
      const o = getClub(id);
      return `<li>${badge(o, 40)}<div class="grow"><b>${esc(o.name)}</b><small>${LEAGUE_NAMES[o.tier]} · força ${Math.round(o.strength * 100)}</small></div>
        <button class="btn primary small" data-a="accept:${o.id}">Assinar</button></li>`;
    }).join('')}</ul>
    <button class="btn ghost big" data-a="stay">${c.offers.length ? 'Recusar e ficar no clube' : 'Iniciar nova temporada'}</button>
  </div>`;
}
