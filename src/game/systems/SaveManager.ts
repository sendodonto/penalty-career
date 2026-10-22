import { CLUBS } from '../data/clubs';
import type { Career } from '../types';
import { ATTR_KEYS } from './Career';

export const SAVE_VERSION = 1;
const SAVE_KEY = 'penalty-career/save';
const SETTINGS_KEY = 'penalty-career/settings';

export type LoadResult =
  | { status: 'none' }
  | { status: 'ok'; career: Career }
  | { status: 'corrupt'; reason: string };

interface SaveFile { saveVersion: number; savedAt: string; career: Career }

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Valida o formato antes de confiar no salvamento (dados vindos do navegador podem estar adulterados). */
export function validateCareer(c: any): string | null {
  if (!c || typeof c !== 'object') return 'carreira ausente';
  const id = c.identity;
  if (!id || typeof id.name !== 'string' || typeof id.nationality !== 'string' || !isNum(id.number)) return 'identidade inválida';
  if (!id.appearance || !isNum(id.appearance.skin) || !isNum(id.appearance.hair) || !isNum(id.appearance.hairColor)) return 'aparência inválida';
  if (!CLUBS.some((cl) => cl.id === c.clubId)) return 'clube desconhecido';
  if (!c.attributes || !ATTR_KEYS.every((k) => isNum(c.attributes[k]))) return 'atributos inválidos';
  for (const k of ['age', 'level', 'xp', 'skillPoints', 'money', 'reputation', 'season', 'round', 'matchesPlayed']) {
    if (!isNum(c[k])) return `campo ${k} inválido`;
  }
  if (!Array.isArray(c.schedule) || !Array.isArray(c.standings) || !Array.isArray(c.history) || !Array.isArray(c.trophies) || !Array.isArray(c.offers)) {
    return 'listas inválidas';
  }
  if (c.round < 0 || c.round > c.schedule.length) return 'rodada fora do calendário';
  return null;
}

export function loadCareer(storage: Storage = localStorage): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { status: 'none' };
  }
  if (!raw) return { status: 'none' };
  try {
    const file = JSON.parse(raw) as SaveFile;
    if (file.saveVersion !== SAVE_VERSION) return { status: 'corrupt', reason: `versão ${file.saveVersion} incompatível` };
    const err = validateCareer(file.career);
    return err ? { status: 'corrupt', reason: err } : { status: 'ok', career: file.career };
  } catch {
    return { status: 'corrupt', reason: 'arquivo ilegível' };
  }
}

export function saveCareer(career: Career, storage: Storage = localStorage): boolean {
  const file: SaveFile = { saveVersion: SAVE_VERSION, savedAt: new Date().toISOString(), career };
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

export function deleteCareer(storage: Storage = localStorage): void {
  try { storage.removeItem(SAVE_KEY); } catch { /* armazenamento bloqueado: nada a apagar */ }
}

export interface Settings { muted: boolean }

export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    return { muted: s.muted === true };
  } catch {
    return { muted: false };
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* sem persistência: segue na sessão */ }
}
