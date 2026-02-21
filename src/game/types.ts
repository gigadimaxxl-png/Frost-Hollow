
export interface Point {
  x: number;
  y: number;
}

export interface Entity extends Point {
  id: string;
  radius: number;
  health: number;
}

export type WeaponType = 'shotgun' | 'rifle' | 'flamethrower' | 'sniper' | 'cryobeam' | 'teslacannon' | 'voidlauncher';

export interface Weapon {
  type: WeaponType;
  ammo: number;
  maxAmmo: number;
  fireRate: number;
  reloadTime: number;
  damage: number;
  cost: number;
  unlocked: boolean;
  abilityName?: string;
  abilityCooldown?: number;
  lastAbilityTime?: number;
}

export interface Player extends Entity {
  angle: number;
  currentWeapon: WeaponType;
  weapons: Record<WeaponType, Weapon>;
  isReloading: boolean;
  inventory: string[];
  scrap: number;
  shield: number;
}

export interface Mutant extends Entity {
  type: 'wolf' | 'stalker';
  speed: number;
}

export interface Bullet extends Point {
  id: string;
  vx: number;
  vy: number;
  damage: number;
}

export interface Particle extends Point {
  id: string;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface Trap extends Entity {
  active: boolean;
}

export interface Scrap extends Point {
  id: string;
  value: number;
}

export type Language = 'en' | 'ru';

export interface GameState {
  player: Player;
  mutants: Mutant[];
  bullets: Bullet[];
  particles: Particle[];
  traps: Trap[];
  scraps: Scrap[];
  score: number;
  isGameOver: boolean;
  isShopOpen: boolean;
  isPaused: boolean;
  weatherIntensity: number; // 0 to 1
  time: number;
  wave: number;
  enemiesToSpawn: number;
  waveCooldown: number;
  language: Language;
  roomId: string | null;
  isHost: boolean;
  otherPlayers: Record<string, Partial<Player>>;
}
