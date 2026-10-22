import type { SpecialId } from './specials';
import type { Attributes } from '../types';

/** Onde o item é usado; só um item equipado por slot. */
export type Slot = 'boots' | 'sleeves' | 'socks' | 'headband' | 'wrist' | 'gloves' | 'necklace' | 'armband' | 'celebration';
export type Category = 'Chuteiras' | 'Roupas' | 'Acessórios' | 'Comemorações';

export interface ShopItem {
  id: string;
  slot: Slot;
  category: Category;
  name: string;
  desc: string;
  price: number;
  /** Cor principal do item ('club' = cor principal do clube atual) */
  color?: string;
  accent?: string;
  bonus?: Partial<Attributes>;
  /** Reputação mínima para comprar */
  minRep?: number;
  /** Exclusivo de raid: não se compra, ganha-se no raid indicado */
  raid?: SpecialId;
}

const it = (item: ShopItem) => item;

export const SHOP: ShopItem[] = [
  it({ id: 'boots-white', slot: 'boots', category: 'Chuteiras', name: 'Branca Clássica', desc: 'Visual limpo, de quem bate com estilo.', price: 600, color: '#f1efe8', accent: '#1c1d22' }),
  it({ id: 'boots-neon', slot: 'boots', category: 'Chuteiras', name: 'Neon Volt', desc: 'Impossível não ver no gramado.', price: 1500, color: '#e3ff3a', accent: '#1c1d22' }),
  it({ id: 'boots-fire', slot: 'boots', category: 'Chuteiras', name: 'Laranja Fogo', desc: 'Para quem gosta de chamar atenção.', price: 1500, color: '#ff6a2b', accent: '#ffffff' }),
  it({ id: 'boots-blue', slot: 'boots', category: 'Chuteiras', name: 'Azul Elétrico', desc: 'Leve e veloz, pelo menos no visual.', price: 1500, color: '#2f8cff', accent: '#ffffff' }),
  it({ id: 'boots-pink', slot: 'boots', category: 'Chuteiras', name: 'Rosa Choque', desc: 'Ousadia de craque.', price: 1800, color: '#ff4fa3', accent: '#ffffff' }),
  it({ id: 'boots-silver', slot: 'boots', category: 'Chuteiras', name: 'Prata Precisa', desc: 'Cabedal fino para colocar no canto.', price: 9000, color: '#c9ced6', accent: '#2f3540', bonus: { precision: 2 }, minRep: 20 }),
  it({ id: 'boots-emerald', slot: 'boots', category: 'Chuteiras', name: 'Esmeralda Efeito', desc: 'Pega na bola de lado e ela faz a curva.', price: 9000, color: '#14b38a', accent: '#0b3d2e', bonus: { curve: 2 }, minRep: 20 }),
  it({ id: 'boots-gold', slot: 'boots', category: 'Chuteiras', name: 'Ouro Lendária', desc: 'A chuteira dos artilheiros históricos.', price: 30000, color: '#e2b437', accent: '#5a3d00', bonus: { power: 2, composure: 1 }, minRep: 50 }),
  it({ id: 'boots-mars', slot: 'boots', category: 'Chuteiras', name: 'Marciana', desc: 'Exclusiva do Raid Alienígena: vença os Marcianos FC.', price: 0, color: '#7ddc6a', accent: '#6c2bd1', bonus: { precision: 2, curve: 1 }, raid: 'mars' }),
  it({ id: 'boots-cyborg', slot: 'boots', category: 'Chuteiras', name: 'Cromada T-800', desc: 'Exclusiva do Raid Ciborgue: vença os Ciborgues United.', price: 0, color: '#b8c0c9', accent: '#ff3b3b', bonus: { power: 2, composure: 1 }, raid: 'cyborg' }),
  it({ id: 'boots-dogs', slot: 'boots', category: 'Chuteiras', name: 'Osso de Ouro', desc: 'Exclusiva do Raid Canino: vença a Matilha FC.', price: 0, color: '#efe5cc', accent: '#e0a21b', bonus: { composure: 2, power: 1 }, raid: 'dogs' }),
  it({ id: 'boots-cats', slot: 'boots', category: 'Chuteiras', name: 'Sete Vidas', desc: 'Exclusiva do Raid Felino: vença o Miau United.', price: 0, color: '#1b1b1f', accent: '#ff7a1a', bonus: { curve: 2, precision: 1 }, raid: 'raid' }),

  it({ id: 'sleeves-black', slot: 'sleeves', category: 'Roupas', name: 'Segunda pele preta', desc: 'Manga longa por baixo da camisa.', price: 800, color: '#17181c' }),
  it({ id: 'sleeves-white', slot: 'sleeves', category: 'Roupas', name: 'Segunda pele branca', desc: 'Manga longa clara, estilo europeu.', price: 800, color: '#eeece6' }),
  it({ id: 'sleeves-club', slot: 'sleeves', category: 'Roupas', name: 'Segunda pele do clube', desc: 'Na cor principal do seu clube.', price: 1200, color: 'club' }),
  it({ id: 'sleeves-mars', slot: 'sleeves', category: 'Roupas', name: 'Segunda pele marciana', desc: 'Raid Alienígena: derrube 3 naves-espiãs numa partida.', price: 0, color: '#7ddc6a', raid: 'mars' }),
  it({ id: 'sleeves-cyborg', slot: 'sleeves', category: 'Roupas', name: 'Segunda pele cromada', desc: 'Raid Ciborgue: derrube 3 drones numa partida.', price: 0, color: '#9aa3ad', raid: 'cyborg' }),
  it({ id: 'sleeves-dogs', slot: 'sleeves', category: 'Roupas', name: 'Segunda pele caramelo', desc: 'Raid Canino: derrube 3 ossos voadores numa partida.', price: 0, color: '#d9b27a', raid: 'dogs' }),
  it({ id: 'sleeves-cats', slot: 'sleeves', category: 'Roupas', name: 'Segunda pele felina', desc: 'Raid Felino: derrube 3 novelos numa partida.', price: 0, color: '#f08a3c', raid: 'raid' }),
  it({ id: 'socks-low', slot: 'socks', category: 'Roupas', name: 'Meião baixo', desc: 'Meião abaixado, caneleira à mostra.', price: 500 }),

  it({ id: 'headband-white', slot: 'headband', category: 'Acessórios', name: 'Faixa branca', desc: 'Segura o cabelo na hora da batida.', price: 300, color: '#f4f1e8' }),
  it({ id: 'headband-black', slot: 'headband', category: 'Acessórios', name: 'Faixa preta', desc: 'Discreta e séria.', price: 300, color: '#1b1b1f' }),
  it({ id: 'headband-red', slot: 'headband', category: 'Acessórios', name: 'Faixa vermelha', desc: 'Para os dias de decisão.', price: 400, color: '#d62828' }),
  it({ id: 'wrist-white', slot: 'wrist', category: 'Acessórios', name: 'Munhequeiras brancas', desc: 'Um clássico dos anos 90.', price: 250, color: '#f4f1e8' }),
  it({ id: 'wrist-black', slot: 'wrist', category: 'Acessórios', name: 'Munhequeiras pretas', desc: 'Combinam com tudo.', price: 250, color: '#1b1b1f' }),
  it({ id: 'gloves-black', slot: 'gloves', category: 'Acessórios', name: 'Luvas térmicas', desc: 'Para as noites frias de inverno europeu.', price: 700, color: '#1b1b1f' }),
  it({ id: 'necklace-gold', slot: 'necklace', category: 'Acessórios', name: 'Cordão de ouro', desc: 'Brilha nas fotos de comemoração.', price: 5000, color: '#e2b437', minRep: 25 }),
  it({ id: 'armband-captain', slot: 'armband', category: 'Acessórios', name: 'Braçadeira de capitão', desc: 'Liderança no braço esquerdo.', price: 3000, color: '#ffd23f', minRep: 35 }),

  it({ id: 'cel-plane', slot: 'celebration', category: 'Comemorações', name: 'Aviãozinho', desc: 'Braços abertos, voando pelo gramado.', price: 2000 }),
  it({ id: 'cel-jump', slot: 'celebration', category: 'Comemorações', name: 'Salto com soco', desc: 'Pulo alto e soco no ar.', price: 2000 }),
  it({ id: 'cel-dance', slot: 'celebration', category: 'Comemorações', name: 'Dancinha', desc: 'A torcida canta junto.', price: 3000 }),
  it({ id: 'cel-knee', slot: 'celebration', category: 'Comemorações', name: 'Joelhada', desc: 'Desliza de joelhos rumo à torcida.', price: 3500, minRep: 15 }),
];

