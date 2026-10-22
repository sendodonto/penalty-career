import { sfx } from '../../game/audio';
import { getClub, getLeague, getTeam } from '../../game/data/clubs';
import { CATEGORIES, gearBonus, gearVisual, getItem, SHOP, SLOT_LABEL, type Category, type Equipped, type ShopItem } from '../../game/data/shop';
import { clubKit, figureMarkup } from '../../game/entities/figureArt';
import {
  ATTR_HINTS, ATTR_KEYS, ATTR_LABELS, buyItem, CALL_UP, equipped, KIND_LABEL, leagueIdOf, leagueOfSeason, MAX_ATTR, myNation, myTeamIn,
  nextFixture, overall, PLAYING_STYLES, spendSkillPoint, startNextSeason, toggleEquip, train, trainingCost, wardrobeOf, xpForLevel,
} from '../../game/systems/Career';
import { positionOf, stageLabel } from '../../game/systems/Competition';
import { sortStandings } from '../../game/systems/League';
import type { AttrKey, Career, Competition, Standing } from '../../game/types';
import type { App } from '../app';
import { badge, bar, esc, money, toast } from '../components';
import { el } from './dom';

export type HubTab = 'overview' | 'player' | 'comps' | 'shop' | 'career';
const TABS: [HubTab, string][] = [['overview', 'Visão geral'], ['player', 'Jogador'], ['comps', 'Competições'], ['shop', 'Loja'], ['career', 'Carreira']];

export function renderDashboard(app: App): HTMLElement {
  if (!app.career) return el('<section class="screen"><p>Nenhuma carreira carregada.</p></section>');
  const view = el(`<section class="screen hub">${hubHtml(app)}</section>`);

  view.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-a]:not([disabled])')?.dataset.a;
    if (!a) return;
    const [cmd, arg] = a.split(':');
    const cur = app.career!;
    if (cmd === 'menu') { sfx.click(); return app.go('menu'); }
    if (cmd === 'play') { sfx.click(); return app.go('prep'); }
    if (cmd === 'tab') app.hubTab = arg as HubTab;
    if (cmd === 'cat') app.shopCat = arg as Category;
    if (cmd === 'point') app.commit(spendSkillPoint(cur, arg as AttrKey));
    if (cmd === 'train') {
      app.commit(train(cur, arg as AttrKey));
      toast(`Treino concluído: ${ATTR_LABELS[arg as AttrKey]} +1`);
    }
    if (cmd === 'buy') {
      const r = buyItem(cur, arg);
      if (r.ok) {
        app.commit(r.career);
        toast(`Comprado e equipado: ${getItem(arg)!.name}`);
      } else toast(r.reason);
    }
    if (cmd === 'equip') app.commit(toggleEquip(cur, arg));
    if (cmd === 'sign') {
      const moving = arg !== cur.clubId;
      app.commit(startNextSeason(cur, arg));
      app.hubTab = 'overview';
      toast(moving ? `Contrato assinado com o ${getClub(arg).name}!` : 'Contrato renovado. Boa temporada!');
      sfx.whistle();
    } else sfx.select();
    view.innerHTML = hubHtml(app);
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

/** Jogador de corpo inteiro com o uniforme do clube e os itens equipados. */
function figureSvg(c: Career, eq: Equipped, cls: string, viewBox = '-42 -142 84 150'): string {
  const club = getClub(c.clubId);
  return `<svg class="${cls}" viewBox="${viewBox}" role="img" aria-label="${esc(c.identity.name)}">
    <ellipse cx="0" cy="1" rx="26" ry="4.5" fill="#000" opacity=".3"/>
    ${figureMarkup('front', c.identity.appearance, clubKit(club), { number: c.identity.number, gear: gearVisual(eq, club.primary) })}</svg>`;
}

