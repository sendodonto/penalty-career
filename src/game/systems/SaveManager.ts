import { CLUBS } from '../data/clubs';
import type { Career } from '../types';
import { ATTR_KEYS, migrateV1 } from './Career';

/** v1: clubes fictícios e uma liga por temporada; v2: clubes reais, várias competições, contratos. */
export const SAVE_VERSION = 2;
const SAVE_KEY = 'penalty-career/save';
const SETTINGS_KEY = 'penalty-career/settings';

export type LoadResult =
  | { status: 'none' }
  | { status: 'ok'; career: Career }
  | { status: 'corrupt'; reason: string };

interface SaveFile { saveVersion: number; savedAt: string; career: Career }

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Partes comuns às duas versões: identidade, atributos e números básicos. */
function validatePlayer(c: any): string | null {
  if (!isObj(c)) return 'carreira ausente';
  const id = c.identity;
  if (!isObj(id) || typeof id.name !== 'string' || typeof id.nationality !== 'string' || !isNum(id.number)) return 'identidade inválida';
  if (!isObj(id.appearance) || !isNum(id.appearance.skin) || !isNum(id.appearance.hair) || !isNum(id.appearance.hairColor)) return 'aparência inválida';
  if (!isObj(c.attributes) || !ATTR_KEYS.every((k) => isNum(c.attributes[k]))) return 'atributos inválidos';
  for (const k of ['age', 'level', 'xp', 'skillPoints', 'money', 'reputation', 'season', 'matchesPlayed']) {
    if (!isNum(c[k])) return `campo ${k} inválido`;
  }
  return null;
}

/** Valida o formato antes de confiar no salvamento (dados vindos do navegador podem estar adulterados). */
export function validateCareer(c: any): string | null {
  const err = validatePlayer(c);
  if (err) return err;
  if (!CLUBS.some((cl) => cl.id === c.clubId)) return 'clube desconhecido';
  if (!isObj(c.contract) || !isNum(c.contract.salary) || !isNum(c.contract.until)) return 'contrato inválido';
  if (!isObj(c.stats) || !isObj(c.leagueOf)) return 'estatísticas inválidas';
  for (const k of ['comps', 'calendar', 'history', 'trophies', 'offers', 'news']) {
    if (!Array.isArray(c[k])) return `lista ${k} inválida`;
  }
  const ids = new Set(c.comps.map((x: any) => x?.id));
  if (!c.comps.every((x: any) => isObj(x) && Array.isArray(x.teams) && Array.isArray(x.schedule) && Array.isArray(x.bracket))) return 'competição inválida';
  if (!c.calendar.every((id: unknown) => ids.has(id))) return 'calendário inválido';
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
    if (file.saveVersion === 1) {
      const err = validatePlayer(file.career);
      if (err) return { status: 'corrupt', reason: err };
      const career = migrateV1(file.career);
      saveCareer(career, storage);
      return { status: 'ok', career };
    }
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
