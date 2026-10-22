import Phaser from 'phaser';
import { isMuted, setMuted, sfx } from '../game/audio';
import { PenaltyScene, type Hud, type PenaltySceneData } from '../game/scenes/PenaltyScene';
import { CLUBS, getClub } from '../game/data/clubs';
import { gearVisual, type Category } from '../game/data/shop';
import { EARTH, getSpecial, type SpecialId } from '../game/data/specials';
import { applyMatch, applyRaid, effectiveAttributes, equipped, matchSetup, nextFixture, pickWeather, type Fixture, type Rewards } from '../game/systems/Career';
import { Match } from '../game/systems/MatchManager';
import { keeperFromRating } from '../game/systems/PenaltyResolver';
import { loadCareer, saveCareer, saveSettings, type LoadResult } from '../game/systems/SaveManager';
import { IS_TOUCH } from '../game/device';
import type { Career, MatchStats, Team, Weather } from '../game/types';
import { badge, esc, toast } from './components';
import { renderCreate } from './screens/create';
import { renderDashboard, type HubTab } from './screens/dashboard';
import { renderMenu } from './screens/menu';
import { renderPrep } from './screens/prep';
import { renderResult } from './screens/result';
import { renderSettings } from './screens/settings';

export type ScreenName = 'menu' | 'create' | 'dashboard' | 'prep' | 'result' | 'settings';

/** Resultado da última partida para a tela de resultado (time do jogador: clube, seleção ou Terra num raid). */
export interface LastResult { stats: MatchStats; rewards: Rewards; team: Team; opponent: Team; comp: string; stage: string; career: Career; raid?: boolean }

export class App {
  career: Career | null = null;
  saveState: LoadResult;
  lastResult: LastResult | null = null;
  /** Aba aberta no painel da carreira e categoria da loja */
  hubTab: HubTab = 'overview';
  shopCat: Category = 'Chuteiras';
  private game: Phaser.Game | null = null;
  /** Disputa da carreira suspensa enquanto o jogador está num raid */
  private paused: PenaltySceneData | null = null;
  private screenEl: HTMLElement;
  private stageEl: HTMLElement;
  private hudEl: HTMLElement;

  constructor(root: HTMLElement) {
    root.innerHTML = `<main id="screen"></main>
      <section id="stage" hidden><div class="stage-frame"><div id="canvas"></div><div id="hud"></div></div></section>`;
    this.screenEl = root.querySelector('#screen')!;
    this.stageEl = root.querySelector('#stage')!;
    this.hudEl = root.querySelector('#hud')!;
    this.saveState = loadCareer();
    if (this.saveState.status === 'ok') this.career = this.saveState.career;
    addEventListener('resize', () => !this.stageEl.hidden && this.syncLayout());
  }

  /** Tela em pé usa a proporção exata da tela (câmera fechada no lance); deitada, 16:9. */
  private gameSize(): [number, number] {
    if (innerHeight <= innerWidth) return [1920, 1080];
    return [1080, Math.round(1080 * Math.min(2.4, innerHeight / innerWidth))];
  }

  private syncLayout(): void {
    const [w, h] = this.gameSize();
    this.stageEl.classList.toggle('portrait', h > w);
    if (!this.game) return;
    if (this.game.scale.width !== w || this.game.scale.height !== h) this.game.scale.setGameSize(w, h);
    // O contêiner pode ter mudado de proporção ou estado oculto: relê antes de reescalar.
    this.game.scale.getParentBounds();
    this.game.scale.refresh();
  }

  go(name: ScreenName): void {
    const render = { menu: renderMenu, create: renderCreate, dashboard: renderDashboard, prep: renderPrep, result: renderResult, settings: renderSettings }[name];
    this.screenEl.hidden = false;
    if (name === 'menu') this.startDemo();
    else {
      this.stageEl.hidden = true;
      this.game?.scene.stop('penalty');
    }
    this.screenEl.replaceChildren(render(this));
    this.screenEl.firstElementChild?.classList.add('enter');
    window.scrollTo(0, 0);
  }