function hubHtml(app: App): string {
  const c = app.career!;
  const club = getClub(c.clubId);
  const league = getLeague(leagueIdOf(c, club.id));
  const tab = app.hubTab;
  const body = { overview, player, comps, shop: (x: Career) => shopHtml(x, app.shopCat), career: careerTab }[tab](c);
  return `
    <header class="hub-top">
      <div class="hub-club">${badge(club, 44)}<div><b>${esc(club.name)}</b><span>${esc(league.name)} · Temporada ${c.season}</span></div></div>
      <div class="hub-chips">
        <span class="stat-chip"><small>Saldo</small><b>${money(c.money)}</b></span>
        <span class="stat-chip"><small>Reputação</small><b>${c.reputation}</b></span>
        <span class="stat-chip"><small>Nível</small><b>${c.level}</b></span>
        <span class="stat-chip accent"><small>OVR</small><b>${overall(c.attributes)}</b></span>
      </div>
      <button class="btn ghost" data-a="menu">Menu</button>
    </header>
    ${hero(c)}
    <nav class="hub-tabs" role="tablist">${TABS.map(([id, label]) => `<button role="tab" aria-selected="${id === tab}" class="${id === tab ? 'on' : ''}" data-a="tab:${id}">
      ${label}${id === 'player' && c.skillPoints ? `<span class="dot">${c.skillPoints}</span>` : ''}</button>`).join('')}</nav>
    <div class="hub-body">${body}</div>`;
}

function hero(c: Career): string {
  const f = nextFixture(c);
  const info = f
    ? `<div class="hero-info">
        <p class="hero-comp">${kindTag(f.comp)} <b>${esc(f.comp.name)}</b> · ${esc(f.stage)}</p>
        <div class="hero-versus">
          <div>${badge(f.team, 64)}<b>${esc(f.team.short)}</b></div><span class="vs">x</span><div>${badge(f.opponent, 64)}<b>${esc(f.opponent.short)}</b></div>
        </div>
        <p class="versus-names"><b>${esc(f.team.name)}</b> contra <b>${esc(f.opponent.name)}</b>${f.comp.kind === 'national' ? ' · pela seleção' : f.home ? ' · em casa' : ' · fora'}</p>
        <div class="objective"><span>Objetivo</span><b>${esc(f.objective.text)}</b></div>
        <button class="btn primary big" data-a="play">Jogar</button>
      </div>`
    : seasonEnd(c);
  return `<section class="panel hub-hero">
    <div class="hero-stage">${figureSvg(c, equipped(c), 'hero-figure')}
      <p class="hero-name"><b>${esc(c.identity.name)}</b><span>${esc(c.identity.nationality)} · ${c.age} anos · Camisa ${c.identity.number}</span></p></div>
    ${info}
  </section>`;
}

function seasonEnd(c: Career): string {
  return `<div class="hero-info season-end">
    <p class="hero-comp"><b>Temporada ${c.season} encerrada</b> · janela de transferências aberta</p>
    <ul class="offers">${c.offers.map((o) => {
      const cl = getClub(o.clubId);
      return `<li class="${o.renewal ? 'renewal' : ''}">${badge(cl, 40)}<div class="grow"><b>${esc(cl.name)}</b>
        <small>${esc(getLeague(leagueIdOf(c, cl.id)).name)} · ${money(o.salary)} por jogo · ${o.seasons} temporada${o.seasons > 1 ? 's' : ''}</small></div>
        <button class="btn ${o.renewal ? 'ghost' : 'primary'} small" data-a="sign:${o.clubId}">${o.renewal ? 'Renovar' : 'Assinar'}</button></li>`;
    }).join('')}</ul>
    ${c.offers.length < 2 ? '<p class="muted">Nenhum clube maior fez proposta. Ganhe reputação com vitórias, objetivos e títulos.</p>' : ''}
  </div>`;
}

