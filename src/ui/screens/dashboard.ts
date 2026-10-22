import { sfx } from '../../game/audio';
import { getClub, getLeague, getTeam } from '../../game/data/clubs';
import {
  ATTR_HINTS, ATTR_KEYS, ATTR_LABELS, CALL_UP, KIND_LABEL, leagueIdOf, leagueOfSeason, MAX_ATTR, myNation, myTeamIn, nextFixture,
  overall, PLAYING_STYLES, spendSkillPoint, startNextSeason, train, trainingCost, xpForLevel,
} from '../../game/systems/Career';
import { positionOf, stageLabel } from '../../game/systems/Competition';
import { sortStandings } from '../../game/systems/League';
import type { AttrKey, Career, Competition } from '../../game/types';
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
    if (cmd === 'sign') {
      const moving = arg !== cur.clubId;
      app.commit(startNextSeason(cur, arg));
      toast(moving ? `Contrato assinado com o ${getClub(arg).name}!` : 'Contrato renovado. Boa temporada!');
      sfx.whistle();
    } else sfx.select();
    view.innerHTML = dashboardHtml(app.career!);
  });
  return view;
}

/** Situação do jogador numa competição, em uma linha. */
export function compStatus(c: Career, comp: Competition): string {
  const me = myTeamIn(c, comp);
  if (comp.kind === 'national' && !c.calledUp) return comp.champion ? `Campeão: ${getTeam(comp.champion).name} · você não foi convocado` : 'Você não foi convocado';
  if (comp.champion === me) return 'Campeão!';
  if (comp.exit) return `Eliminado · ${comp.exit}`;
  if (comp.format === 'league' && comp.round === 0) return `${comp.schedule.length} rodadas · começa agora`;
  if (comp.format === 'league') return `${positionOf(comp, me)}º lugar${comp.champion ? ' · final' : ` · rodada ${comp.round} de ${comp.schedule.length}`}`;
  if (comp.format === 'groups') return comp.round === 0 ? 'Fase de grupos · 3 jogos' : `${positionOf(comp, me)}º no grupo`;
  return comp.champion ? `Campeão: ${getTeam(comp.champion).name}` : `Vivo · ${stageLabel(comp)}`;
}

const kindTag = (comp: Competition) => `<span class="comp-tag ${comp.kind}">${KIND_LABEL[comp.kind]}</span>`;

