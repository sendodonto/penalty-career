import type { Nation } from '../types';

const n = (name: string, short: string, primary: string, secondary: string, strength: number, confed: Nation['confed']): Nation => ({
  id: `n-${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')}`,
  name, short, primary, secondary, strength, keeper: strength - 0.02, confed,
});

export const NATIONS: Nation[] = [
  n('Brasil', 'BRA', '#ffdf00', '#009c3b', 0.86, 'CONMEBOL'),
  n('Argentina', 'ARG', '#75aadb', '#ffffff', 0.88, 'CONMEBOL'),
  n('Uruguai', 'URU', '#5cbfeb', '#111111', 0.78, 'CONMEBOL'),
  n('Colômbia', 'COL', '#fcd116', '#003893', 0.76, 'CONMEBOL'),
  n('Equador', 'EQU', '#ffdd00', '#034ea2', 0.68, 'CONMEBOL'),
  n('Chile', 'CHI', '#d52b1e', '#0039a6', 0.66, 'CONMEBOL'),
  n('França', 'FRA', '#0055a4', '#ffffff', 0.89, 'UEFA'),
  n('Espanha', 'ESP', '#c60b1e', '#ffc400', 0.87, 'UEFA'),
  n('Inglaterra', 'ING', '#ffffff', '#1d2b5c', 0.86, 'UEFA'),
  n('Portugal', 'POR', '#c8102e', '#006600', 0.85, 'UEFA'),
  n('Alemanha', 'ALE', '#ffffff', '#111111', 0.84, 'UEFA'),
  n('Itália', 'ITA', '#0064aa', '#ffffff', 0.82, 'UEFA'),
  n('Holanda', 'HOL', '#ff6c00', '#ffffff', 0.82, 'UEFA'),
  n('Croácia', 'CRO', '#e31b23', '#ffffff', 0.79, 'UEFA'),
  n('Bélgica', 'BEL', '#c8102e', '#111111', 0.78, 'UEFA'),
  n('Dinamarca', 'DIN', '#c60c30', '#ffffff', 0.75, 'UEFA'),
  n('Suíça', 'SUI', '#d52b1e', '#ffffff', 0.74, 'UEFA'),
  n('México', 'MEX', '#006847', '#ffffff', 0.72, 'CONCACAF'),
  n('Estados Unidos', 'EUA', '#ffffff', '#0a3161', 0.7, 'CONCACAF'),
  n('Marrocos', 'MAR', '#c1272d', '#006233', 0.76, 'CAF'),
  n('Senegal', 'SEN', '#ffffff', '#00853f', 0.72, 'CAF'),
  n('Nigéria', 'NGA', '#008751', '#ffffff', 0.68, 'CAF'),
  n('Japão', 'JAP', '#0b2a7a', '#ffffff', 0.73, 'AFC'),
  n('Coreia do Sul', 'KOR', '#cd2e3a', '#111111', 0.7, 'AFC'),
];

export const NATIONALITIES = NATIONS.map((x) => x.name);

export function nationByName(name: string): Nation {
  return NATIONS.find((x) => x.name === name) ?? NATIONS[0];
}

/** A cada 4 temporadas a Copa do Mundo; no meio do ciclo, o torneio continental de seleções. */
export const WORLD_CUP = 'Copa do Mundo';
export const COPA_AMERICA = 'Copa América';
export const EURO = 'Eurocopa';
/** Seleções da Copa América (CONMEBOL + convidados da CONCACAF). */
export const COPA_AMERICA_TEAMS = NATIONS.filter((x) => x.confed === 'CONMEBOL' || x.confed === 'CONCACAF').map((x) => x.id);