function overview(c: Career): string {
  const f = nextFixture(c);
  const upcoming = c.calendar.slice(f ? 1 : 0, 9).map((id) => c.comps.find((x) => x.id === id)!);
  return `<div class="hub-grid">
    <div class="panel">
      <h2>${f ? `Temporada ${c.season}` : 'Resumo da temporada'}</h2>
      <ul class="comp-list">${c.comps.map((comp) => `<li>${kindTag(comp)}<div class="grow"><b>${esc(comp.name)}</b><small>${esc(compStatus(c, comp))}</small></div></li>`).join('')}</ul>
      ${upcoming.length ? `<p class="cal-title">Próximos jogos</p><div class="calendar">${upcoming.map((comp) => `<span class="comp-tag ${comp.kind}">${esc(comp.name)}</span>`).join('')}</div>` : ''}
      ${!c.calledUp ? `<p class="muted small-note">Seleção (${esc(myNation(c).name)}): convocação com overall ${CALL_UP.overall} ou reputação ${CALL_UP.reputation}. Copa do Mundo a cada 4 temporadas.</p>` : ''}
    </div>
    <div class="panel">
      <h2>Notícias</h2>
      <ul class="news">${c.news.slice(0, 6).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    </div>
    <div class="panel span-2">
      <h2>Últimos resultados</h2>
      ${c.history.length ? `<ul class="results">${c.history.slice(0, 5).map((h) => {
        const o = getTeam(h.opponentId);
        return `<li><span class="res ${h.won ? 'w' : 'l'}">${h.won ? 'V' : 'D'}</span>${badge(o, 20)}<span class="grow">${esc(o.name)}</span>
          <b>${h.scoreFor} x ${h.scoreAgainst}</b><small>${esc(h.comp)} · ${esc(h.stage)} · ${h.goals}/${h.kicks} gols</small></li>`;
      }).join('')}</ul>` : '<p class="muted">Nenhuma partida disputada ainda.</p>'}
    </div>
  </div>`;
}

function player(c: Career): string {
  const need = xpForLevel(c.level);
  const bonus = gearBonus(equipped(c));
  const attrs = ATTR_KEYS.map((k) => {
    const v = c.attributes[k];
    const cost = trainingCost(v);
    return `<div class="attr-row">
      <div class="attr-label"><b>${ATTR_LABELS[k]}${bonus[k] ? ` <em class="gear-bonus">+${bonus[k]} item</em>` : ''}</b><small>${ATTR_HINTS[k]}</small></div>
      ${bar(v)}<strong class="attr-val">${v}</strong>
      <div class="attr-actions">
        ${c.skillPoints > 0 ? `<button class="btn small primary" data-a="point:${k}" ${v >= MAX_ATTR ? 'disabled' : ''} aria-label="Usar ponto em ${ATTR_LABELS[k]}">+1 ponto</button>` : ''}
        <button class="btn small ghost" data-a="train:${k}" ${c.money < cost || v >= MAX_ATTR ? 'disabled' : ''} title="Sessão de treino individual">Treinar ${money(cost)}</button>
      </div></div>`;
  }).join('');
  return `<div class="hub-grid">
    <div class="panel">
      <h2>Atributos ${c.skillPoints > 0 ? `<span class="pill">${c.skillPoints} ponto${c.skillPoints > 1 ? 's' : ''} para distribuir</span>` : ''}</h2>
      ${attrs}
    </div>
    <div class="panel">
      <h2>Perfil</h2>
      <div class="pc-stats">
        <div><span>Nível ${c.level}</span>${bar(c.xp, need, 'xp')}<small>${c.xp} / ${need} XP</small></div>
        <div><span>Reputação</span>${bar(c.reputation, 100, 'rep')}<small>${c.reputation} / 100</small></div>
      </div>
      <dl class="facts">
        <dt>Estilo</dt><dd>${c.identity.style ? PLAYING_STYLES[c.identity.style].name : '—'}</dd>
        <dt>Contrato</dt><dd>${money(c.contract.salary)} por jogo · até a temporada ${c.contract.until}</dd>
        <dt>Seleção</dt><dd>${esc(myNation(c).name)} · ${c.stats.caps} jogos</dd>
        <dt>Itens</dt><dd>${Object.values(equipped(c)).map((id) => esc(getItem(id)?.name ?? '')).join(', ') || 'Nenhum: visite a Loja'}</dd>
      </dl>
    </div>
  </div>`;
}