  /** Única porta de escrita do estado da carreira: sempre salva. */
  commit(c: Career): void {
    this.career = c;
    if (!saveCareer(c)) toast('Não foi possível salvar no navegador. O progresso vale só nesta sessão.');
    this.saveState = { status: 'ok', career: c };
  }

  toggleMute(): void {
    setMuted(!isMuted());
    saveSettings({ muted: isMuted() });
    this.hudEl.querySelector('[data-mute]')?.replaceChildren(isMuted() ? 'Som: desligado' : 'Som: ligado');
  }

  startMatch(): void {
    const c = this.career;
    const fixture = c && nextFixture(c);
    if (!c || !fixture) return this.go('dashboard');
    // Só em desenvolvimento: window.__forceWeather = 'rain' força o clima (testes visuais).
    const forcedWeather = import.meta.env.DEV ? (window as unknown as { __forceWeather?: Weather }).__forceWeather : undefined;
    const match = new Match(matchSetup(c, fixture, forcedWeather ?? pickWeather(c, fixture)));
    this.screenEl.hidden = true;
    this.renderHudShell(match);

    const data: PenaltySceneData = {
      match,
      player: {
        name: c.identity.name, number: c.identity.number, appearance: c.identity.appearance,
        gear: gearVisual(equipped(c), fixture.team.primary), celebration: equipped(c).celebration,
      },
      hud: this.hud(),
      onFinish: (stats) => this.finishMatch(stats, fixture),
      onRaid: (id) => this.startRaid(id, data),
    };
    this.runScene(data, false);
  }

  /** Raid: suspende a disputa (o objeto Match guarda o placar) e abre a partida contra a outra espécie. */
  private startRaid(id: SpecialId, paused: PenaltySceneData): void {
    const sp = getSpecial(id)!;
    this.paused = paused;
    const match = new Match({
      club: EARTH, opponent: sp.team, attrs: effectiveAttributes(this.career!), difficulty: 0.62,
      oppSkill: sp.team.strength, oppKeeper: keeperFromRating(sp.team.keeper), ownKeeper: keeperFromRating(EARTH.keeper),
      objective: { id: 'win', text: `Vença e volte para a Terra · ${sp.place}` }, weather: 'clear',
    });
    this.renderHudShell(match);
    this.runScene({
      match, player: paused.player, hud: this.hud(), special: id, noIncidents: true,
      onFinish: (stats) => {
        this.game?.scene.stop('penalty');
        const { career, rewards } = applyRaid(this.career!, stats, id);
        this.commit(career);
        this.lastResult = { stats, rewards, team: EARTH, opponent: sp.team, comp: sp.title.replace('!', ''), stage: sp.place, career, raid: true };
        sfx.transition();
        this.go('result');
      },
    }, false);
  }

  /** Volta à Terra: retoma a disputa da carreira de onde parou, sem novos imprevistos. */
  resumeMatch(): void {
    const data = this.paused;
    this.paused = null;
    if (!data) return this.go('dashboard');
    this.screenEl.hidden = true;
    this.renderHudShell(data.match);
    this.runScene({ ...data, hud: this.hud(), noIncidents: true }, false);
  }

  /** Partida de demonstração atrás do menu: clube da carreira (se houver) contra um rival qualquer. */
  private startDemo(): void {
    const c = this.career;
    const pick = () => CLUBS[Math.floor(Math.random() * CLUBS.length)];
    const club = c ? getClub(c.clubId) : pick();
    let opponent = pick();
    while (opponent.id === club.id) opponent = pick();
    const keeper = keeperFromRating(0.6);
    const match = new Match({
      club, opponent, attrs: { precision: 72, power: 72, curve: 72, composure: 72 },
      difficulty: 0.4, oppSkill: 0.7, oppKeeper: keeper, ownKeeper: keeper, objective: { id: 'win', text: '' },
      weather: (['clear', 'clear', 'clear', 'rain', 'snow', 'fog'] as const)[Math.floor(Math.random() * 6)],
    });
    const r = (n: number) => Math.floor(Math.random() * n);
    this.runScene({
      match,
      player: { name: c?.identity.name ?? 'Craque', number: c?.identity.number ?? 10, appearance: c?.identity.appearance ?? { skin: r(4), hair: r(4), hairColor: r(4) } },
      hud: { update() {}, hint() {}, toggleMute() {} },
      onFinish: () => !this.stageEl.hidden && this.stageEl.classList.contains('as-bg') && this.startDemo(),
      demo: true,
    }, true);
  }

