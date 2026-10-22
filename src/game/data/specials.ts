import type { Team } from '../types';

/** Raids: eventos em que uma nave leva o jogador para uma disputa contra outra espécie. */
export type SpecialId = 'mars' | 'cyborg' | 'dogs' | 'raid';
/** Cabeça e "pele" dos jogadores do time especial (figureArt). */
export type Species = 'alien' | 'cyborg' | 'dog' | 'cat';

/** Cores do estádio temático (Stadium). */
export interface Theme {
  stands: [number, number];
  roof: number;
  pitch: [number, number];
  lines: number;
  board: number;
  ads: string[];
  /** Cor das cabeças da torcida (a espécie da casa) */
  crowd: number;
}

export interface Special {
  id: SpecialId;
  title: string;
  intro: string;
  place: string;
  ship: 'saucer' | 'drone' | 'dog' | 'cat';
  beam: number;
  team: Team;
  species: Species;
  /** Variações de cor da pele/pelo/metal dos jogadores */
  skins: string[];
  names: string[];
  /** Falas do cobrador adversário antes de bater */
  taunts: string[];
  trophy: string;
  theme: Theme;
}

/** O time do jogador nas partidas especiais. */
export const EARTH: Team = { id: 's-earth', name: 'Seleção da Terra', short: 'TER', primary: '#1f6fd1', secondary: '#3cc46a', strength: 0.72, keeper: 0.72 };

export const EARTH_THEME: Theme = {
  stands: [0x18202b, 0x141b24], roof: 0x07090c, pitch: [0x358a42, 0x2f7d3b], lines: 0xf4f1e8, board: 0x1b2633,
  ads: ['PENALTY CAREER', 'AURORA TÊXTIL', 'FARMÁCIA SOL', 'RÁDIO VALE FM', 'CAFÉ SERRANO'], crowd: 0xc9a07a,
};

export const SPECIALS: Special[] = [
  {
    id: 'mars', title: 'RAID ALIENÍGENA!', intro: 'Você foi abduzido! Destino: Marte, contra os Marcianos FC.',
    place: 'Marte · Arena Olympus Mons', ship: 'saucer', beam: 0x9dff8a, species: 'alien', skins: ['#7ddc6a', '#5fc7a0', '#a3e05a'],
    names: ['ZORG', 'KLAATU', 'X-17', 'GLORP', 'ZYX'], trophy: 'Copa Intergaláctica',
    taunts: ['BLORP!', 'Leve-me ao seu goleiro.', 'Terráqueo fraco!', 'Bip... gol... bip.', 'Nós inventamos o pênalti.'],
    team: { id: 's-mars', name: 'Marcianos FC', short: 'MAR', primary: '#6c2bd1', secondary: '#9dff8a', strength: 0.8, keeper: 0.78 },
    theme: {
      stands: [0x3a1410, 0x2e0f0c], roof: 0x1a0705, pitch: [0xb5562f, 0xa24a2a], lines: 0xffe2c4, board: 0x4a1d12,
      ads: ['RÁDIO ÓRBITA', 'CRATERA BURGER', 'OLYMPUS MONS', 'VERMELHO TV', 'POEIRA FINA'], crowd: 0x7ddc6a,
    },
  },
  {
    id: 'cyborg', title: 'RAID CIBORGUE!', intro: 'Teletransportado! Ciborgues desafiam você na Estação Orbital Ômega.',
    place: 'Estação Orbital Ômega', ship: 'drone', beam: 0x5bd8ff, species: 'cyborg', skins: ['#9aa3ad', '#7d8794', '#b8c0c9'],
    names: ['XL-9', 'T-800', 'OMEGA', 'UNIT-3', 'NEXUS'], trophy: 'Taça Ciborgue',
    taunts: ['EXECUTANDO CHUTE.EXE', 'Probabilidade de gol: 99,8%.', 'Erro 404: goleiro não encontrado.', 'Atualizando firmware...', 'Eu voltarei. Para bater.'],
    team: { id: 's-cyborg', name: 'Ciborgues United', short: 'CYB', primary: '#2b3442', secondary: '#ff3b3b', strength: 0.84, keeper: 0.82 },
    theme: {
      stands: [0x161c26, 0x10151d], roof: 0x05070a, pitch: [0x313d4d, 0x2a3442], lines: 0x5bd8ff, board: 0x0e2233,
      ads: ['SISTEMA 2099', 'NEURO-LINK', 'ÓLEO PREMIUM', 'BATERIA MAX', 'PROTOCOLO 7'], crowd: 0x9aa3ad,
    },
  },
  {
    id: 'dogs', title: 'RAID CANINO!', intro: 'Cachorros humanos sequestraram você para o Planeta Latido!',
    place: 'Planeta Latido · Estádio do Osso', ship: 'dog', beam: 0xffd23f, species: 'dog', skins: ['#a8693f', '#d9b27a', '#5a3a22', '#efe5cc'],
    names: ['REX', 'BOLINHA', 'THOR', 'PIPOCA', 'TOBIAS'], trophy: 'Copa do Osso',
    taunts: ['AU AU AU!', 'Cadê a bolinha? CADÊ?', 'Quem é um bom cobrador? Eu!', 'Grrr... foco.', 'Depois do gol, petisco.'],
    team: { id: 's-dogs', name: 'Matilha FC', short: 'MAT', primary: '#e0a21b', secondary: '#5a3a22', strength: 0.74, keeper: 0.72 },
    theme: {
      stands: [0x2a1d12, 0x231810], roof: 0x120c06, pitch: [0x479a42, 0x3e8b3a], lines: 0xffffff, board: 0x3a2814,
      ads: ['RAÇÃO TOP', 'OSSO DE OURO', 'PETISCO FM', 'AU AU SPORTS', 'PARQUE LIVRE'], crowd: 0xa8693f,
    },
  },
  {
    id: 'raid', title: 'RAID FELINO!', intro: 'Gatos humanos arrastaram você para Miaulópolis. Miau.',
    place: 'Miaulópolis · Arena do Arranhão', ship: 'cat', beam: 0xff7ad9, species: 'cat', skins: ['#f08a3c', '#9c9a94', '#1b1b1f', '#efe5cc'],
    names: ['FÉLIX', 'NINA', 'GARRA', 'TOM', 'BIGODE'], trophy: 'Troféu do Novelo',
    taunts: ['Miau.', 'Vou derrubar essa bola da mesa.', 'Isso aqui é meu agora.', 'Prrr... ronron... gol.', 'Sete vidas, sete gols.'],
    team: { id: 's-raid', name: 'Miau United', short: 'MIA', primary: '#111111', secondary: '#ff7a1a', strength: 0.78, keeper: 0.8 },
    theme: {
      stands: [0x1d1430, 0x170f27], roof: 0x0b0714, pitch: [0x337b76, 0x2c6e6a], lines: 0xffd9f0, board: 0x2b1640,
      ads: ['MIAU UNITED', 'SACHÊ GOURMET', 'ARRANHADOR PRO', 'NOVELO TV', 'SONECA FM'], crowd: 0xf08a3c,
    },
  },
];

export const getSpecial = (id: string) => SPECIALS.find((s) => s.id === id);