function dashboardHtml(c: Career): string {
  const club = getClub(c.clubId);
  const league = getLeague(leagueIdOf(c, club.id));
  const need = xpForLevel(c.level);
  const f = nextFixture(c);
  const lg = leagueOfSeason(c);
  const conversion = c.stats.kicks ? Math.round((c.stats.goals / c.stats.kicks) * 100) : 0;

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
        <h2>Próxima partida ${kindTag(f.comp)}</h2>
        <p class="comp-line"><b>${esc(f.comp.name)}</b> · ${esc(f.stage)}</p>
        <div class="versus">${badge(f.team, 56)}<span class="vs">x</span>${badge(f.opponent, 56)}</div>
        <p class="versus-names"><b>${esc(f.team.name)}</b> contra <b>${esc(f.opponent.name)}</b>${f.comp.kind === 'national' ? ' · pela seleção' : f.home ? ' · em casa' : ' · fora'}</p>
        <div class="objective"><span>Objetivo</span><b>${esc(f.objective.text)}</b></div>
        <div class="diff"><span>Dificuldade</span>${bar(f.difficulty * 100, 100, 'heat')}</div>
        <button class="btn primary big" data-a="play">Preparar disputa</button>
      </div>`
    : seasonEnd(c);

  const upcoming = c.calendar.slice(f ? 1 : 0, 9).map((id) => c.comps.find((x) => x.id === id)!);

  return `
    <header class="topbar">
      <div class="brand">PENALTY <em>CAREER</em></div>
      <p class="topbar-info">Temporada ${c.season} · ${esc(league.name)}</p>
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
          <p class="contract">Contrato: <b>${money(c.contract.salary)}</b> por jogo · até a temporada ${c.contract.until}</p>
        </div>
        <div class="panel">
          <h2>Atributos ${c.skillPoints > 0 ? `<span class="pill">${c.skillPoints} ponto${c.skillPoints > 1 ? 's' : ''} para distribuir</span>` : ''}</h2>
          ${attrs}
        </div>
      </div>
      <div class="col">
        ${next}
        ${f ? `<div class="panel">
          <h2>Temporada ${c.season}</h2>
          <ul class="comp-list">${c.comps.map((comp) => `<li>${kindTag(comp)}<div class="grow"><b>${esc(comp.name)}</b><small>${esc(compStatus(c, comp))}</small></div></li>`).join('')}</ul>
          ${upcoming.length ? `<p class="cal-title">Depois desta</p><div class="calendar">${upcoming.map((comp) => `<span class="comp-tag ${comp.kind}" title="${esc(comp.name)}">${esc(comp.name)}</span>`).join('')}</div>` : ''}
          ${!c.calledUp ? `<p class="muted small-note">Seleção (${esc(myNation(c).name)}): convocação com overall ${CALL_UP.overall} ou reputação ${CALL_UP.reputation}. Copa do Mundo a cada 4 temporadas.</p>` : ''}
        </div>` : ''}
        <div class="panel">
          <h2>Últimos resultados</h2>
          ${c.history.length ? `<ul class="results">${c.history.slice(0, 6).map((h) => {
            const o = getTeam(h.opponentId);
            return `<li><span class="res ${h.won ? 'w' : 'l'}">${h.won ? 'V' : 'D'}</span>${badge(o, 20)}<span class="grow">${esc(o.name)}</span>
              <b>${h.scoreFor} x ${h.scoreAgainst}</b><small>${esc(h.comp)} · ${esc(h.stage)} · ${h.goals}/${h.kicks} gols</small></li>`;
          }).join('')}</ul>` : '<p class="muted">Nenhuma partida disputada ainda.</p>'}
        </div>
      </div>
      <div class="col">
        <div class="panel">
          <h2>Classificação <small>${esc(lg.name)}</small></h2>
          <table class="table"><thead><tr><th>#</th><th>Clube</th><th>J</th><th>V</th><th>Saldo</th><th>Pts</th></tr></thead><tbody>
          ${sortStandings(lg.standings).map((s, i) => {
            const cl = getTeam(s.clubId);
            return `<tr class="${s.clubId === c.clubId ? 'me' : ''}"><td>${i + 1}</td><td class="club-cell">${badge(cl, 18)} ${esc(cl.short)}</td>
              <td>${s.played}</td><td>${s.won}</td><td>${s.scored - s.conceded > 0 ? '+' : ''}${s.scored - s.conceded}</td><td><b>${s.pts}</b></td></tr>`;
          }).join('')}</tbody></table>
          ${league.id === 'br-b' ? '<p class="muted small-note">Os 2 primeiros sobem para a Série A.</p>' : league.tier >= 2 ? '<p class="muted small-note">Os 2 primeiros vão ao torneio continental.</p>' : ''}
        </div>
        <div class="panel">
          <h2>Notícias</h2>
          <ul class="news">${c.news.slice(0, 6).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        </div>
        <div class="panel">
          <h2>Carreira</h2>
          <div class="career-nums">
            <div><b>${c.matchesPlayed}</b><span>Partidas</span></div>
            <div><b>${c.stats.goals}</b><span>Gols (${conversion}%)</span></div>
            <div><b>${c.stats.saves}</b><span>Defesas</span></div>
            <div><b>${c.stats.caps}</b><span>Pela seleção</span></div>
            <div><b>${c.trophies.length}</b><span>Títulos</span></div>
            <div><b>${c.season}</b><span>Temporadas</span></div>
          </div>
          ${c.trophies.length ? `<ul class="trophies">${[...c.trophies].reverse().map((t) => `<li><b>${esc(t.name)}</b> · Temporada ${t.season} · ${esc(getTeam(t.clubId).short)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>
    </div>`;
}

function seasonEnd(c: Career): string {
  return `<div class="panel next-match season-end">
    <h2>Temporada ${c.season} encerrada</h2>
    <ul class="comp-list">${c.comps.map((comp) => `<li>${kindTag(comp)}<div class="grow"><b>${esc(comp.name)}</b><small>${esc(compStatus(c, comp))}</small></div></li>`).join('')}</ul>
    <h3>Janela de transferências</h3>
    <ul class="offers">${c.offers.map((o) => {
      const cl = getClub(o.clubId);
      return `<li class="${o.renewal ? 'renewal' : ''}">${badge(cl, 40)}<div class="grow"><b>${esc(cl.name)}</b>
        <small>${esc(getLeague(leagueIdOf(c, cl.id)).name)} · ${money(o.salary)} por jogo · ${o.seasons} temporada${o.seasons > 1 ? 's' : ''}</small></div>
        <button class="btn ${o.renewal ? 'ghost' : 'primary'} small" data-a="sign:${o.clubId}">${o.renewal ? 'Renovar' : 'Assinar'}</button></li>`;
    }).join('')}</ul>
    ${c.offers.length < 2 ? '<p class="muted">Nenhum clube maior fez proposta. Ganhe reputação com vitórias, objetivos e títulos.</p>' : ''}
  </div>`;
}