  private runScene(data: PenaltySceneData, background: boolean): void {
    this.stageEl.hidden = false;
    this.stageEl.classList.toggle('as-bg', background);
    this.syncLayout();
    if (!this.game) {
      const [width, height] = this.gameSize();
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'canvas',
        width,
        height,
        backgroundColor: '#0b0f14',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { antialias: true },
        scene: [],
      });
      this.game.scene.add('penalty', PenaltyScene, true, data);
    } else {
      this.game.scene.start('penalty', data);
    }
  }

  private finishMatch(stats: MatchStats, f: Fixture): void {
    this.game?.scene.stop('penalty');
    const { career, rewards } = applyMatch(this.career!, stats);
    this.commit(career);
    this.lastResult = { stats, rewards, team: f.team, opponent: f.opponent, comp: f.comp.name, stage: f.stage, career };
    sfx.transition();
    this.go('result');
  }

  private renderHudShell(match: Match): void {
    const { club, opponent, objective } = match.setup;
    const side = (cl: typeof club, key: 'a' | 'b') => `<div class="sb-team sb-${key}">
        ${badge(cl, 34)}<div class="sb-name"><b>${esc(cl.short)}</b><span>${esc(cl.name)}</span></div>
        <ol class="sb-dots" data-dots="${key}"></ol><strong class="sb-score" data-score="${key}">0</strong></div>`;
    this.hudEl.innerHTML = `<div class="scoreboard">${side(club, 'a')}<div class="sb-mid" data-phase>Cobranças</div>${side(opponent, 'b')}</div>
      <div class="hud-objective">Objetivo: ${esc(objective.text)}</div>
      <p class="hud-hint" data-hint></p>
      <div class="hud-tools">
        ${IS_TOUCH && document.fullscreenEnabled ? '<button class="hud-btn" data-full>Tela cheia</button>' : ''}
        <button class="hud-btn" data-mute>${isMuted() ? 'Som: desligado' : 'Som: ligado'}</button>
      </div>`;
    const btn = this.hudEl.querySelector<HTMLButtonElement>('[data-mute]')!;
    btn.addEventListener('click', () => { this.toggleMute(); btn.blur(); });
    this.hudEl.querySelector('[data-full]')?.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else {
          await document.documentElement.requestFullscreen();
        }
      } catch { /* recusado pelo navegador: segue sem tela cheia */ }
    });
  }

  private hud(): Hud {
    const q = <T extends HTMLElement>(s: string) => this.hudEl.querySelector<T>(s)!;
    return {
      update: (m) => {
        const s = m.shootout;
        for (const key of ['a', 'b'] as const) {
          const kicks = s[key];
          const slots = Math.max(s.regulation, kicks.length + (s.next === key && !s.winner() ? 1 : 0));
          q(`[data-dots="${key}"]`).innerHTML = Array.from({ length: slots }, (_, i) =>
            `<li class="${i < kicks.length ? (kicks[i] ? 'hit' : 'miss') : ''}${i === kicks.length && s.next === key && !s.winner() ? ' now' : ''}"></li>`).join('');
          q(`[data-score="${key}"]`).textContent = String(s.goals(key));
        }
        q('[data-phase]').textContent = s.winner() ? 'Fim' : s.suddenDeath ? 'Alternadas' : `Cobrança ${Math.min(s.regulation, s[s.next].length + 1)} de ${s.regulation}`;
      },
      hint: (t) => { q('[data-hint]').textContent = t; },
      toggleMute: () => this.toggleMute(),
    };
  }
}
