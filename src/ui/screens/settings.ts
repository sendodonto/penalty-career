import { isMuted, sfx } from '../../game/audio';
import type { App } from '../app';
import { el } from './dom';

export function renderSettings(app: App): HTMLElement {
  const view = el(`<section class="screen narrow">
    <header class="topbar"><button class="btn ghost" data-a="back">Voltar</button><h1>Configurações</h1></header>
    <div class="panel">
      <label class="switch-row">
        <span><b>Efeitos sonoros</b><small>Chute, trave, defesa, torcida e apito. Atalho na partida: tecla M.</small></span>
        <input type="checkbox" data-a="sound" ${isMuted() ? '' : 'checked'} />
      </label>
    </div>
    <div class="panel">
      <h2>Controles</h2>
      <dl class="controls">
        <dt>A / D ou ← / →</dt><dd>Escolher a zona do chute</dd>
        <dt>1 a 5</dt><dd>Selecionar a zona diretamente</dd>
        <dt>Clique na zona</dt><dd>Selecionar; clicar de novo confirma</dd>
        <dt>Espaço / Enter</dt><dd>Confirmar mira e parar a barra de precisão</dd>
        <dt>Esc</dt><dd>Voltar para a mira antes de chutar</dd>
        <dt>No gol</dt><dd>Espere o chute e reaja vendo a bola: A ou ← esquerda, S, ↓ ou Espaço centro, D ou → direita (ou clique no gol)</dd>
        <dt>M</dt><dd>Ligar ou desligar o som</dd>
      </dl>
    </div>
  </section>`);
  view.querySelector('[data-a="back"]')!.addEventListener('click', () => { sfx.click(); app.go('menu'); });
  view.querySelector('[data-a="sound"]')!.addEventListener('change', () => { app.toggleMute(); sfx.click(); });
  return view;
}