function table(rows: Standing[], me: string): string {
  return `<table class="table"><thead><tr><th>#</th><th>Time</th><th>J</th><th>V</th><th>Saldo</th><th>Pts</th></tr></thead><tbody>
    ${sortStandings(rows).map((s, i) => {
      const t = getTeam(s.clubId);
      return `<tr class="${s.clubId === me ? 'me' : ''}"><td>${i + 1}</td><td class="club-cell">${badge(t, 18)} ${esc(t.short)}</td>
        <td>${s.played}</td><td>${s.won}</td><td>${s.scored - s.conceded > 0 ? '+' : ''}${s.scored - s.conceded}</td><td><b>${s.pts}</b></td></tr>`;
    }).join('')}</tbody></table>`;
}

function comps(c: Career): string {
  const lg = leagueOfSeason(c);
  const league = getLeague(leagueIdOf(c, c.clubId));
  const cups = c.comps.filter((x) => x.kind !== 'league').map((comp) => {
    const me = myTeamIn(c, comp);
    let detail: string;
    if (comp.format === 'groups') {
      detail = comp.groups.map((g, i) => `<p class="cal-title">Grupo ${'ABCD'[i]}</p>${table(comp.standings.filter((s) => g.includes(s.clubId)), me)}`).join('');
    } else if (comp.champion) {
      detail = `<p class="champion">${badge(getTeam(comp.champion), 28)} <b>${esc(getTeam(comp.champion).name)}</b> campeão</p>`;
    } else {
      const pairs = [];
      for (let i = 0; i < comp.bracket.length; i += 2) pairs.push([comp.bracket[i], comp.bracket[i + 1]]);
      detail = `<p class="cal-title">${esc(stageLabel(comp))}</p><ul class="ties">${pairs.map(([a, b]) => `<li class="${a === me || b === me ? 'me' : ''}">
        ${badge(getTeam(a), 20)}<span>${esc(getTeam(a).short)}</span><em>x</em><span>${esc(getTeam(b).short)}</span>${badge(getTeam(b), 20)}</li>`).join('')}</ul>`;
    }
    return `<div class="panel"><h2>${kindTag(comp)} ${esc(comp.name)}</h2><p class="muted">${esc(compStatus(c, comp))}</p>${detail}</div>`;
  }).join('');
  return `<div class="hub-grid">
    <div class="panel">
      <h2>${kindTag(lg)} ${esc(lg.name)}</h2>
      ${table(lg.standings, c.clubId)}
      ${league.id === 'br-b' ? '<p class="muted small-note">Os 2 primeiros sobem para a Série A.</p>' : league.tier >= 2 ? '<p class="muted small-note">Os 2 primeiros vão ao torneio continental.</p>' : ''}
    </div>
    <div class="stack">${cups}</div>
  </div>`;
}

/** Recorte do boneco onde o item aparece, para a vitrine. */
const PREVIEW_BOX: Record<string, string> = {
  boots: '-22 -26 44 34', socks: '-22 -34 44 40', sleeves: '-34 -104 68 64', wrist: '-34 -78 68 40', gloves: '-34 -74 68 38',
  armband: '-34 -104 68 40', headband: '-24 -140 48 40', necklace: '-24 -126 48 40', celebration: '-42 -142 84 150',
};

