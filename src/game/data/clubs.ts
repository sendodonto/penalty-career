import type { Club, League, Team } from '../types';
import { NATIONS } from './nations';
import { EARTH, SPECIALS } from './specials';

/** Ligas de 8 clubes (turno único, 7 rodadas): tier mede o peso da liga no salário e na reputação. */
export const LEAGUES: League[] = [
  { id: 'br-b', name: 'Brasileirão Série B', country: 'Brasil', tier: 1, continent: 'sa' },
  { id: 'br-a', name: 'Brasileirão Série A', country: 'Brasil', tier: 2, continent: 'sa' },
  { id: 'ar', name: 'Liga Profesional Argentina', country: 'Argentina', tier: 2, continent: 'sa' },
  { id: 'pt', name: 'Primeira Liga', country: 'Portugal', tier: 3, continent: 'eu' },
  { id: 'fr', name: 'Ligue 1', country: 'França', tier: 4, continent: 'eu' },
  { id: 'de', name: 'Bundesliga', country: 'Alemanha', tier: 4, continent: 'eu' },
  { id: 'it', name: 'Serie A', country: 'Itália', tier: 4, continent: 'eu' },
  { id: 'es', name: 'LaLiga', country: 'Espanha', tier: 5, continent: 'eu' },
  { id: 'en', name: 'Premier League', country: 'Inglaterra', tier: 5, continent: 'eu' },
];

export const DOMESTIC_CUPS: Record<string, string> = {
  Brasil: 'Copa do Brasil', Argentina: 'Copa Argentina', Portugal: 'Taça de Portugal', França: 'Coupe de France',
  Alemanha: 'DFB-Pokal', Itália: 'Coppa Italia', Espanha: 'Copa del Rey', Inglaterra: 'FA Cup',
};
export const CONTINENTAL_CUPS = { sa: 'Copa Libertadores', eu: 'Liga dos Campeões' } as const;

const c = (
  id: string, name: string, short: string, city: string, league: string,
  primary: string, secondary: string, strength: number, minReputation: number,
): Club => ({ id, name, short, city, league, primary, secondary, strength, keeper: strength - 0.02, minReputation });

