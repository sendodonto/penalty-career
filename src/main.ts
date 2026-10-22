import { setMuted } from './game/audio';
import { loadSettings } from './game/systems/SaveManager';
import './styles/main.css';
import { App } from './ui/app';

setMuted(loadSettings().muted);
new App(document.getElementById('app')!).go('menu');