export const CATEGORIES: Category[] = ['Chuteiras', 'Roupas', 'Acessórios', 'Comemorações'];
export const SLOT_LABEL: Record<Slot, string> = {
  boots: 'Chuteira', sleeves: 'Segunda pele', socks: 'Meião', headband: 'Faixa', wrist: 'Munhequeira',
  gloves: 'Luvas', necklace: 'Cordão', armband: 'Braçadeira', celebration: 'Comemoração',
};

export const getItem = (id: string | undefined) => SHOP.find((x) => x.id === id);

/** Itens equipados por slot. */
export type Equipped = Partial<Record<Slot, string>>;

/** O que a arte precisa saber para desenhar o jogador equipado. */
export interface GearVisual {
  boots?: { color: string; accent: string };
  sleeves?: string;
  socksLow?: boolean;
  headband?: string;
  wrist?: string;
  gloves?: string;
  necklace?: string;
  armband?: string;
}

export function gearVisual(eq: Equipped, clubColor: string): GearVisual {
  const color = (slot: Slot) => {
    const c = getItem(eq[slot])?.color;
    return c === 'club' ? clubColor : c;
  };
  const boots = getItem(eq.boots);
  return {
    boots: boots ? { color: boots.color!, accent: boots.accent ?? '#ffffff' } : undefined,
    sleeves: color('sleeves'),
    socksLow: !!eq.socks,
    headband: color('headband'),
    wrist: color('wrist'),
    gloves: color('gloves'),
    necklace: color('necklace'),
    armband: color('armband'),
  };
}

/** Assinatura curta do visual, para a chave de cache das texturas. */
export const gearKey = (g: GearVisual) => JSON.stringify(g);

/** Bônus de atributos dos itens equipados. */
export function gearBonus(eq: Equipped): Partial<Attributes> {
  const total: Partial<Attributes> = {};
  for (const id of Object.values(eq)) {
    for (const [k, v] of Object.entries(getItem(id)?.bonus ?? {})) {
      total[k as keyof Attributes] = (total[k as keyof Attributes] ?? 0) + (v ?? 0);
    }
  }
  return total;
}
