
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const PLAYER_SPEED = 3;
export const PLAYER_HEALTH = 100;
export const SHOTGUN_AMMO_CAPACITY = 5;
export const SHOTGUN_RELOAD_TIME = 1000; // ms
export const SHOTGUN_FIRE_RATE = 800; // ms

export const MUTANT_SPEED = 1.5;
export const MUTANT_HEALTH = 50;
export const MUTANT_DAMAGE = 10;
export const MUTANT_SPAWN_RATE = 0.005; // probability per frame

export const TRAP_COST = 50;
export const TRAP_HEALTH = 100;
export const SCRAP_VALUE = 25;
export const MEDKIT_COST = 75;
export const MEDKIT_HEAL_AMOUNT = 30;
export const SHIELD_RECHARGE_COST = 50;
export const SHIELD_RECHARGE_AMOUNT = 50;

export const WEAPONS: Record<string, any> = {
  shotgun: { type: 'shotgun', ammo: 5, maxAmmo: 5, fireRate: 800, reloadTime: 1000, damage: 20, cost: 0, unlocked: true },
  rifle: { type: 'rifle', ammo: 30, maxAmmo: 30, fireRate: 150, reloadTime: 1500, damage: 15, cost: 200, unlocked: false },
  flamethrower: { type: 'flamethrower', ammo: 100, maxAmmo: 100, fireRate: 50, reloadTime: 2000, damage: 5, cost: 500, unlocked: false },
  sniper: { type: 'sniper', ammo: 5, maxAmmo: 5, fireRate: 1500, reloadTime: 2000, damage: 100, cost: 1000, unlocked: false },
  cryobeam: { 
    type: 'cryobeam', ammo: 50, maxAmmo: 50, fireRate: 100, reloadTime: 2000, damage: 8, cost: 10000, unlocked: false,
    abilityName: 'Freeze', abilityCooldown: 15000, lastAbilityTime: 0 
  },
  teslacannon: { 
    type: 'teslacannon', ammo: 20, maxAmmo: 20, fireRate: 400, reloadTime: 2500, damage: 25, cost: 10000, unlocked: false,
    abilityName: 'Overload', abilityCooldown: 10000, lastAbilityTime: 0 
  },
  voidlauncher: { 
    type: 'voidlauncher', ammo: 10, maxAmmo: 10, fireRate: 1000, reloadTime: 3000, damage: 50, cost: 10000, unlocked: false,
    abilityName: 'Black Hole', abilityCooldown: 20000, lastAbilityTime: 0 
  },
};

export const TRANSLATIONS = {
  en: {
    title: "FROST HOLLOW",
    subtitle: "Survival Horror in the Frozen Frontier",
    mission: "Defend the town. Collect scrap from mutants. Use scrap to craft traps, buy weapons, or heal.",
    begin: "Begin Watch",
    gameOver: "The Cold Claims You",
    gameOverDesc: "Frost Hollow has fallen. The mutations continue to spread through the frozen frontier.",
    tryAgain: "Try Again",
    arsenal: "Arsenal",
    scrap: "Scrap",
    wave: "Wave",
    enemies: "Enemies",
    reloading: "Reloading...",
    medkit: "Medkit",
    shield: "Shield",
    purchase: "Purchase",
    equip: "Equip",
    equipped: "Equipped",
    unlocked: "Unlocked",
    full: "Full",
    heal: "Heal",
    recharge: "Recharge",
    controls: "Controls",
    wasd: "Move",
    mouse: "Aim / Shoot",
    e: "Craft Trap",
    b: "Arsenal (Shop)",
    esc: "Pause Menu",
    oneFour: "Switch Weapons",
    space: "Special Ability",
    language: "Language",
    paused: "Paused",
    resume: "Resume",
    quit: "Quit",
    nextWave: "NEXT WAVE IN",
    multiplayer: "Multiplayer",
    createRoom: "Create Room",
    joinRoom: "Join Room",
    roomCode: "Room Code",
    enterCode: "Enter Room Code",
    host: "Host",
    client: "Client",
    waiting: "Waiting for players...",
  },
  ru: {
    title: "МОРОЗНАЯ ЛОЩИНА",
    subtitle: "Хоррор на выживание в ледяном фронтире",
    mission: "Защищайте город. Собирайте лом с мутантов. Используйте лом для создания ловушек, покупки оружия или лечения.",
    begin: "Начать вахту",
    gameOver: "Холод забрал вас",
    gameOverDesc: "Морозная Лощина пала. Мутации продолжают распространяться по ледяному фронтиру.",
    tryAgain: "Попробовать снова",
    arsenal: "Арсенал",
    scrap: "Лом",
    wave: "Волна",
    enemies: "Враги",
    reloading: "Перезарядка...",
    medkit: "Аптечка",
    shield: "Щит",
    purchase: "Купить",
    equip: "Экипировать",
    equipped: "Экипировано",
    unlocked: "Разблокировано",
    full: "Полный",
    heal: "Лечить",
    recharge: "Зарядить",
    controls: "Управление",
    wasd: "Движение",
    mouse: "Прицел / Стрельба",
    e: "Создать ловушку",
    b: "Арсенал (Магазин)",
    esc: "Меню паузы",
    oneFour: "Смена оружия",
    space: "Спецспособность",
    language: "Язык",
    paused: "Пауза",
    resume: "Продолжить",
    quit: "Выйти",
    nextWave: "СЛЕДУЮЩАЯ ВОЛНА ЧЕРЕЗ",
    multiplayer: "Мультиплеер",
    createRoom: "Создать комнату",
    joinRoom: "Войти в комнату",
    roomCode: "Код комнаты",
    enterCode: "Введите код комнаты",
    host: "Хост",
    client: "Клиент",
    waiting: "Ожидание игроков...",
  }
};

export const COLORS = {
  SNOW: '#e2e8f0',
  NIGHT: '#0f172a',
  BLOOD: '#991b1b',
  PLAYER: '#1e293b',
  MUTANT: '#450a0a',
  FLASHLIGHT: 'rgba(254, 243, 199, 0.3)',
};
