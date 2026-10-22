import type { Club } from '../types';

const c = (
  id: string, name: string, short: string, city: string, tier: Club['tier'],
  primary: string, secondary: string, strength: number, keeper: number, minReputation: number,
): Club => ({ id, name, short, city, tier, primary, secondary, strength, keeper, minReputation });

export const CLUBS: Club[] = [
  c('ferroviario', 'Ferroviário do Vale', 'FDV', 'Vale do Trilho', 1, '#c8452f', '#f2e6cf', 0.30, 0.28, 0),
  c('lagoa', 'Esporte Clube Lagoa Seca', 'ELS', 'Lagoa Seca', 1, '#2f6fb3', '#f4f1e8', 0.34, 0.33, 0),
  c('operario', 'Operário Serrano', 'OPS', 'Serra Alta', 1, '#1d1d1f', '#e0b23a', 0.38, 0.36, 4),
  c('uniao', 'União Ribeirinha', 'URB', 'Porto do Rio', 1, '#2c8a57', '#f4f1e8', 0.41, 0.40, 6),
  c('atletico-sul', 'Atlético Campos do Sul', 'ACS', 'Campos do Sul', 1, '#7b2d8e', '#f0d36b', 0.44, 0.42, 8),
  c('nautico', 'Náutico Baía Clara', 'NBC', 'Baía Clara', 1, '#e07b2a', '#14324f', 0.47, 0.46, 10),

  c('real-monte', 'Real Monte Azul', 'RMA', 'Monte Azul', 2, '#1f4fa0', '#f4f1e8', 0.52, 0.50, 15),
  c('cruzeiro-norte', 'Cruzeiro do Norte', 'CDN', 'Boa Vista Alta', 2, '#14324f', '#d9dfe6', 0.55, 0.54, 18),
  c('sporting-aurora', 'Sporting Aurora', 'SPA', 'Aurora', 2, '#2b7d4b', '#111d16', 0.58, 0.57, 22),
  c('vila-nova', 'Associação Vila Nova', 'AVN', 'Vila Nova', 2, '#b0202f', '#111111', 0.60, 0.60, 26),
  c('metropolitano', 'Metropolitano FC', 'MET', 'Capital', 2, '#6c6f78', '#f2c230', 0.63, 0.62, 30),
  c('estrela-mar', 'Estrela do Mar', 'EDM', 'Costa Dourada', 2, '#1aa0a8', '#f4f1e8', 0.66, 0.65, 34),

  c('imperial', 'Imperial Paulistano', 'IMP', 'Nova Paulista', 3, '#0f0f12', '#f4f1e8', 0.70, 0.69, 42),
  c('olimpia', 'Olímpia Capital', 'OLC', 'Capital', 3, '#f4f1e8', '#1f4fa0', 0.73, 0.72, 48),
  c('castelo', 'Castelo Branco SC', 'CBS', 'Castelo', 3, '#8a1c2b', '#e8c46a', 0.76, 0.75, 54),
  c('leoes', 'Leões da Serra', 'LDS', 'Serra Grande', 3, '#e0a21b', '#141414', 0.79, 0.78, 60),
  c('continental', 'Continental Athletic', 'CTA', 'Porto Grande', 3, '#c42222', '#f4f1e8', 0.82, 0.81, 66),
  c('galaxia', 'Galáxia United', 'GXU', 'Metrópole', 3, '#3b2a8f', '#f0b429', 0.86, 0.85, 72),
];

export const LEAGUE_NAMES: Record<Club['tier'], string> = {
  1: 'Liga Regional',
  2: 'Liga Nacional',
  3: 'Liga Elite',
};

export const STARTING_CLUB_ID = 'ferroviario';

export function getClub(id: string): Club {
  const club = CLUBS.find((cl) => cl.id === id);
  if (!club) throw new Error(`Clube desconhecido: ${id}`);
  return club;
}

export const leagueClubs = (tier: Club['tier']) => CLUBS.filter((cl) => cl.tier === tier);

export const NATIONALITIES = [
  'Brasil', 'Argentina', 'Portugal', 'Uruguai', 'Colômbia', 'Chile', 'México',
  'Espanha', 'França', 'Itália', 'Alemanha', 'Inglaterra', 'Nigéria', 'Senegal', 'Japão', 'Estados Unidos',
];
