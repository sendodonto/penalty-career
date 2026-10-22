/** Regras dos imprevistos (sem Phaser, para os testes); a encenação fica em scenes/MatchEvents. */

/** `raid`: uma nave abduz o jogador para uma partida especial (data/specials). */
export type Incident = 'invader' | 'dog' | 'blackout' | 'raid';

/** Rótulos para a tela de resultado (clima e imprevistos). */
export const EVENT_LABEL: Record<string, string> = {
  rain: 'Chuva forte', snow: 'Neve', fog: 'Neblina',
  invader: 'Invasão de campo', dog: 'Cachorro no gramado', blackout: 'Apagão', raid: 'Raid: jogador abduzido',
};

/** Chance de imprevisto a cada vez (no máximo um por partida): em média 1 a cada 3 partidas. */
export const INCIDENT_CHANCE = 0.04;

/** Sorteia o imprevisto; o cachorro é o mais raro. Sem `allowRaid` (menu, partidas especiais) não há abdução. */
export function pickIncident(r: number, allowRaid: boolean): Incident {
  if (!allowRaid) r *= 0.7;
  return r < 0.32 ? 'invader' : r < 0.44 ? 'dog' : r < 0.7 ? 'blackout' : 'raid';
}