function shopHtml(c: Career, cat: Category): string {
  const w = wardrobeOf(c);
  const eq = equipped(c);
  const items = SHOP.filter((x) => x.category === cat);
  const card = (item: ShopItem) => {
    const owned = w.owned.includes(item.id);
    const on = eq[item.slot] === item.id;
    const locked = (item.minRep ?? 0) > c.reputation;
    const preview = item.slot === 'celebration' ? '' : figureSvg(c, { ...eq, [item.slot]: item.id }, 'item-preview', PREVIEW_BOX[item.slot]);
    const action = owned
      ? `<button class="btn small ${on ? 'ghost' : 'primary'}" data-a="equip:${item.id}">${on ? 'Tirar' : 'Usar'}</button>`
      : item.raid ? '<button class="btn small" disabled>Raid</button>'
      : `<button class="btn small primary" data-a="buy:${item.id}" ${locked || c.money < item.price ? 'disabled' : ''}>${money(item.price)}</button>`;
    return `<li class="shop-item ${on ? 'on' : ''} ${item.raid ? 'raid-item' : ''}">
      <div class="item-art">${preview || `<span class="cel-name">${esc(item.name)}</span>`}</div>
      <div class="item-info"><b>${esc(item.name)}</b><small>${esc(item.desc)}</small>
        ${item.bonus ? `<em class="gear-bonus">${Object.entries(item.bonus).map(([k, v]) => `+${v} ${ATTR_LABELS[k as AttrKey]}`).join(' · ')}</em>` : ''}
        ${item.raid && !owned ? '<em class="lock">Exclusivo de raid</em>' : locked ? `<em class="lock">Reputação ${item.minRep} necessária</em>`
          : on ? '<em class="in-use">Em uso</em>' : owned ? `<em class="owned">${item.raid ? 'Ganho no raid' : 'Comprado'}</em>` : ''}
      </div>
      <div class="item-buy">${action}</div>
    </li>`;
  };
  return `<div class="shop">
    <aside class="panel shop-fitting">
      ${figureSvg(c, eq, 'fitting-figure')}
      <p class="muted">Saldo: <b>${money(c.money)}</b></p>
      <ul class="equipped-list">${Object.entries(eq).map(([slot, id]) => `<li><span>${SLOT_LABEL[slot as keyof typeof SLOT_LABEL]}</span><b>${esc(getItem(id)?.name ?? '')}</b></li>`).join('') || '<li class="muted">Nada equipado ainda.</li>'}</ul>
    </aside>
    <div class="panel shop-shelf">
      <div class="chips">${CATEGORIES.map((x) => `<button class="chip ${x === cat ? 'on' : ''}" data-a="cat:${x}">${x}</button>`).join('')}</div>
      <ul class="shop-items">${items.map(card).join('')}</ul>
      <p class="muted small-note">Itens aparecem no seu jogador durante as partidas. Chuteiras raras dão um pequeno bônus de atributo. Itens de raid só se ganham nas partidas contra outras espécies.</p>
    </div>
  </div>`;
}

function careerTab(c: Career): string {
  const conversion = c.stats.kicks ? Math.round((c.stats.goals / c.stats.kicks) * 100) : 0;
  return `<div class="hub-grid">
    <div class="panel">
      <h2>Números</h2>
      <div class="career-nums">
        <div><b>${c.matchesPlayed}</b><span>Partidas</span></div>
        <div><b>${c.stats.goals}</b><span>Gols (${conversion}%)</span></div>
        <div><b>${c.stats.saves}</b><span>Defesas</span></div>
        <div><b>${c.stats.caps}</b><span>Pela seleção</span></div>
        <div><b>${c.trophies.length}</b><span>Títulos</span></div>
        <div><b>${c.season}</b><span>Temporadas</span></div>
      </div>
    </div>
    <div class="panel">
      <h2>Sala de troféus</h2>
      ${c.trophies.length ? `<ul class="trophies">${[...c.trophies].reverse().map((t) => `<li><b>${esc(t.name)}</b> · Temporada ${t.season} · ${esc(getTeam(t.clubId).short)}</li>`).join('')}</ul>` : '<p class="muted">Nenhum título ainda. O primeiro está a uma disputa de distância.</p>'}
    </div>
    <div class="panel span-2">
      <h2>Histórico</h2>
      ${c.history.length ? `<ul class="results">${c.history.slice(0, 15).map((h) => {
        const o = getTeam(h.opponentId);
        return `<li><span class="res ${h.won ? 'w' : 'l'}">${h.won ? 'V' : 'D'}</span>${badge(o, 20)}<span class="grow">${esc(o.name)}</span>
          <b>${h.scoreFor} x ${h.scoreAgainst}</b><small>Temporada ${h.season} · ${esc(h.comp)} · ${esc(h.stage)}</small></li>`;
      }).join('')}</ul>` : '<p class="muted">Nenhuma partida disputada ainda.</p>'}
    </div>
  </div>`;
}