// Escudos são desenhados pelo jogo (formas e cores); nomes e cores identificam os clubes.
export const CLUBS: Club[] = [
  c('ituano', 'Ituano', 'ITU', 'Itu', 'br-b', '#c4161c', '#111111', 0.3, 0),
  c('crb', 'CRB', 'CRB', 'Maceió', 'br-b', '#d0111b', '#ffffff', 0.33, 0),
  c('avai', 'Avaí', 'AVA', 'Florianópolis', 'br-b', '#0b5cad', '#ffffff', 0.35, 2),
  c('guarani', 'Guarani', 'GUA', 'Campinas', 'br-b', '#0f7a3d', '#ffffff', 0.37, 4),
  c('paysandu', 'Paysandu', 'PAY', 'Belém', 'br-b', '#3a8dde', '#ffffff', 0.39, 5),
  c('ponte-preta', 'Ponte Preta', 'PON', 'Campinas', 'br-b', '#111111', '#ffffff', 0.41, 6),
  c('coritiba', 'Coritiba', 'CFC', 'Curitiba', 'br-b', '#00544e', '#ffffff', 0.43, 8),
  c('sport', 'Sport', 'SPT', 'Recife', 'br-b', '#c8102e', '#111111', 0.46, 10),

  c('fluminense', 'Fluminense', 'FLU', 'Rio de Janeiro', 'br-a', '#7a1f34', '#0e6b3a', 0.56, 14),
  c('gremio', 'Grêmio', 'GRE', 'Porto Alegre', 'br-a', '#0d80bf', '#111111', 0.58, 16),
  c('internacional', 'Internacional', 'SCI', 'Porto Alegre', 'br-a', '#d0021b', '#ffffff', 0.59, 18),
  c('corinthians', 'Corinthians', 'COR', 'São Paulo', 'br-a', '#f2f2f2', '#111111', 0.61, 20),
  c('sao-paulo', 'São Paulo', 'SAO', 'São Paulo', 'br-a', '#ffffff', '#d0021b', 0.62, 22),
  c('atletico-mg', 'Atlético Mineiro', 'CAM', 'Belo Horizonte', 'br-a', '#111111', '#ffffff', 0.64, 24),
  c('palmeiras', 'Palmeiras', 'PAL', 'São Paulo', 'br-a', '#006437', '#ffffff', 0.68, 30),
  c('flamengo', 'Flamengo', 'FLA', 'Rio de Janeiro', 'br-a', '#c8102e', '#111111', 0.7, 32),

  c('rosario-central', 'Rosario Central', 'RCE', 'Rosario', 'ar', '#003a8c', '#f6c700', 0.54, 14),
  c('velez', 'Vélez Sarsfield', 'VEL', 'Buenos Aires', 'ar', '#ffffff', '#0b3d91', 0.55, 15),
  c('estudiantes', 'Estudiantes', 'EST', 'La Plata', 'ar', '#d0021b', '#ffffff', 0.56, 16),
  c('san-lorenzo', 'San Lorenzo', 'SLO', 'Buenos Aires', 'ar', '#0b2d6b', '#d0021b', 0.57, 17),
  c('independiente', 'Independiente', 'IND', 'Avellaneda', 'ar', '#b5121b', '#f2f2f2', 0.58, 18),
  c('racing', 'Racing Club', 'RAC', 'Avellaneda', 'ar', '#6cace4', '#ffffff', 0.6, 20),
  c('river-plate', 'River Plate', 'RIV', 'Buenos Aires', 'ar', '#ffffff', '#d0021b', 0.67, 28),
  c('boca-juniors', 'Boca Juniors', 'BOC', 'Buenos Aires', 'ar', '#0b3d91', '#f6c700', 0.68, 30),

  c('famalicao', 'Famalicão', 'FAM', 'Vila Nova de Famalicão', 'pt', '#0b3d91', '#ffffff', 0.52, 18),
  c('rio-ave', 'Rio Ave', 'RAV', 'Vila do Conde', 'pt', '#0e8a3e', '#ffffff', 0.53, 19),
  c('boavista', 'Boavista', 'BOA', 'Porto', 'pt', '#111111', '#ffffff', 0.54, 20),
  c('vitoria-sc', 'Vitória SC', 'VSC', 'Guimarães', 'pt', '#ffffff', '#111111', 0.56, 22),
  c('braga', 'Braga', 'BRA', 'Braga', 'pt', '#d0021b', '#ffffff', 0.62, 28),
  c('sporting', 'Sporting', 'SCP', 'Lisboa', 'pt', '#0a7a3c', '#ffffff', 0.7, 38),
  c('porto', 'Porto', 'FCP', 'Porto', 'pt', '#0047ab', '#ffffff', 0.72, 42),
  c('benfica', 'Benfica', 'SLB', 'Lisboa', 'pt', '#e20e0e', '#ffffff', 0.73, 44),

  c('nantes', 'Nantes', 'NAN', 'Nantes', 'fr', '#f6c700', '#0e7a3a', 0.58, 32),
  c('rennes', 'Rennes', 'REN', 'Rennes', 'fr', '#d0021b', '#111111', 0.6, 34),
  c('lens', 'Lens', 'RCL', 'Lens', 'fr', '#f6c700', '#d0021b', 0.61, 35),
  c('lille', 'Lille', 'LIL', 'Lille', 'fr', '#d0021b', '#0b2d6b', 0.64, 38),
  c('lyon', 'Lyon', 'OL', 'Lyon', 'fr', '#ffffff', '#0b3d91', 0.65, 40),
  c('marseille', 'Olympique de Marseille', 'OM', 'Marselha', 'fr', '#ffffff', '#2faee0', 0.67, 44),
  c('monaco', 'Monaco', 'ASM', 'Mônaco', 'fr', '#d0021b', '#ffffff', 0.68, 46),
  c('psg', 'Paris Saint-Germain', 'PSG', 'Paris', 'fr', '#0b1f4b', '#d0021b', 0.84, 66),

  c('gladbach', "Borussia M'gladbach", 'BMG', 'Mönchengladbach', 'de', '#ffffff', '#111111', 0.59, 32),
  c('wolfsburg', 'Wolfsburg', 'WOB', 'Wolfsburg', 'de', '#3cb043', '#ffffff', 0.6, 34),
  c('frankfurt', 'Eintracht Frankfurt', 'SGE', 'Frankfurt', 'de', '#111111', '#e1000f', 0.63, 37),
  c('stuttgart', 'Stuttgart', 'VFB', 'Stuttgart', 'de', '#ffffff', '#e30613', 0.64, 38),
  c('leipzig', 'RB Leipzig', 'RBL', 'Leipzig', 'de', '#ffffff', '#dd0741', 0.7, 46),
  c('leverkusen', 'Bayer Leverkusen', 'B04', 'Leverkusen', 'de', '#e32221', '#111111', 0.74, 52),
  c('dortmund', 'Borussia Dortmund', 'BVB', 'Dortmund', 'de', '#fde100', '#111111', 0.76, 54),
  c('bayern', 'Bayern de Munique', 'FCB', 'Munique', 'de', '#dc052d', '#ffffff', 0.86, 68),

  c('fiorentina', 'Fiorentina', 'FIO', 'Florença', 'it', '#5b2a86', '#ffffff', 0.62, 34),
  c('lazio', 'Lazio', 'LAZ', 'Roma', 'it', '#87d8f7', '#ffffff', 0.64, 37),
  c('roma', 'Roma', 'ROM', 'Roma', 'it', '#8e1f2f', '#f0bc42', 0.66, 40),
  c('atalanta', 'Atalanta', 'ATA', 'Bérgamo', 'it', '#1e71b8', '#111111', 0.69, 44),
  c('napoli', 'Napoli', 'NAP', 'Nápoles', 'it', '#12a0d7', '#ffffff', 0.73, 50),
  c('juventus', 'Juventus', 'JUV', 'Turim', 'it', '#111111', '#ffffff', 0.76, 55),
  c('milan', 'Milan', 'MIL', 'Milão', 'it', '#fb090b', '#111111', 0.77, 56),
  c('inter', 'Inter de Milão', 'INT', 'Milão', 'it', '#0068a8', '#111111', 0.82, 62),

  c('valencia', 'Valencia', 'VAL', 'Valência', 'es', '#ffffff', '#111111', 0.63, 38),
  c('sevilla', 'Sevilla', 'SEV', 'Sevilha', 'es', '#ffffff', '#d0021b', 0.66, 42),
  c('real-sociedad', 'Real Sociedad', 'RSO', 'San Sebastián', 'es', '#0067b1', '#ffffff', 0.68, 44),
  c('athletic', 'Athletic Club', 'ATH', 'Bilbao', 'es', '#ee2523', '#ffffff', 0.69, 46),
  c('villarreal', 'Villarreal', 'VIL', 'Vila-real', 'es', '#ffe667', '#005187', 0.71, 48),
  c('atletico-madrid', 'Atlético de Madrid', 'ATM', 'Madri', 'es', '#cb3524', '#ffffff', 0.8, 60),
  c('barcelona', 'Barcelona', 'BAR', 'Barcelona', 'es', '#a50044', '#004d98', 0.88, 72),
  c('real-madrid', 'Real Madrid', 'RMA', 'Madri', 'es', '#ffffff', '#c9a227', 0.9, 76),

  c('aston-villa', 'Aston Villa', 'AVL', 'Birmingham', 'en', '#7a003c', '#95bfe5', 0.7, 46),
  c('newcastle', 'Newcastle', 'NEW', 'Newcastle', 'en', '#111111', '#ffffff', 0.72, 50),
  c('tottenham', 'Tottenham', 'TOT', 'Londres', 'en', '#ffffff', '#132257', 0.74, 52),
  c('man-united', 'Manchester United', 'MUN', 'Manchester', 'en', '#da291c', '#111111', 0.76, 56),
  c('chelsea', 'Chelsea', 'CHE', 'Londres', 'en', '#034694', '#ffffff', 0.78, 58),
  c('arsenal', 'Arsenal', 'ARS', 'Londres', 'en', '#ef0107', '#ffffff', 0.85, 66),
  c('liverpool', 'Liverpool', 'LIV', 'Liverpool', 'en', '#c8102e', '#f6eb61', 0.87, 70),
  c('man-city', 'Manchester City', 'MCI', 'Manchester', 'en', '#6cabdd', '#ffffff', 0.9, 76),
];

export const STARTING_CLUB_ID = 'ituano';

export function getClub(id: string): Club {
  const club = CLUBS.find((cl) => cl.id === id);
  if (!club) throw new Error(`Clube desconhecido: ${id}`);
  return club;
}

export function getLeague(id: string): League {
  const league = LEAGUES.find((l) => l.id === id);
  if (!league) throw new Error(`Liga desconhecida: ${id}`);
  return league;
}

/** Clube, seleção ("n-") ou time dos raids ("s-") pelo id. */
export function getTeam(id: string): Team {
  if (id.startsWith('s-')) return [EARTH, ...SPECIALS.map((s) => s.team)].find((t) => t.id === id) ?? EARTH;
  return id.startsWith('n-') ? NATIONS.find((n) => n.id === id) ?? NATIONS[0] : getClub(id);
}

export const isClubId = (id: string) => CLUBS.some((cl) => cl.id === id);
