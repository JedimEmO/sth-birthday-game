import * as THREE from "three";
import heroSheetUrl from "../assets/generated/sindre-hero/sheet-transparent.png";
import arenaBatterGateUrl from "../assets/generated/arenas/batter-gate.png";
import arenaBurgerBasilicaUrl from "../assets/generated/arenas/burger-basilica.png";
import arenaCandleCryptUrl from "../assets/generated/arenas/candle-crypt.png";
import arenaGriddleFoundryUrl from "../assets/generated/arenas/griddle-foundry.png";
import arenaSyrupCanalUrl from "../assets/generated/arenas/syrup-canal.png";
import berryJamShadeSheetUrl from "../assets/generated/enemies/berry-jam-shade/sheet-transparent.png";
import burgerBruiserSheetUrl from "../assets/generated/enemies/burger-bruiser/sheet-transparent.png";
import burgerEmperorSheetUrl from "../assets/generated/enemies/burger-emperor/sheet-transparent.png";
import candleLichSheetUrl from "../assets/generated/enemies/candle-lich/sheet-transparent.png";
import griddleBaronSheetUrl from "../assets/generated/enemies/griddle-baron/sheet-transparent.png";
import syrupMageSheetUrl from "../assets/generated/enemies/syrup-mage/sheet-transparent.png";
import waffleGolemSheetUrl from "../assets/generated/enemies/waffle-golem/sheet-transparent.png";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root");
}

type Mode = "title" | "playing" | "boon" | "won" | "lost";
type ArenaId = "batterGate" | "griddleFoundry" | "syrupCanal" | "candleCrypt" | "burgerBasilica";
type EnemyKind = "burger" | "shade" | "mage" | "golem" | "griddleBoss" | "candleBoss" | "burgerBoss";
type PowerupKind = "heal" | "syrup" | "haste" | "might";
type SpellId = "waffle" | "syrupNova" | "candleSpiral" | "griddleSlam";
type WeaponId = "spatula" | "fork" | "rollingPin";
type TechniqueId =
  | "glassBatter"
  | "syrupScholar"
  | "ironBirthday"
  | "dashChef"
  | "trapwright"
  | "greedyGriddle"
  | "heavyServe"
  | "swiftFrosting";
type Team = "player" | "enemy";
type InputAction = "attack" | "dash" | "special" | "trap";
type InputMode = "pointer" | "touch" | "gamepad";
type BoonId =
  | "batter"
  | "birthday"
  | "burgerDash"
  | "doubleStack"
  | "goldenGrid"
  | "syrup";

type V2 = THREE.Vector2;

declare global {
  interface Window {
    __waffleTest?: {
      previewRoom: (index: number) => void;
      previewPowerups: () => void;
      previewPickup: (kind: PowerupKind) => void;
      previewSpell: (index: number) => void;
      cycleSpell: () => void;
      grantFocusPoint: () => void;
      grantSpellPoint: () => void;
      upgradeSpell: (index: number) => boolean;
      grantWeaponPoint: () => void;
      upgradeWeapon: (index: number) => boolean;
      chooseTechnique: (index: number) => boolean;
      combatTextLabels: () => string[];
      spellState: () => {
        activeIndex: number;
        points: number;
        levels: Record<SpellId, number>;
      };
      weaponState: () => {
        activeIndex: number;
        points: number;
        levels: Record<WeaponId, number>;
      };
      progressionState: () => {
        focusPoints: number;
        techniques: TechniqueId[];
        techniqueSlots: number;
        spellPower: number;
        weaponPower: number;
      };
      inputState: () => {
        mode: Mode;
        pos: { x: number; y: number };
        lastAim: { x: number; y: number };
        spellIndex: number;
        weaponIndex: number;
        attackCooldown: number;
        dashCooldown: number;
        specialCooldown: number;
        trapCooldown: number;
        gamepadActive: boolean;
        gamepadName: string;
        activeInput: InputMode;
        touchButtons: string[];
      };
      roomSummary: () => {
        roomCount: number;
        bossRoomCount: number;
        arenaIds: ArenaId[];
        enemyKinds: EnemyKind[];
        spellIds: SpellId[];
        spellMaxLevel: number;
        weaponIds: WeaponId[];
        weaponMaxLevel: number;
        techniqueIds: TechniqueId[];
        techniqueSlots: number;
        powerupKinds: PowerupKind[];
        roomNames: string[];
      };
    };
  }
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  sprite: THREE.Sprite;
  sheet: SpriteSheetDef;
  pos: V2;
  vel: V2;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  specialTimer: number;
  stun: number;
  phase: number;
  baseScale: number;
  boss: boolean;
}

interface SpriteSheetDef {
  texture: THREE.Texture;
  rows: number;
  cols: number;
  frameCount: number;
  fps: number;
}

interface Projectile {
  sprite: THREE.Sprite;
  pos: V2;
  vel: V2;
  radius: number;
  damage: number;
  team: Team;
  life: number;
  maxLife: number;
  pierce: number;
  spin: number;
  trailColor: string;
  trailTimer: number;
  hitIds: Set<number>;
}

interface Particle {
  sprite: THREE.Sprite;
  pos: V2;
  vel: V2;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
}

interface CombatText {
  element: HTMLDivElement;
  pos: V2;
  vel: V2;
  life: number;
  maxLife: number;
}

interface Trap {
  sprite: THREE.Sprite;
  pos: V2;
  radius: number;
  life: number;
  tick: number;
}

interface Powerup {
  sprite: THREE.Sprite;
  kind: PowerupKind;
  pos: V2;
  vel: V2;
  radius: number;
  life: number;
  phase: number;
}

interface SpellDef {
  id: SpellId;
  name: string;
  sigil: string;
  cooldown: number;
  cast: () => void;
  upgradeLine: (level: number) => string;
}

interface SpellProgress {
  level: number;
}

interface WeaponDef {
  id: WeaponId;
  name: string;
  sigil: string;
  line: string;
  upgradeLine: (level: number) => string;
}

interface WeaponProgress {
  level: number;
}

interface Technique {
  id: TechniqueId;
  name: string;
  line: string;
  apply: () => void;
}

interface RoomPlan {
  name: string;
  subtitle: string;
  arena: ArenaId;
  enemies: EnemyKind[];
}

interface Boon {
  id: BoonId;
  name: string;
  line: string;
  apply: () => void;
}

const css = `
  :root {
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #fff8dc;
  }

  * {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }

  #hud {
    position: fixed;
    inset: 0;
    pointer-events: none;
    color: #fff8dc;
    text-shadow: 0 2px 0 rgba(0, 0, 0, 0.45);
  }

  .topbar {
    position: absolute;
    top: max(14px, env(safe-area-inset-top));
    left: max(14px, env(safe-area-inset-left));
    right: max(14px, env(safe-area-inset-right));
    display: grid;
    grid-template-columns: minmax(190px, 320px) 1fr auto;
    gap: 12px;
    align-items: start;
  }

  .panel {
    background: rgba(24, 22, 29, 0.76);
    border: 1px solid rgba(255, 231, 148, 0.28);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
    backdrop-filter: blur(10px);
  }

  .healthPanel {
    padding: 10px;
    border-radius: 8px;
  }

  .meter {
    height: 16px;
    border-radius: 5px;
    overflow: hidden;
    background: #301f2a;
    border: 1px solid rgba(255, 255, 255, 0.16);
  }

  .meterFill {
    height: 100%;
    width: 100%;
    background: linear-gradient(90deg, #ed4f63, #ffd166);
    transition: width 120ms ease;
  }

  .stats {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 8px;
    font-size: 12px;
    letter-spacing: 0;
    color: #f6e7b1;
  }

  .roomPanel {
    justify-self: center;
    max-width: min(430px, 48vw);
    padding: 10px 14px;
    border-radius: 8px;
    text-align: center;
  }

  .roomName {
    font-size: clamp(16px, 2.2vw, 24px);
    font-weight: 800;
    line-height: 1.05;
  }

  .roomSub {
    margin-top: 4px;
    font-size: 12px;
    color: #d7e7ff;
  }

  .cooldowns {
    justify-self: end;
    display: flex;
    gap: 8px;
  }

  .chip {
    min-width: 68px;
    padding: 9px 10px;
    border-radius: 8px;
    text-align: center;
    font-size: 12px;
    color: #f9eab8;
  }

  .chip b {
    display: block;
    font-size: 15px;
    color: #ffffff;
  }

  .chip span {
    display: block;
    max-width: 92px;
    margin-top: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  #combatLayer {
    position: fixed;
    inset: 0;
    pointer-events: none;
  }

  .floatText {
    position: absolute;
    left: 0;
    top: 0;
    transform: translate(-50%, -50%);
    font-size: 15px;
    font-weight: 900;
    color: #ffffff;
    text-shadow: 0 2px 0 rgba(0, 0, 0, 0.66), 0 0 10px rgba(0, 0, 0, 0.42);
    white-space: nowrap;
    will-change: transform, opacity;
  }

  .spellDeck {
    position: absolute;
    top: max(82px, calc(env(safe-area-inset-top) + 82px));
    right: max(14px, env(safe-area-inset-right));
    width: min(560px, calc(100vw - 28px));
    padding: 8px;
    border-radius: 8px;
    pointer-events: auto;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 7px;
  }

  .spellDeck.isHidden {
    display: none;
  }

  .spellSlot {
    min-width: 0;
    min-height: 64px;
    padding: 8px 9px;
    border: 1px solid rgba(255, 219, 112, 0.2);
    border-radius: 7px;
    background: rgba(24, 22, 31, 0.84);
    color: #f9eab8;
    box-shadow: none;
    text-align: left;
    position: relative;
    overflow: hidden;
  }

  .spellSlot.isActive {
    border-color: rgba(255, 209, 102, 0.86);
    background: rgba(54, 38, 34, 0.9);
  }

  .spellSlot.canUpgrade {
    border-color: rgba(130, 247, 255, 0.76);
  }

  .spellSlot b,
  .spellSlot strong,
  .spellSlot span {
    position: relative;
    z-index: 1;
  }

  .spellSlot b {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    margin-right: 5px;
    border-radius: 50%;
    background: rgba(255, 209, 102, 0.18);
    color: #ffffff;
    font-size: 11px;
  }

  .spellSlot strong {
    display: inline;
    font-size: 12px;
    line-height: 1.1;
    color: #ffffff;
  }

  .spellSlot span {
    display: block;
    margin-top: 7px;
    font-size: 11px;
    color: #d7e7ff;
  }

  .spellSlot em {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
    width: var(--ready, 100%);
    background: #ffd166;
    opacity: 0.78;
  }

  #centerOverlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    padding: 22px;
  }

  .modal {
    pointer-events: auto;
    width: min(720px, calc(100vw - 32px));
    border-radius: 8px;
    padding: clamp(18px, 4vw, 34px);
    text-align: center;
  }

  .title {
    margin: 0;
    font-size: clamp(34px, 7vw, 72px);
    line-height: 0.92;
    letter-spacing: 0;
  }

  .tagline {
    margin: 12px auto 0;
    max-width: 560px;
    color: #e4eeff;
    font-size: clamp(14px, 2vw, 18px);
  }

  .actions {
    margin-top: 22px;
    display: flex;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  button {
    appearance: none;
    border: 0;
    border-radius: 8px;
    background: #ffd166;
    color: #211518;
    font: inherit;
    font-weight: 850;
    padding: 12px 16px;
    cursor: pointer;
    box-shadow: 0 5px 0 #a86325, 0 14px 28px rgba(0, 0, 0, 0.22);
  }

  button:active {
    transform: translateY(3px);
    box-shadow: 0 2px 0 #a86325, 0 8px 18px rgba(0, 0, 0, 0.2);
  }

  .boonGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 20px;
  }

  .boonButton {
    min-height: 146px;
    padding: 16px 14px;
    background: #251d30;
    color: #fff7d1;
    border: 1px solid rgba(255, 219, 112, 0.42);
    box-shadow: 0 5px 0 #6e3c73, 0 16px 24px rgba(0, 0, 0, 0.22);
    text-align: left;
  }

  .boonButton strong {
    display: block;
    margin-bottom: 8px;
    color: #ffd166;
    font-size: 17px;
    line-height: 1.1;
  }

  .boonButton span {
    color: #d7e7ff;
    font-size: 13px;
    line-height: 1.35;
  }

  .spellUpgradePanel,
  .techniquePanel {
    margin-top: 18px;
    text-align: left;
  }

  .weaponUpgradePanel {
    margin-top: 16px;
    text-align: left;
  }

  .spellUpgradeHeader,
  .techniqueHeader,
  .weaponUpgradeHeader {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    color: #fff7d1;
    font-size: 13px;
    font-weight: 800;
  }

  .spellUpgradeGrid,
  .techniqueGrid,
  .weaponUpgradeGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-top: 9px;
  }

  .weaponUpgradeGrid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .techniqueGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .spellUpgradeButton,
  .techniqueButton,
  .weaponUpgradeButton {
    min-height: 112px;
    padding: 11px;
    background: #1c2430;
    color: #fff7d1;
    border: 1px solid rgba(130, 247, 255, 0.38);
    box-shadow: 0 4px 0 #315a62, 0 12px 20px rgba(0, 0, 0, 0.2);
    text-align: left;
  }

  .spellUpgradeButton:disabled,
  .techniqueButton:disabled,
  .weaponUpgradeButton:disabled {
    opacity: 0.46;
    cursor: default;
    transform: none;
  }

  .spellUpgradeButton strong,
  .spellUpgradeButton span,
  .techniqueButton strong,
  .techniqueButton span,
  .weaponUpgradeButton strong,
  .weaponUpgradeButton span {
    display: block;
  }

  .spellUpgradeButton strong,
  .techniqueButton strong,
  .weaponUpgradeButton strong {
    color: #82f7ff;
    font-size: 14px;
    line-height: 1.1;
  }

  .spellUpgradeButton span,
  .techniqueButton span,
  .weaponUpgradeButton span {
    margin-top: 7px;
    color: #d7e7ff;
    font-size: 12px;
    line-height: 1.25;
  }

  #touchControls {
    position: fixed;
    inset: auto 0 max(18px, env(safe-area-inset-bottom)) 0;
    display: none;
    pointer-events: none;
    padding: 0 max(18px, env(safe-area-inset-right)) 0 max(18px, env(safe-area-inset-left));
    justify-content: space-between;
    align-items: end;
    user-select: none;
  }

  #stick {
    pointer-events: auto;
    width: 128px;
    height: 128px;
    border-radius: 50%;
    border: 1px solid rgba(255, 240, 170, 0.28);
    background: rgba(20, 18, 28, 0.58);
    position: relative;
    touch-action: none;
  }

  #knob {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: #ffd166;
    border: 3px solid #fff6c6;
    position: absolute;
    left: 38px;
    top: 38px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  }

  .touchButtons {
    pointer-events: auto;
    display: grid;
    grid-template-columns: repeat(2, 74px);
    gap: 9px;
  }

  .touchButtons button {
    min-height: 58px;
    padding: 9px;
    font-size: 13px;
    touch-action: none;
  }

  .touchButtons button:first-child {
    grid-column: span 2;
  }

  @media (pointer: coarse), (max-width: 760px) {
    #touchControls {
      display: flex;
    }

    .topbar {
      grid-template-columns: 1fr;
      right: max(10px, env(safe-area-inset-right));
      left: max(10px, env(safe-area-inset-left));
      gap: 8px;
    }

    .healthPanel,
    .roomPanel,
    .cooldowns {
      justify-self: stretch;
      max-width: none;
    }

    .cooldowns {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
    }

    .spellDeck {
      top: max(170px, calc(env(safe-area-inset-top) + 170px));
      left: max(10px, env(safe-area-inset-left));
      right: max(10px, env(safe-area-inset-right));
      width: auto;
      padding: 3px;
      gap: 3px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      background: rgba(24, 22, 29, 0.44);
      border-color: rgba(255, 231, 148, 0.14);
      box-shadow: none;
      backdrop-filter: blur(6px);
    }

    .spellSlot {
      min-height: 32px;
      padding: 3px 3px 4px;
      border-radius: 6px;
      text-align: center;
      background: rgba(24, 22, 31, 0.58);
    }

    .spellSlot.isActive {
      background: rgba(54, 38, 34, 0.72);
    }

    .spellSlot b {
      width: 15px;
      height: 15px;
      margin-right: 2px;
      font-size: 8px;
    }

    .spellSlot strong {
      font-size: 9px;
    }

    .spellSlot span {
      margin-top: 2px;
      font-size: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .spellSlot em {
      height: 2px;
    }

    .chip {
      min-width: 0;
      padding: 7px;
    }

    .boonGrid {
      grid-template-columns: 1fr;
    }

    .spellUpgradeGrid {
      grid-template-columns: 1fr;
    }

    .techniqueGrid {
      grid-template-columns: 1fr;
    }

    .weaponUpgradeGrid {
      grid-template-columns: 1fr;
    }

    .modal {
      max-height: calc(100vh - 28px);
      overflow: auto;
    }
  }
`;

const style = document.createElement("style");
style.textContent = css;
document.head.append(style);

const hud = document.createElement("div");
hud.id = "hud";
hud.innerHTML = `
  <div class="topbar">
    <div class="panel healthPanel">
      <div class="meter"><div id="hpFill" class="meterFill"></div></div>
      <div class="stats">
        <span id="hpText">100 / 100</span>
        <span id="scoreText">0 syrup</span>
      </div>
    </div>
    <div class="panel roomPanel">
      <div id="roomName" class="roomName">Sindre's Waffle Adventure</div>
      <div id="roomSub" class="roomSub">Birthday underworld loading...</div>
    </div>
    <div class="cooldowns">
      <div class="panel chip"><b id="attackChip">Ready</b><span id="weaponLabel">Spatula</span></div>
      <div class="panel chip"><b id="dashChip">Ready</b>Dash</div>
      <div class="panel chip"><b id="specialChip">Ready</b><span id="specialLabel">Waffle</span></div>
    </div>
  </div>
  <div id="spellDeck" class="panel spellDeck isHidden"></div>
  <div id="combatLayer"></div>
`;
document.body.append(hud);

const overlay = document.createElement("div");
overlay.id = "centerOverlay";
document.body.append(overlay);

const touch = document.createElement("div");
touch.id = "touchControls";
touch.innerHTML = `
  <div id="stick"><div id="knob"></div></div>
  <div class="touchButtons">
    <button data-act="attack">Strike</button>
    <button data-act="dash">Dash</button>
    <button data-act="special">Special</button>
    <button data-act="trap">Trap</button>
    <button data-act="cycle">Spell</button>
    <button data-act="weapon">Weapon</button>
  </div>
`;
document.body.append(touch);

const hpFill = mustElement<HTMLDivElement>("hpFill");
const hpText = mustElement<HTMLSpanElement>("hpText");
const scoreText = mustElement<HTMLSpanElement>("scoreText");
const roomName = mustElement<HTMLDivElement>("roomName");
const roomSub = mustElement<HTMLDivElement>("roomSub");
const attackChip = mustElement<HTMLSpanElement>("attackChip");
const weaponLabel = mustElement<HTMLSpanElement>("weaponLabel");
const dashChip = mustElement<HTMLSpanElement>("dashChip");
const specialChip = mustElement<HTMLSpanElement>("specialChip");
const specialLabel = mustElement<HTMLSpanElement>("specialLabel");
const spellDeck = mustElement<HTMLDivElement>("spellDeck");
const combatLayer = mustElement<HTMLDivElement>("combatLayer");
const stick = mustElement<HTMLDivElement>("stick");
const knob = mustElement<HTMLDivElement>("knob");

function mustElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing #${id}`);
  }

  return element as T;
}

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute("aria-label", "Sindre's Waffle Adventure game canvas");
app.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#181721");

const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
camera.position.set(0, 0, 20);
camera.lookAt(0, 0, 0);

const arenaGroup = new THREE.Group();
const actorGroup = new THREE.Group();
const fxGroup = new THREE.Group();
scene.add(arenaGroup, actorGroup, fxGroup);

const world = {
  width: 32,
  height: 20,
  halfWidth: 16,
  halfHeight: 10
};

const rooms: RoomPlan[] = [
  {
    name: "The Batter Gate",
    subtitle: "Burger shades smell fresh syrup.",
    arena: "batterGate",
    enemies: ["burger", "burger", "shade", "shade"]
  },
  {
    name: "Syrup Canal",
    subtitle: "Sticky bridges, faster mages, worse decisions.",
    arena: "syrupCanal",
    enemies: ["shade", "mage", "mage", "burger", "shade"]
  },
  {
    name: "Griddle Foundry",
    subtitle: "The waffle irons have started walking.",
    arena: "griddleFoundry",
    enemies: ["golem", "burger", "mage", "shade", "golem"]
  },
  {
    name: "The Griddle Baron's Anvil",
    subtitle: "A furnace knight blocks the birthday table.",
    arena: "griddleFoundry",
    enemies: ["griddleBoss"]
  },
  {
    name: "Candle Crypt",
    subtitle: "Every candle is judging your build.",
    arena: "candleCrypt",
    enemies: ["shade", "mage", "golem", "shade", "mage", "burger"]
  },
  {
    name: "The Candle Lich Vigil",
    subtitle: "Blue flames, melted wax, no refund.",
    arena: "candleCrypt",
    enemies: ["candleBoss"]
  },
  {
    name: "Burger Basilica",
    subtitle: "The royal kitchen throws everything at once.",
    arena: "burgerBasilica",
    enemies: ["burger", "burger", "golem", "mage", "shade", "golem", "mage"]
  },
  {
    name: "The Triple Stack Throne",
    subtitle: "The final hamburger wants the last waffle.",
    arena: "burgerBasilica",
    enemies: ["burgerBoss"]
  }
];

const keys = new Set<string>();
const pointerWorld = new THREE.Vector2(2, -1);
const lastAim = new THREE.Vector2(1, 0);
const moveInput = new THREE.Vector2();
const gamepadMove = new THREE.Vector2();
const gamepadAim = new THREE.Vector2(1, 0);
const previousGamepadButtons = new Set<number>();
const heldActions = new Set<InputAction>();
const tmp = new THREE.Vector2();
const tmp2 = new THREE.Vector2();
let gamepadActive = false;
let gamepadAimActive = false;
let gamepadName = "";
let activeInput: InputMode = "pointer";

const textureLoader = new THREE.TextureLoader();

const heroTexture = loadTexture(heroSheetUrl);
heroTexture.colorSpace = THREE.SRGBColorSpace;
heroTexture.minFilter = THREE.LinearFilter;
heroTexture.magFilter = THREE.LinearFilter;
heroTexture.repeat.set(0.25, 0.25);

const heroMaterial = new THREE.SpriteMaterial({
  map: heroTexture,
  transparent: true,
  depthTest: false
});

const hero = new THREE.Sprite(heroMaterial);
hero.scale.set(1.72, 1.72, 1);
hero.center.set(0.5, 0.28);
hero.renderOrder = 2000;
actorGroup.add(hero);

const arenaTextures: Record<ArenaId, THREE.Texture> = {
  batterGate: loadTexture(arenaBatterGateUrl),
  griddleFoundry: loadTexture(arenaGriddleFoundryUrl),
  syrupCanal: loadTexture(arenaSyrupCanalUrl),
  candleCrypt: loadTexture(arenaCandleCryptUrl),
  burgerBasilica: loadTexture(arenaBurgerBasilicaUrl)
};

const arenaBackdropMaterial = new THREE.MeshBasicMaterial({
  map: arenaTextures.batterGate,
  color: "#ffffff"
});
let arenaBackdrop: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;

const textures = {
  waffle: makeWaffleTexture(),
  slash: makeSlashTexture(),
  syrup: makeSyrupTexture(),
  spark: makeSparkTexture(),
  trap: makeTrapTexture(),
  orb: makeOrbTexture(),
  ring: makeRingTexture(),
  star: makeStarTexture(),
  flame: makeFlameTexture()
};

const enemySheets: Record<EnemyKind, SpriteSheetDef> = {
  burger: makeSpriteSheet(burgerBruiserSheetUrl, 2, 2, 7.5),
  shade: makeSpriteSheet(berryJamShadeSheetUrl, 2, 2, 8.5),
  mage: makeSpriteSheet(syrupMageSheetUrl, 2, 2, 7),
  golem: makeSpriteSheet(waffleGolemSheetUrl, 2, 2, 5.5),
  griddleBoss: makeSpriteSheet(griddleBaronSheetUrl, 3, 3, 6),
  candleBoss: makeSpriteSheet(candleLichSheetUrl, 3, 3, 6.5),
  burgerBoss: makeSpriteSheet(burgerEmperorSheetUrl, 3, 3, 5.8)
};

const enemyStats: Record<EnemyKind, {
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  scale: number;
  score: number;
  boss?: boolean;
}> = {
  burger: { hp: 72, speed: 2.5, radius: 0.58, damage: 12, scale: 1.32, score: 42 },
  shade: { hp: 54, speed: 3.15, radius: 0.5, damage: 9, scale: 1.18, score: 38 },
  mage: { hp: 78, speed: 2.05, radius: 0.56, damage: 10, scale: 1.28, score: 68 },
  golem: { hp: 126, speed: 1.75, radius: 0.72, damage: 15, scale: 1.55, score: 88 },
  griddleBoss: { hp: 420, speed: 1.38, radius: 1.08, damage: 18, scale: 2.65, score: 420, boss: true },
  candleBoss: { hp: 460, speed: 1.56, radius: 1.0, damage: 16, scale: 2.52, score: 480, boss: true },
  burgerBoss: { hp: 560, speed: 1.28, radius: 1.24, damage: 20, scale: 2.95, score: 650, boss: true }
};

const player = {
  pos: new THREE.Vector2(0, -2),
  vel: new THREE.Vector2(),
  radius: 0.58,
  hp: 110,
  maxHp: 110,
  speed: 5.6,
  damage: 24,
  attackRange: 2.35,
  attackCooldown: 0,
  attackRate: 0.34,
  dashCooldown: 0,
  dashTimer: 0,
  dashVel: new THREE.Vector2(),
  dashBurst: false,
  specialCooldown: 0,
  specialRate: 1.65,
  trapCooldown: 0,
  invulnerable: 0,
  score: 0,
  room: 0,
  roomsCleared: 0,
  frameTime: 0,
  facingRow: 0,
  echoStrike: false,
  trapPower: 1,
  syrupPower: 1,
  spellIndex: 0,
  weaponIndex: 0,
  level: 1,
  focusPoints: 0,
  spellPower: 1,
  weaponPower: 1,
  scoreMultiplier: 1,
  dropBonus: 0,
  pickupMagnet: 1,
  healMultiplier: 1,
  trapCooldownBonus: 0,
  dashCooldownMultiplier: 1,
  specialCooldownMultiplier: 1,
  hasteTimer: 0,
  mightTimer: 0
};

const maxSpellLevel = 4;
const maxWeaponLevel = 4;
const techniqueSlots = 3;

const powerupKinds: PowerupKind[] = ["heal", "syrup", "haste", "might"];
const powerupColors: Record<PowerupKind, string> = {
  heal: "#7cffb2",
  syrup: "#ffd166",
  haste: "#82f7ff",
  might: "#ff8bd1"
};

const spellbook: SpellDef[] = [
  {
    id: "waffle",
    name: "Waffle Bolt",
    sigil: "WB",
    cooldown: 1.65,
    cast: castWaffleBolt,
    upgradeLine: (level) => `+${8 + level * 3} damage, deeper pierce`
  },
  {
    id: "syrupNova",
    name: "Syrup Nova",
    sigil: "SN",
    cooldown: 2.15,
    cast: castSyrupNova,
    upgradeLine: (level) => `+${2 + level} bolts, wider burst`
  },
  {
    id: "candleSpiral",
    name: "Candle Spiral",
    sigil: "CS",
    cooldown: 2.35,
    cast: castCandleSpiral,
    upgradeLine: (level) => level >= 3 ? "Max level pierces once" : "+1 flame, modest burn"
  },
  {
    id: "griddleSlam",
    name: "Griddle Slam",
    sigil: "GS",
    cooldown: 2.45,
    cast: castGriddleSlam,
    upgradeLine: (level) => `+${10 + level * 5}% radius and force`
  }
];
const spellProgress: Record<SpellId, SpellProgress> = {
  waffle: { level: 1 },
  syrupNova: { level: 1 },
  candleSpiral: { level: 1 },
  griddleSlam: { level: 1 }
};
let spellDeckSignature = "";

const weaponbook: WeaponDef[] = [
  {
    id: "spatula",
    name: "Birthday Spatula",
    sigil: "SP",
    line: "Wide, reliable arc",
    upgradeLine: (level) => `+${12 + level * 4}% arc damage`
  },
  {
    id: "fork",
    name: "Syrup Fork",
    sigil: "FK",
    line: "Long precise thrust",
    upgradeLine: (level) => `+${10 + level * 5}% thrust reach`
  },
  {
    id: "rollingPin",
    name: "Rolling Pin",
    sigil: "RP",
    line: "Short stun shockwave",
    upgradeLine: (level) => `+${8 + level * 4}% slam radius`
  }
];
const weaponProgress: Record<WeaponId, WeaponProgress> = {
  spatula: { level: 1 },
  fork: { level: 1 },
  rollingPin: { level: 1 }
};

const techniquePool: Technique[] = [
  {
    id: "glassBatter",
    name: "Glass Batter",
    line: "Weapon damage jumps, but maximum health drops.",
    apply: () => {
      player.weaponPower += 0.34;
      player.maxHp = Math.max(70, player.maxHp - 18);
      player.hp = Math.min(player.hp, player.maxHp);
    }
  },
  {
    id: "syrupScholar",
    name: "Syrup Scholar",
    line: "Spells hit and recharge better while strikes soften.",
    apply: () => {
      player.spellPower += 0.28;
      player.specialCooldownMultiplier = Math.max(0.74, player.specialCooldownMultiplier - 0.16);
      player.weaponPower = Math.max(0.72, player.weaponPower - 0.08);
    }
  },
  {
    id: "ironBirthday",
    name: "Iron Birthday",
    line: "Gain a large health pool, but dashes recover slower.",
    apply: () => {
      player.maxHp += 38;
      player.hp += 38;
      player.dashCooldownMultiplier += 0.12;
    }
  },
  {
    id: "dashChef",
    name: "Dash Chef",
    line: "Dashes recover faster and burst, at a health cost.",
    apply: () => {
      player.dashBurst = true;
      player.dashCooldownMultiplier = Math.max(0.68, player.dashCooldownMultiplier - 0.18);
      player.maxHp = Math.max(78, player.maxHp - 12);
      player.hp = Math.min(player.hp, player.maxHp);
    }
  },
  {
    id: "trapwright",
    name: "Trapwright",
    line: "Waffle traps bite more often while spells slow slightly.",
    apply: () => {
      player.trapPower += 0.75;
      player.trapCooldownBonus += 0.65;
      player.specialCooldownMultiplier += 0.08;
    }
  },
  {
    id: "greedyGriddle",
    name: "Greedy Griddle",
    line: "More syrup and drops, but healing is less generous.",
    apply: () => {
      player.scoreMultiplier += 0.32;
      player.dropBonus += 0.12;
      player.healMultiplier = Math.max(0.7, player.healMultiplier - 0.15);
    }
  },
  {
    id: "heavyServe",
    name: "Heavy Serve",
    line: "Weapons hit harder, but movement gets heavier.",
    apply: () => {
      player.weaponPower += 0.24;
      player.speed = Math.max(4.3, player.speed - 0.35);
    }
  },
  {
    id: "swiftFrosting",
    name: "Swift Frosting",
    line: "Move faster and pull pickups in, but spells lose bite.",
    apply: () => {
      player.speed += 0.45;
      player.pickupMagnet += 0.35;
      player.spellPower = Math.max(0.8, player.spellPower - 0.08);
    }
  }
];

let mode: Mode = "title";
let enemyId = 0;
let waveClearTimer = 0;
let shake = 0;
let titlePulse = 0;

const enemies: Enemy[] = [];
const projectiles: Projectile[] = [];
const particles: Particle[] = [];
const combatTexts: CombatText[] = [];
const traps: Trap[] = [];
const powerups: Powerup[] = [];
const boonsOwned = new Set<BoonId>();
const techniquesOwned = new Set<TechniqueId>();

buildArena();
showTitle();
resize();

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "Tab") {
    event.preventDefault();
  }

  if (event.code === "Enter" && (mode === "title" || mode === "won" || mode === "lost")) {
    startGame();
    return;
  }

  keys.add(event.code);

  if (mode !== "playing") {
    return;
  }

  if (event.code === "Space" || event.code === "ShiftLeft" || event.code === "ShiftRight") {
    dash();
  } else if (event.code === "KeyQ" || event.code === "KeyK") {
    special();
  } else if (event.code === "KeyE" || event.code === "KeyL") {
    dropTrap();
  } else if (event.code === "KeyJ") {
    strike();
  } else if (event.code === "KeyR" || event.code === "Tab") {
    cycleSpellSelection(1);
  } else if (event.code === "KeyT") {
    cycleWeaponSelection(1);
  } else if (event.code.startsWith("Digit")) {
    selectSpell(Number(event.code.replace("Digit", "")) - 1);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

renderer.domElement.addEventListener("pointermove", (event) => {
  activeInput = "pointer";
  updatePointer(event.clientX, event.clientY);
});

renderer.domElement.addEventListener("pointerdown", (event) => {
  activeInput = "pointer";
  updatePointer(event.clientX, event.clientY);

  if (mode === "title") {
    startGame();
    return;
  }

  if (mode !== "playing") {
    return;
  }

  if (event.button === 0) {
    strike();
  } else if (event.button === 2) {
    special();
  }
});

renderer.domElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

setupTouchControls();

spellDeck.addEventListener("pointerdown", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest<HTMLButtonElement>("[data-spell-index]");

  if (!button) {
    return;
  }

  event.preventDefault();
  selectSpell(Number(button.dataset.spellIndex ?? 0));
});

window.__waffleTest = {
  previewRoom(index: number): void {
    mode = "playing";
    overlay.innerHTML = "";
    player.pos.set(0, -3);
    player.vel.set(0, 0);
    player.invulnerable = 0;
    spawnRoom(THREE.MathUtils.clamp(Math.floor(index), 0, rooms.length - 1));
    updateHud();
  },
  previewPowerups(): void {
    mode = "playing";
    overlay.innerHTML = "";
    player.pos.set(0, -3);
    clearArray(powerups, removePowerup);

    for (let i = 0; i < powerupKinds.length; i += 1) {
      spawnPowerup(powerupKinds[i]!, player.pos.clone().add(new THREE.Vector2((i - 1.5) * 1.3, 1.6)));
    }

    updateHud();
  },
  previewPickup(kind: PowerupKind): void {
    mode = "playing";
    overlay.innerHTML = "";
    player.pos.set(0, -3);
    applyPowerup(kind);
    updateHud();
  },
  previewSpell(index: number): void {
    mode = "playing";
    overlay.innerHTML = "";
    player.pos.set(0, -3);
    player.specialCooldown = 0;
    selectSpell(index, false);
    activeSpell().cast();
    updateHud();
  },
  cycleSpell(): void {
    cycleSpellSelection(1);
  },
  grantFocusPoint(): void {
    grantFocusPoint();
  },
  grantSpellPoint(): void {
    grantFocusPoint();
  },
  upgradeSpell(index: number): boolean {
    return upgradeSpellAt(index);
  },
  grantWeaponPoint(): void {
    grantFocusPoint();
  },
  upgradeWeapon(index: number): boolean {
    return upgradeWeaponAt(index);
  },
  chooseTechnique(index: number): boolean {
    return chooseTechnique(pickTechniques()[index]);
  },
  combatTextLabels(): string[] {
    return [...combatLayer.querySelectorAll(".floatText")].map((element) => element.textContent ?? "");
  },
  spellState() {
    return {
      activeIndex: player.spellIndex,
      points: player.focusPoints,
      levels: spellLevels()
    };
  },
  weaponState() {
    return {
      activeIndex: player.weaponIndex,
      points: player.focusPoints,
      levels: weaponLevels()
    };
  },
  progressionState() {
    return {
      focusPoints: player.focusPoints,
      techniques: [...techniquesOwned],
      techniqueSlots,
      spellPower: player.spellPower,
      weaponPower: player.weaponPower
    };
  },
  inputState() {
    return {
      mode,
      pos: { x: player.pos.x, y: player.pos.y },
      lastAim: { x: lastAim.x, y: lastAim.y },
      spellIndex: player.spellIndex,
      weaponIndex: player.weaponIndex,
      attackCooldown: player.attackCooldown,
      dashCooldown: player.dashCooldown,
      specialCooldown: player.specialCooldown,
      trapCooldown: player.trapCooldown,
      gamepadActive,
      gamepadName,
      activeInput,
      touchButtons: [...touch.querySelectorAll<HTMLButtonElement>("button[data-act]")].map((button) => button.textContent?.trim() ?? "")
    };
  },
  roomSummary() {
    const arenaIds = [...new Set(rooms.map((room) => room.arena))];
    const enemyKinds = [...new Set(rooms.flatMap((room) => room.enemies))];
    return {
      roomCount: rooms.length,
      bossRoomCount: rooms.filter((room) => room.enemies.some(isBossKind)).length,
      arenaIds,
      enemyKinds,
      spellIds: spellbook.map((spell) => spell.id),
      spellMaxLevel: maxSpellLevel,
      weaponIds: weaponbook.map((weapon) => weapon.id),
      weaponMaxLevel: maxWeaponLevel,
      techniqueIds: techniquePool.map((technique) => technique.id),
      techniqueSlots,
      powerupKinds: [...powerupKinds],
      roomNames: rooms.map((room) => room.name)
    };
  }
};

let last = performance.now();
requestAnimationFrame(loop);

function loop(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  titlePulse += dt;
  updateGamepads();

  if (mode === "playing") {
    updateGame(dt);
  } else {
    updateHeroSprite(dt);
    updateParticles(dt);
    updateCombatTexts(dt);
    updateCamera(dt);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function startGame(): void {
  mode = "playing";
  overlay.innerHTML = "";
  player.pos.set(0, -3);
  player.vel.set(0, 0);
  player.hp = 110;
  player.maxHp = 110;
  player.speed = 5.6;
  player.damage = 24;
  player.attackRange = 2.35;
  player.attackCooldown = 0;
  player.attackRate = 0.34;
  player.dashCooldown = 0;
  player.dashTimer = 0;
  player.specialCooldown = 0;
  player.specialRate = 1.65;
  player.trapCooldown = 0;
  player.invulnerable = 0;
  player.score = 0;
  player.room = 0;
  player.roomsCleared = 0;
  player.frameTime = 0;
  player.facingRow = 0;
  player.echoStrike = false;
  player.dashBurst = false;
  player.trapPower = 1;
  player.syrupPower = 1;
  player.spellIndex = 0;
  player.weaponIndex = 0;
  player.level = 1;
  player.focusPoints = 0;
  player.spellPower = 1;
  player.weaponPower = 1;
  player.scoreMultiplier = 1;
  player.dropBonus = 0;
  player.pickupMagnet = 1;
  player.healMultiplier = 1;
  player.trapCooldownBonus = 0;
  player.dashCooldownMultiplier = 1;
  player.specialCooldownMultiplier = 1;
  player.hasteTimer = 0;
  player.mightTimer = 0;
  resetSpellProgress();
  resetWeaponProgress();
  boonsOwned.clear();
  techniquesOwned.clear();
  heldActions.clear();
  clearArray(enemies, removeEnemy);
  clearArray(projectiles, removeProjectile);
  clearArray(particles, removeParticle);
  clearArray(combatTexts, removeCombatText);
  clearArray(traps, removeTrap);
  clearArray(powerups, removePowerup);
  spawnRoom(0);
  updateHud();
}

function spawnRoom(index: number): void {
  clearArray(enemies, removeEnemy);
  clearArray(projectiles, removeProjectile);
  clearArray(traps, removeTrap);
  clearArray(powerups, removePowerup);
  clearArray(combatTexts, removeCombatText);
  player.room = index;
  waveClearTimer = 0;

  const plan = rooms[index] ?? rooms[0]!;
  setArena(plan.arena);
  roomName.textContent = plan.name;
  roomSub.textContent = plan.subtitle;

  for (let i = 0; i < plan.enemies.length; i += 1) {
    const kind = plan.enemies[i]!;
    const angle = (i / Math.max(plan.enemies.length, 1)) * Math.PI * 2 + randomRange(-0.25, 0.25);
    const radius = isBossKind(kind) ? 0 : randomRange(5.5, 8.4);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius + 1.2;
    spawnEnemy(kind, new THREE.Vector2(x, y));
  }

  for (let i = 0; i < 20; i += 1) {
    spawnParticle(
      new THREE.Vector2(randomRange(-world.halfWidth + 2, world.halfWidth - 2), randomRange(-world.halfHeight + 2, world.halfHeight - 2)),
      new THREE.Vector2(randomRange(-0.4, 0.4), randomRange(0.2, 0.9)),
      randomRange(0.7, 1.2),
      randomRange(0.08, 0.16),
      randomRange(0.01, 0.04),
      "#ffdf7d"
    );
  }
}

function updateGame(dt: number): void {
  updateCooldowns(dt);
  updateInput();
  updateHeldActions();
  updatePlayer(dt);
  updateHeroSprite(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateTraps(dt);
  updatePowerups(dt);
  updateParticles(dt);
  updateCombatTexts(dt);
  updateCamera(dt);
  updateHud();

  if (player.hp <= 0 && mode === "playing") {
    loseGame();
  }

  if (mode === "playing" && enemies.length === 0) {
    waveClearTimer += dt;

    if (waveClearTimer > (powerups.length > 0 ? 1.8 : 0.65)) {
      finishRoom();
    }
  }
}

function updateCooldowns(dt: number): void {
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.specialCooldown = Math.max(0, player.specialCooldown - dt);
  player.trapCooldown = Math.max(0, player.trapCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.hasteTimer = Math.max(0, player.hasteTimer - dt);
  player.mightTimer = Math.max(0, player.mightTimer - dt);
  shake = Math.max(0, shake - dt * 4.5);
}

function updateInput(): void {
  moveInput.set(0, 0);

  if (keys.has("KeyA") || keys.has("ArrowLeft")) {
    moveInput.x -= 1;
  }

  if (keys.has("KeyD") || keys.has("ArrowRight")) {
    moveInput.x += 1;
  }

  if (keys.has("KeyW") || keys.has("ArrowUp")) {
    moveInput.y += 1;
  }

  if (keys.has("KeyS") || keys.has("ArrowDown")) {
    moveInput.y -= 1;
  }

  moveInput.add(touchMove);
  moveInput.add(gamepadMove);

  if (moveInput.lengthSq() > 1) {
    moveInput.normalize();
  }
}

function updateGamepads(): void {
  const gamepad = firstGamepad();

  if (!gamepad) {
    gamepadActive = false;
    gamepadAimActive = false;
    gamepadName = "";
    gamepadMove.set(0, 0);
    previousGamepadButtons.clear();
    if (activeInput === "gamepad") {
      activeInput = "pointer";
    }
    return;
  }

  gamepadActive = true;
  gamepadName = gamepad.id || "Controller";

  const pressed = new Set<number>();
  for (let index = 0; index < gamepad.buttons.length; index += 1) {
    if (gamepadButtonPressed(gamepad, index)) {
      pressed.add(index);
    }
  }

  gamepadMove.set(
    applyStickDeadzone(gamepad.axes[0] ?? 0),
    -applyStickDeadzone(gamepad.axes[1] ?? 0)
  );

  if (gamepadMove.lengthSq() > 1) {
    gamepadMove.normalize();
  }

  gamepadAim.set(
    applyStickDeadzone(gamepad.axes[2] ?? 0),
    -applyStickDeadzone(gamepad.axes[3] ?? 0)
  );
  gamepadAimActive = gamepadAim.lengthSq() > 0.02;

  if (pressed.size > 0 || gamepadMove.lengthSq() > 0.02 || gamepadAimActive) {
    activeInput = "gamepad";
  }

  if (gamepadAimActive) {
    gamepadAim.normalize();
    pointerWorld.copy(player.pos).add(gamepadAim.clone().multiplyScalar(4));
    lastAim.copy(gamepadAim);
  }

  const pressedOnce = (index: number) => pressed.has(index) && !previousGamepadButtons.has(index);

  if (mode === "title" || mode === "won" || mode === "lost") {
    if (pressedOnce(0) || pressedOnce(9)) {
      startGame();
    }

    rememberGamepadButtons(pressed);
    return;
  }

  if (mode !== "playing") {
    rememberGamepadButtons(pressed);
    return;
  }

  if (pressedOnce(0)) {
    performAction("dash");
  }

  if (pressed.has(2) || pressed.has(7)) {
    performAction("attack");
  }

  if (pressed.has(3) || pressed.has(6)) {
    performAction("special");
  }

  if (pressed.has(1)) {
    performAction("trap");
  }

  if (pressedOnce(4) || pressedOnce(15)) {
    cycleSpellSelection(1);
  }

  if (pressedOnce(14)) {
    cycleSpellSelection(-1);
  }

  if (pressedOnce(5) || pressedOnce(12)) {
    cycleWeaponSelection(1);
  }

  if (pressedOnce(13)) {
    cycleWeaponSelection(-1);
  }

  rememberGamepadButtons(pressed);
}

function firstGamepad(): Gamepad | null {
  if (typeof navigator.getGamepads !== "function") {
    return null;
  }

  return [...navigator.getGamepads()].find((gamepad): gamepad is Gamepad => Boolean(gamepad?.connected)) ?? null;
}

function gamepadButtonPressed(gamepad: Gamepad, index: number): boolean {
  const button = gamepad.buttons[index];
  return Boolean(button && (button.pressed || button.value > 0.55));
}

function applyStickDeadzone(value: number): number {
  const deadzone = 0.18;
  const abs = Math.abs(value);

  if (abs < deadzone) {
    return 0;
  }

  return Math.sign(value) * ((abs - deadzone) / (1 - deadzone));
}

function rememberGamepadButtons(pressed: Set<number>): void {
  previousGamepadButtons.clear();

  for (const index of pressed) {
    previousGamepadButtons.add(index);
  }
}

function updateHeldActions(): void {
  if (heldActions.has("attack")) {
    performAction("attack");
  }

  if (heldActions.has("special")) {
    performAction("special");
  }

  if (heldActions.has("trap")) {
    performAction("trap");
  }
}

function performAction(action: InputAction): void {
  if (action === "attack") {
    strike();
  } else if (action === "dash") {
    dash();
  } else if (action === "special") {
    special();
  } else {
    dropTrap();
  }
}

function isInputAction(value: string | undefined): value is InputAction {
  return value === "attack" || value === "dash" || value === "special" || value === "trap";
}

function updatePlayer(dt: number): void {
  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.vel.copy(player.dashVel);
    player.invulnerable = Math.max(player.invulnerable, 0.07);
  } else {
    const haste = player.hasteTimer > 0 ? 1.32 : 1;
    player.vel.copy(moveInput).multiplyScalar(player.speed * haste);
  }

  player.pos.addScaledVector(player.vel, dt);
  keepInArena(player.pos, player.radius);

  if (gamepadAimActive) {
    lastAim.copy(gamepadAim);
  } else if (player.vel.lengthSq() > 0.08) {
    lastAim.copy(player.vel).normalize();
  } else {
    tmp.copy(pointerWorld).sub(player.pos);

    if (tmp.lengthSq() > 0.05) {
      lastAim.copy(tmp.normalize());
    }
  }

  hero.position.set(player.pos.x, player.pos.y, 3);
  hero.renderOrder = renderOrderFor(player.pos.y, 100);
  hero.material.color.set(player.hasteTimer > 0 ? "#d9fff9" : player.mightTimer > 0 ? "#ffe3a6" : "#ffffff");
  hero.material.opacity = player.invulnerable > 0 ? 0.68 + Math.sin(titlePulse * 44) * 0.18 : 1;
}

function updateHeroSprite(dt: number): void {
  const moving = player.vel.lengthSq() > 0.16 || mode !== "playing";
  player.frameTime += dt * (moving ? 9.5 : 3);

  if (Math.abs(lastAim.x) > Math.abs(lastAim.y)) {
    player.facingRow = lastAim.x < 0 ? 1 : 2;
  } else {
    player.facingRow = lastAim.y > 0 ? 3 : 0;
  }

  const col = moving ? Math.floor(player.frameTime) % 4 : 0;
  heroTexture.offset.set(col * 0.25, 1 - (player.facingRow + 1) * 0.25);
  hero.scale.setScalar(mode === "title" ? 1.95 + Math.sin(titlePulse * 2.5) * 0.05 : 1.72);

  if (mode === "title") {
    hero.position.set(0, -1.25 + Math.sin(titlePulse * 2.1) * 0.05, 3);
  }
}

function updateEnemies(dt: number): void {
  for (const enemy of [...enemies]) {
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.specialTimer -= dt;
    enemy.stun = Math.max(0, enemy.stun - dt);
    enemy.phase += dt;

    if (enemy.stun > 0) {
      enemy.pos.addScaledVector(enemy.vel, dt);
      enemy.vel.multiplyScalar(0.86);
      keepInArena(enemy.pos, enemy.radius);
      syncEnemySprite(enemy);
      continue;
    }

    const toPlayer = tmp.copy(player.pos).sub(enemy.pos);
    const distance = Math.max(0.001, toPlayer.length());
    const dir = toPlayer.divideScalar(distance);
    enemy.vel.set(0, 0);

    if (enemy.kind === "mage") {
      const preferred = 5.6;

      if (distance < preferred - 0.8) {
        enemy.vel.addScaledVector(dir, -enemy.speed * 0.9);
      } else if (distance > preferred + 0.8) {
        enemy.vel.addScaledVector(dir, enemy.speed);
      }

      enemy.vel.x += Math.sin(enemy.phase * 2.8) * 0.7;

      if (enemy.specialTimer <= 0) {
        enemy.specialTimer = randomRange(1.25, 2.1);
        enemyShoot(enemy);
      }
    } else if (isBossKind(enemy.kind)) {
      enemy.vel.addScaledVector(dir, distance > 2.6 ? enemy.speed : -enemy.speed * 0.25);

      if (enemy.specialTimer <= 0) {
        enemy.specialTimer = enemy.hp < enemy.maxHp * 0.45 ? 1.15 : 1.9;
        bossAttack(enemy);
      }
    } else {
      const wobble = enemy.kind === "shade" ? Math.sin(enemy.phase * 5 + enemy.id) * 0.9 : Math.sin(enemy.phase * 3) * (enemy.kind === "golem" ? 0.18 : 0.35);
      enemy.vel.addScaledVector(dir, enemy.speed);
      enemy.vel.add(new THREE.Vector2(-dir.y, dir.x).multiplyScalar(wobble));
    }

    avoidCrowd(enemy);
    enemy.pos.addScaledVector(enemy.vel, dt);
    keepInArena(enemy.pos, enemy.radius);

    if (distance < enemy.radius + player.radius + 0.18 && enemy.attackCooldown <= 0) {
      damagePlayer(enemy.damage);
      enemy.attackCooldown = enemy.boss ? 0.7 : 0.95;
      knockEnemy(enemy, dir.clone().multiplyScalar(-2.6));
    }

    syncEnemySprite(enemy);
  }
}

function avoidCrowd(enemy: Enemy): void {
  for (const other of enemies) {
    if (enemy === other) {
      continue;
    }

    const delta = tmp2.copy(enemy.pos).sub(other.pos);
    const distSq = delta.lengthSq();
    const min = enemy.radius + other.radius + 0.2;

    if (distSq > 0.001 && distSq < min * min) {
      enemy.vel.addScaledVector(delta.normalize(), 1.8 / Math.max(0.4, Math.sqrt(distSq)));
    }
  }
}

function updateProjectiles(dt: number): void {
  for (const projectile of [...projectiles]) {
    projectile.life -= dt;
    projectile.pos.addScaledVector(projectile.vel, dt);
    projectile.sprite.position.set(projectile.pos.x, projectile.pos.y, 4);
    projectile.sprite.material.opacity = THREE.MathUtils.clamp(projectile.life / Math.min(projectile.maxLife, 0.35), 0, 1);
    projectile.sprite.material.rotation += projectile.spin * dt;
    projectile.sprite.renderOrder = renderOrderFor(projectile.pos.y, 150);

    if (projectile.trailColor) {
      projectile.trailTimer -= dt;

      if (projectile.trailTimer <= 0) {
        projectile.trailTimer = 0.045;
        spawnParticle(
          projectile.pos.clone(),
          projectile.vel.clone().multiplyScalar(-0.04),
          0.24,
          projectile.radius * 0.55,
          0.02,
          projectile.trailColor,
          textures.spark
        );
      }
    }

    if (Math.abs(projectile.pos.x) > world.halfWidth + 1 || Math.abs(projectile.pos.y) > world.halfHeight + 1 || projectile.life <= 0) {
      removeProjectile(projectile);
      continue;
    }

    if (projectile.team === "player") {
      for (const enemy of [...enemies]) {
        if (projectile.hitIds.has(enemy.id)) {
          continue;
        }

        if (projectile.pos.distanceTo(enemy.pos) < projectile.radius + enemy.radius) {
          projectile.hitIds.add(enemy.id);
          damageEnemy(enemy, projectile.damage, projectile.vel.clone().normalize().multiplyScalar(3.5));
          projectile.pierce -= 1;
          burst(enemy.pos, "#ffd166", 7);

          if (projectile.pierce < 0) {
            removeProjectile(projectile);
            break;
          }
        }
      }
    } else if (projectile.pos.distanceTo(player.pos) < projectile.radius + player.radius) {
      damagePlayer(projectile.damage);
      burst(player.pos, "#a9dcff", 8);
      removeProjectile(projectile);
    }
  }
}

function updateTraps(dt: number): void {
  for (const trap of [...traps]) {
    trap.life -= dt;
    trap.tick -= dt;
    trap.sprite.material.opacity = THREE.MathUtils.clamp(trap.life / 0.4, 0, 1) * 0.82;
    trap.sprite.material.rotation += dt * 1.2;
    trap.sprite.scale.setScalar(2.1 + Math.sin(titlePulse * 6) * 0.08);

    if (trap.tick <= 0) {
      trap.tick = 0.22;

      for (const enemy of enemies) {
        const dist = enemy.pos.distanceTo(trap.pos);

        if (dist < trap.radius + enemy.radius) {
          damageEnemy(enemy, 8 * player.trapPower, tmp.copy(enemy.pos).sub(trap.pos).normalize().multiplyScalar(1.4));
          enemy.stun = Math.max(enemy.stun, 0.08);
        }
      }
    }

    if (trap.life <= 0) {
      removeTrap(trap);
    }
  }
}

function updatePowerups(dt: number): void {
  for (const powerup of [...powerups]) {
    powerup.life -= dt;
    powerup.phase += dt;

    const toPlayer = tmp.copy(player.pos).sub(powerup.pos);
    const distance = Math.max(0.001, toPlayer.length());
    const magnetRange = 4.8 * player.pickupMagnet;

    if (distance < magnetRange) {
      const pull = THREE.MathUtils.lerp(10 * player.pickupMagnet, 2.2, distance / magnetRange);
      powerup.vel.addScaledVector(toPlayer.divideScalar(distance), pull * dt);
    }

    if (powerup.vel.lengthSq() > 42) {
      powerup.vel.setLength(6.5);
    }

    powerup.pos.addScaledVector(powerup.vel, dt);
    powerup.vel.multiplyScalar(0.9);
    keepInArena(powerup.pos, powerup.radius);

    const pulse = 1 + Math.sin(powerup.phase * 7) * 0.08;
    powerup.sprite.position.set(powerup.pos.x, powerup.pos.y + Math.sin(powerup.phase * 4) * 0.12, 5);
    powerup.sprite.scale.setScalar(0.62 * pulse);
    powerup.sprite.material.opacity = THREE.MathUtils.clamp(powerup.life / 0.7, 0, 1);
    powerup.sprite.material.rotation += dt * 1.7;
    powerup.sprite.renderOrder = renderOrderFor(powerup.pos.y, 400);

    if (distance < powerup.radius + player.radius + 0.12) {
      applyPowerup(powerup.kind);
      burst(powerup.pos, powerupColors[powerup.kind], 16);
      spawnShockwave(powerup.pos, powerupColors[powerup.kind], 0.7);
      removePowerup(powerup);
      continue;
    }

    if (powerup.life <= 0) {
      burst(powerup.pos, powerupColors[powerup.kind], 5);
      removePowerup(powerup);
    }
  }
}

function updateParticles(dt: number): void {
  for (const particle of [...particles]) {
    particle.life -= dt;
    particle.pos.addScaledVector(particle.vel, dt);
    particle.vel.multiplyScalar(0.96);
    const t = 1 - particle.life / particle.maxLife;
    const scale = THREE.MathUtils.lerp(particle.startScale, particle.endScale, t);
    particle.sprite.position.set(particle.pos.x, particle.pos.y, 6);
    particle.sprite.scale.setScalar(scale);
    particle.sprite.material.opacity = Math.max(0, 1 - t);
    particle.sprite.renderOrder = 3000;

    if (particle.life <= 0) {
      removeParticle(particle);
    }
  }
}

function updateCombatTexts(dt: number): void {
  for (const text of [...combatTexts]) {
    text.life -= dt;
    text.pos.addScaledVector(text.vel, dt);
    text.vel.multiplyScalar(0.94);
    const t = 1 - text.life / text.maxLife;
    const screen = worldToScreen(text.pos);
    text.element.style.transform = `translate(${screen.x}px, ${screen.y}px) translate(-50%, -50%) scale(${1 + t * 0.16})`;
    text.element.style.opacity = `${Math.max(0, 1 - t)}`;

    if (text.life <= 0) {
      removeCombatText(text);
    }
  }
}

function updateCamera(dt: number): void {
  const targetX = mode === "title" ? 0 : player.pos.x * 0.22;
  const targetY = mode === "title" ? 0 : player.pos.y * 0.22;
  camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 4);
  camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 4);

  if (shake > 0) {
    camera.position.x += randomRange(-shake, shake) * 0.08;
    camera.position.y += randomRange(-shake, shake) * 0.08;
  }
}

function finishRoom(): void {
  player.roomsCleared += 1;
  player.level += 1;
  player.focusPoints += 1;
  player.score += Math.round((75 + player.roomsCleared * 25) * player.scoreMultiplier);
  spawnCombatText(player.pos.clone().add(new THREE.Vector2(0, 1.1)), `LEVEL ${player.level}`, "#82f7ff");

  if (player.room >= rooms.length - 1) {
    winGame();
    return;
  }

  mode = "boon";
  showBoonChoices();
}

function showTitle(): void {
  mode = "title";
  roomName.textContent = "Sindre's Waffle Adventure";
  roomSub.textContent = "A birthday dive through the waffle underworld.";
  overlay.innerHTML = `
    <div class="panel modal">
      <h1 class="title">Sindre's Waffle Adventure</h1>
      <p class="tagline">Waffle shield raised, spatula lit, burger shades incoming.</p>
      <div class="actions">
        <button id="startButton">Begin Run</button>
      </div>
    </div>
  `;
  document.getElementById("startButton")?.addEventListener("click", startGame);
}

function showBoonChoices(choices = pickBoons(), techniqueChoices = pickTechniques(), techniqueLocked = false): void {
  roomName.textContent = "Birthday Boon";
  roomSub.textContent = `Level ${player.level} · ${player.focusPoints} focus · ${techniquesOwned.size}/${techniqueSlots} techniques`;
  overlay.innerHTML = `
    <div class="panel modal">
      <h2 class="title" style="font-size: clamp(28px, 5vw, 48px)">Waffle Blessing</h2>
      <p class="tagline">The griddle glows with questionable generosity.</p>
      <div class="techniquePanel">
        <div class="techniqueHeader">
          <span>Techniques</span>
          <span>${techniquesOwned.size}/${techniqueSlots} slots</span>
        </div>
        <div class="techniqueGrid">
          ${techniqueChoices.map((technique, index) => renderTechniqueButton(technique, index, techniqueLocked)).join("")}
        </div>
      </div>
      <div class="weaponUpgradePanel">
        <div class="weaponUpgradeHeader">
          <span>Weapon Training</span>
          <span>${player.focusPoints} focus</span>
        </div>
        <div class="weaponUpgradeGrid">
          ${weaponbook.map((weapon, index) => renderWeaponUpgradeButton(weapon, index)).join("")}
        </div>
      </div>
      <div class="spellUpgradePanel">
        <div class="spellUpgradeHeader">
          <span>Spell Upgrades</span>
          <span>${player.focusPoints} focus</span>
        </div>
        <div class="spellUpgradeGrid">
          ${spellbook.map((spell, index) => renderSpellUpgradeButton(spell, index)).join("")}
        </div>
      </div>
      <div class="boonGrid">
        ${choices.map((boon, index) => `
          <button class="boonButton" data-boon="${index}">
            <strong>${boon.name}</strong>
            <span>${boon.line}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  overlay.querySelectorAll<HTMLButtonElement>("[data-technique]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.technique ?? 0);

      if (!techniqueLocked && chooseTechnique(techniqueChoices[index])) {
        showBoonChoices(choices, techniqueChoices, true);
      }
    });
  });

  overlay.querySelectorAll<HTMLButtonElement>("[data-weapon-upgrade]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.weaponUpgrade ?? 0);

      if (upgradeWeaponAt(index)) {
        showBoonChoices(choices, techniqueChoices, techniqueLocked);
      }
    });
  });

  overlay.querySelectorAll<HTMLButtonElement>("[data-spell-upgrade]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.spellUpgrade ?? 0);

      if (upgradeSpellAt(index)) {
        showBoonChoices(choices, techniqueChoices, techniqueLocked);
      }
    });
  });

  overlay.querySelectorAll<HTMLButtonElement>("[data-boon]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.boon ?? 0);
      const boon = choices[index];

      if (!boon) {
        return;
      }

      boon.apply();
      boonsOwned.add(boon.id);
      mode = "playing";
      overlay.innerHTML = "";
      player.hp = Math.min(player.maxHp, player.hp + 18);
      spawnRoom(player.room + 1);
    });
  });
}

function renderTechniqueButton(technique: Technique, index: number, locked: boolean): string {
  const owned = techniquesOwned.has(technique.id);
  const capped = techniquesOwned.size >= techniqueSlots;
  const state = owned ? "Chosen" : locked ? "Locked" : capped ? "Slots full" : "Pick";

  return `
    <button class="techniqueButton" data-technique="${index}" ${owned || capped || locked ? "disabled" : ""}>
      <strong>${technique.name}</strong>
      <span>${state}</span>
      <span>${technique.line}</span>
    </button>
  `;
}

function renderSpellUpgradeButton(spell: SpellDef, index: number): string {
  const progress = spellProgress[spell.id];
  const cost = spellUpgradeCost(spell.id);
  const capped = progress.level >= maxSpellLevel;
  const affordable = player.focusPoints >= cost;
  const disabled = capped || !affordable;
  const nextLevel = Math.min(maxSpellLevel, progress.level + 1);
  const state = capped ? "Max" : `Lv ${progress.level} -> ${nextLevel}`;
  const price = capped ? "Complete" : `${cost} focus`;

  return `
    <button class="spellUpgradeButton" data-spell-upgrade="${index}" ${disabled ? "disabled" : ""}>
      <strong>${spell.name}</strong>
      <span>${state} · ${price}</span>
      <span>${spell.upgradeLine(progress.level)}</span>
    </button>
  `;
}

function renderWeaponUpgradeButton(weapon: WeaponDef, index: number): string {
  const progress = weaponProgress[weapon.id];
  const cost = weaponUpgradeCost(weapon.id);
  const capped = progress.level >= maxWeaponLevel;
  const affordable = player.focusPoints >= cost;
  const disabled = capped || !affordable;
  const nextLevel = Math.min(maxWeaponLevel, progress.level + 1);
  const state = capped ? "Max" : `Lv ${progress.level} -> ${nextLevel}`;
  const price = capped ? "Complete" : `${cost} focus`;

  return `
    <button class="weaponUpgradeButton" data-weapon-upgrade="${index}" ${disabled ? "disabled" : ""}>
      <strong>${weapon.name}</strong>
      <span>${weapon.line}</span>
      <span>${state} · ${price}</span>
      <span>${weapon.upgradeLine(progress.level)}</span>
    </button>
  `;
}

function winGame(): void {
  mode = "won";
  overlay.innerHTML = `
    <div class="panel modal">
      <h1 class="title">Happy Birthday, Sindre!</h1>
      <p class="tagline">The last hamburger yielded. The waffles are safe. Syrup score: ${player.score}.</p>
      <div class="actions"><button id="restartButton">Run Again</button></div>
    </div>
  `;
  document.getElementById("restartButton")?.addEventListener("click", startGame);
  roomName.textContent = "Victory Feast";
  roomSub.textContent = "The birthday table is defended.";
}

function loseGame(): void {
  mode = "lost";
  overlay.innerHTML = `
    <div class="panel modal">
      <h1 class="title">The Burger Stack Wins</h1>
      <p class="tagline">Sindre can still claim the rematch waffle. Syrup score: ${player.score}.</p>
      <div class="actions"><button id="retryButton">Try Again</button></div>
    </div>
  `;
  document.getElementById("retryButton")?.addEventListener("click", startGame);
  roomName.textContent = "Run Over";
  roomSub.textContent = "The griddle waits for another attempt.";
}

function pickBoons(): Boon[] {
  const pool: Boon[] = [
    {
      id: "batter",
      name: "Crisp Batter",
      line: "Strikes hit harder and leave a warmer crunch.",
      apply: () => {
        player.damage += 8;
      }
    },
    {
      id: "birthday",
      name: "Birthday Candle",
      line: "Maximum health rises and the flame patches you up.",
      apply: () => {
        player.maxHp += 22;
        player.hp += 34;
      }
    },
    {
      id: "burgerDash",
      name: "Burger Momentum",
      line: "Dashes burst through nearby enemies.",
      apply: () => {
        player.dashBurst = true;
      }
    },
    {
      id: "doubleStack",
      name: "Double Stack",
      line: "Every strike echoes with a second small hit.",
      apply: () => {
        player.echoStrike = true;
      }
    },
    {
      id: "goldenGrid",
      name: "Golden Grid",
      line: "Waffle traps last longer and bite harder.",
      apply: () => {
        player.trapPower += 0.65;
      }
    },
    {
      id: "syrup",
      name: "Syrup Current",
      line: "Special waffles recharge faster and pierce deeper.",
      apply: () => {
        player.specialRate = Math.max(0.8, player.specialRate - 0.32);
        player.syrupPower += 0.55;
      }
    }
  ];

  const shuffled = pool
    .filter((boon) => boon.id === "batter" || boon.id === "birthday" || !boonsOwned.has(boon.id))
    .sort(() => Math.random() - 0.5);

  return shuffled.slice(0, 3);
}

function pickTechniques(): Technique[] {
  if (techniquesOwned.size >= techniqueSlots) {
    return [];
  }

  return techniquePool
    .filter((technique) => !techniquesOwned.has(technique.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);
}

function chooseTechnique(technique: Technique | undefined): boolean {
  if (!technique || techniquesOwned.has(technique.id) || techniquesOwned.size >= techniqueSlots) {
    return false;
  }

  technique.apply();
  techniquesOwned.add(technique.id);
  spawnCombatText(player.pos.clone().add(new THREE.Vector2(0, 0.95)), technique.name.toUpperCase(), "#ff8bd1");
  updateHud();
  return true;
}

function updateHud(): void {
  const hpPercent = Math.max(0, player.hp / player.maxHp);
  hpFill.style.width = `${Math.round(hpPercent * 100)}%`;
  hpText.textContent = `${Math.ceil(Math.max(0, player.hp))} / ${player.maxHp}`;
  scoreText.textContent = `Lv ${player.level} · ${player.score} syrup${player.focusPoints > 0 ? ` · ${player.focusPoints} FP` : ""}${techniquesOwned.size > 0 ? ` · ${techniquesOwned.size}/${techniqueSlots} tech` : ""}`;
  attackChip.textContent = player.attackCooldown <= 0 ? "Ready" : player.attackCooldown.toFixed(1);
  weaponLabel.textContent = activeWeapon().name;
  dashChip.textContent = player.dashCooldown <= 0 ? "Ready" : player.dashCooldown.toFixed(1);
  specialChip.textContent = player.specialCooldown <= 0 ? "Ready" : player.specialCooldown.toFixed(1);
  specialLabel.textContent = activeSpell().name;
  updateSpellDeck();
}

function updateSpellDeck(): void {
  const hidden = mode === "title" || mode === "won" || mode === "lost";
  spellDeck.classList.toggle("isHidden", hidden);

  if (hidden) {
    return;
  }

  const cooldownReady = player.specialCooldown <= 0;
  const signature = [
    player.spellIndex,
    player.focusPoints,
    cooldownReady ? "ready" : player.specialCooldown.toFixed(1),
    ...spellbook.map((spell) => spellProgress[spell.id].level)
  ].join("|");

  if (signature === spellDeckSignature) {
    return;
  }

  spellDeckSignature = signature;
  spellDeck.innerHTML = spellbook.map((spell, index) => {
    const active = index === player.spellIndex;
    const progress = spellProgress[spell.id];
    const canUpgrade = canUpgradeSpell(spell.id);
    const cooldownFill = active && !cooldownReady
      ? `${THREE.MathUtils.clamp(1 - player.specialCooldown / spellCooldown(spell), 0, 1) * 100}%`
      : "100%";
    const state = active && !cooldownReady ? player.specialCooldown.toFixed(1) : `Lv ${progress.level}`;

    return `
      <button class="spellSlot ${active ? "isActive" : ""} ${canUpgrade ? "canUpgrade" : ""}" data-spell-index="${index}" style="--ready: ${cooldownFill}">
        <b>${index + 1}</b><strong>${spell.sigil}</strong>
        <span>${spell.name} · ${state}</span>
        <em></em>
      </button>
    `;
  }).join("");
}

function strike(): void {
  if (mode !== "playing" || player.attackCooldown > 0) {
    return;
  }

  const aim = aimDirection();
  lastAim.copy(aim);
  const weapon = activeWeapon();
  player.attackCooldown = weaponCooldown(weapon.id);

  if (weapon.id === "fork") {
    strikeFork(aim);
  } else if (weapon.id === "rollingPin") {
    strikeRollingPin(aim);
  } else {
    strikeSpatula(aim);
  }
}

function strikeSpatula(aim: V2): void {
  const level = weaponLevel("spatula");
  const origin = player.pos.clone().addScaledVector(aim, 0.25);
  spawnSlash(origin, aim, 1 + level * 0.03);
  const damage = strikeDamage(1 + level * 0.16);
  const range = player.attackRange + level * 0.14;
  let hit = false;

  for (const enemy of [...enemies]) {
    const delta = tmp.copy(enemy.pos).sub(player.pos);

    if (delta.length() <= range + enemy.radius && delta.normalize().dot(aim) > 0.42) {
      hit = true;
      damageEnemy(enemy, damage, aim.clone().multiplyScalar(4.6));

      if (player.echoStrike) {
        window.setTimeout(() => {
          if (mode === "playing" && enemies.includes(enemy)) {
            damageEnemy(enemy, damage * 0.38, aim.clone().multiplyScalar(2));
            spawnSlash(enemy.pos.clone(), aim, 0.58);
          }
        }, 90);
      }
    }
  }

  if (hit) {
    shake = Math.max(shake, 0.18);
  }
}

function strikeFork(aim: V2): void {
  const level = weaponLevel("fork");
  const origin = player.pos.clone().addScaledVector(aim, 0.55);
  spawnSlash(origin, aim, 0.62);
  const damage = strikeDamage(1.16 + level * 0.17);
  const range = 2.85 + level * 0.24;
  let hit = false;

  for (const enemy of [...enemies]) {
    const delta = tmp.copy(enemy.pos).sub(player.pos);

    if (delta.length() <= range + enemy.radius && delta.normalize().dot(aim) > 0.74) {
      hit = true;
      damageEnemy(enemy, damage, aim.clone().multiplyScalar(6.2));
    }
  }

  if (hit) {
    shake = Math.max(shake, 0.16);
  }
}

function strikeRollingPin(aim: V2): void {
  const level = weaponLevel("rollingPin");
  const radius = 1.45 + level * 0.18;
  spawnShockwave(player.pos, "#d7e7ff", 0.58 + level * 0.08);
  spawnSlash(player.pos.clone(), aim, 0.72);
  const damage = strikeDamage(0.62 + level * 0.12);
  let hit = false;

  for (const enemy of [...enemies]) {
    const delta = tmp.copy(enemy.pos).sub(player.pos);
    const dist = delta.length();

    if (dist <= radius + enemy.radius) {
      hit = true;
      damageEnemy(enemy, damage, delta.normalize().multiplyScalar(3.3 + level * 0.45));
      enemy.stun = Math.max(enemy.stun, 0.16 + level * 0.035);
    }
  }

  if (hit) {
    shake = Math.max(shake, 0.24);
  }
}

function strikeDamage(multiplier: number): number {
  return player.damage * player.weaponPower * (player.mightTimer > 0 ? 1.35 : 1) * multiplier;
}

function weaponCooldown(id: WeaponId): number {
  const level = weaponLevel(id);

  if (id === "fork") {
    return Math.max(0.26, 0.46 - level * 0.025);
  }

  if (id === "rollingPin") {
    return Math.max(0.34, 0.58 - level * 0.03);
  }

  return Math.max(0.24, player.attackRate - level * 0.015);
}

function dash(): void {
  if (mode !== "playing" || player.dashCooldown > 0) {
    return;
  }

  const dir = moveInput.lengthSq() > 0.04 ? moveInput.clone().normalize() : aimDirection();
  player.dashTimer = 0.16;
  player.dashVel.copy(dir).multiplyScalar(18);
  player.dashCooldown = 0.85 * player.dashCooldownMultiplier;
  player.invulnerable = 0.22;
  lastAim.copy(dir);
  burst(player.pos, "#a7f3d0", 12);

  if (player.dashBurst) {
    for (const enemy of enemies) {
      if (enemy.pos.distanceTo(player.pos) < 2.5 + enemy.radius) {
        damageEnemy(enemy, 18, tmp.copy(enemy.pos).sub(player.pos).normalize().multiplyScalar(5));
      }
    }
  }
}

function activeSpell(): SpellDef {
  return spellbook[player.spellIndex % spellbook.length] ?? spellbook[0]!;
}

function activeWeapon(): WeaponDef {
  return weaponbook[player.weaponIndex % weaponbook.length] ?? weaponbook[0]!;
}

function weaponLevel(id: WeaponId): number {
  return weaponProgress[id].level;
}

function weaponLevels(): Record<WeaponId, number> {
  return {
    spatula: weaponProgress.spatula.level,
    fork: weaponProgress.fork.level,
    rollingPin: weaponProgress.rollingPin.level
  };
}

function resetWeaponProgress(): void {
  for (const weapon of weaponbook) {
    weaponProgress[weapon.id].level = 1;
  }
}

function grantFocusPoint(): void {
  player.focusPoints += 1;
  spellDeckSignature = "";
  updateHud();
}

function weaponUpgradeCost(id: WeaponId): number {
  return weaponProgress[id].level;
}

function canUpgradeWeapon(id: WeaponId): boolean {
  return weaponProgress[id].level < maxWeaponLevel && player.focusPoints >= weaponUpgradeCost(id);
}

function upgradeWeaponAt(index: number): boolean {
  const weapon = weaponbook[index];

  if (!weapon || !canUpgradeWeapon(weapon.id)) {
    return false;
  }

  const cost = weaponUpgradeCost(weapon.id);
  player.focusPoints -= cost;
  weaponProgress[weapon.id].level += 1;
  player.weaponIndex = index;
  spawnCombatText(player.pos.clone().add(new THREE.Vector2(0, 0.9)), `${weapon.sigil} LV ${weaponProgress[weapon.id].level}`, "#82f7ff");
  updateHud();
  return true;
}

function selectWeapon(index: number, showFx = true): void {
  if (!Number.isFinite(index) || index < 0 || index >= weaponbook.length) {
    return;
  }

  player.weaponIndex = index;

  if (showFx && mode === "playing") {
    spawnCombatText(player.pos.clone().add(new THREE.Vector2(0, 0.65)), activeWeapon().sigil, "#ffd166");
  }

  updateHud();
}

function cycleWeaponSelection(direction: number): void {
  const next = (player.weaponIndex + direction + weaponbook.length) % weaponbook.length;
  selectWeapon(next);
}

function spellLevel(id: SpellId): number {
  return spellProgress[id].level;
}

function spellLevels(): Record<SpellId, number> {
  return {
    waffle: spellProgress.waffle.level,
    syrupNova: spellProgress.syrupNova.level,
    candleSpiral: spellProgress.candleSpiral.level,
    griddleSlam: spellProgress.griddleSlam.level
  };
}

function resetSpellProgress(): void {
  for (const spell of spellbook) {
    spellProgress[spell.id].level = 1;
  }

  spellDeckSignature = "";
}

function spellUpgradeCost(id: SpellId): number {
  return spellProgress[id].level;
}

function canUpgradeSpell(id: SpellId): boolean {
  return spellProgress[id].level < maxSpellLevel && player.focusPoints >= spellUpgradeCost(id);
}

function upgradeSpellAt(index: number): boolean {
  const spell = spellbook[index];

  if (!spell || !canUpgradeSpell(spell.id)) {
    return false;
  }

  const cost = spellUpgradeCost(spell.id);
  player.focusPoints -= cost;
  spellProgress[spell.id].level += 1;
  player.spellIndex = index;
  spellDeckSignature = "";
  burst(player.pos, "#82f7ff", 12);
  updateHud();
  return true;
}

function selectSpell(index: number, showFx = true): void {
  if (!Number.isFinite(index) || index < 0 || index >= spellbook.length) {
    return;
  }

  player.spellIndex = index;

  if (showFx && mode === "playing") {
    burst(player.pos, "#d7e7ff", 5);
  }

  updateHud();
}

function cycleSpellSelection(direction: number): void {
  const next = (player.spellIndex + direction + spellbook.length) % spellbook.length;
  selectSpell(next);
}

function spellCooldown(spell: SpellDef): number {
  return Math.max(0.55, spell.cooldown * (player.specialRate / 1.65) * player.specialCooldownMultiplier);
}

function spellDamage(amount: number): number {
  return amount * player.syrupPower * player.spellPower;
}

function special(): void {
  if (mode !== "playing" || player.specialCooldown > 0) {
    return;
  }

  const spell = activeSpell();
  spell.cast();
  player.specialCooldown = spellCooldown(spell);
  updateHud();
}

function castWaffleBolt(): void {
  const level = spellLevel("waffle");
  const dir = aimDirection();
  lastAim.copy(dir);
  createProjectile({
    texture: textures.waffle,
    pos: player.pos.clone().addScaledVector(dir, 0.7),
    vel: dir.multiplyScalar(9.8),
    radius: 0.48,
    scale: 0.82 + level * 0.04,
    damage: spellDamage(28 + level * 8),
    team: "player",
    life: 1.65,
    pierce: Math.floor(1 + player.syrupPower + level * 0.45),
    spin: 9,
    color: "#fff3a4",
    trailColor: "#ffd166"
  });
  burst(player.pos, "#ffd166", 9);
}

function castSyrupNova(): void {
  const level = spellLevel("syrupNova");
  const count = 9 + level * 3;

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + titlePulse * 0.35;
    const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    createProjectile({
      texture: textures.syrup,
      pos: player.pos.clone().addScaledVector(dir, 0.55),
      vel: dir.multiplyScalar(6.8),
      radius: 0.32,
      scale: 0.48 + level * 0.03,
      damage: spellDamage(14 + level * 4),
      team: "player",
      life: 1.2 + level * 0.12,
      pierce: level >= 3 ? 1 : 0,
      spin: 7,
      color: "#ff9a5f",
      trailColor: "#ffcf70"
    });
  }

  spawnShockwave(player.pos, "#ffb65c", 1.05);
  burst(player.pos, "#ffcf70", 18);
  shake = Math.max(shake, 0.22);
}

function castCandleSpiral(): void {
  const level = spellLevel("candleSpiral");
  const aim = aimDirection();
  lastAim.copy(aim);
  const base = Math.atan2(aim.y, aim.x);
  const count = 4 + level;
  const middle = (count - 1) / 2;

  for (let i = 0; i < count; i += 1) {
    const spread = (i - middle) * 0.19;
    const angle = base + spread;
    const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    createProjectile({
      texture: textures.flame,
      pos: player.pos.clone().addScaledVector(dir, 0.65),
      vel: dir.multiplyScalar(6.6 + i * 0.12),
      radius: 0.36,
      scale: 0.48 + level * 0.03,
      damage: spellDamage(10 + level * 3),
      team: "player",
      life: 1.1 + level * 0.12,
      pierce: level >= 4 ? 1 : 0,
      spin: i % 2 === 0 ? 6 : -6,
      color: i % 2 === 0 ? "#9be7ff" : "#ffd166",
      trailColor: i % 2 === 0 ? "#8bdcff" : "#ffe08a"
    });
  }

  burst(player.pos, "#a9dcff", 12);
}

function castGriddleSlam(): void {
  const level = spellLevel("griddleSlam");
  const radius = 2.95 + level * 0.42 + player.syrupPower * 0.25;
  spawnShockwave(player.pos, "#ff8066", 1.2 + level * 0.18);
  burst(player.pos, "#ffb86b", 18 + level * 6);
  shake = Math.max(shake, 0.42);

  for (const enemy of [...enemies]) {
    const delta = enemy.pos.clone().sub(player.pos);
    const dist = Math.max(0.001, delta.length());

    if (dist <= radius + enemy.radius) {
      const falloff = THREE.MathUtils.clamp(1 - dist / (radius + enemy.radius), 0.35, 1);
      damageEnemy(enemy, spellDamage(26 + level * 10) * falloff, delta.divideScalar(dist).multiplyScalar(4.8 + level * 0.7));
    }
  }
}

function dropTrap(): void {
  if (mode !== "playing" || player.trapCooldown > 0) {
    return;
  }

  const material = new THREE.SpriteMaterial({
    map: textures.trap,
    transparent: true,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(player.pos.x, player.pos.y, 1.5);
  sprite.scale.setScalar(2.1);
  sprite.renderOrder = 50;
  fxGroup.add(sprite);
  traps.push({
    sprite,
    pos: player.pos.clone(),
    radius: 1.55,
    life: 3.5 + player.trapPower,
    tick: 0.05
  });
  player.trapCooldown = Math.max(1.4, 2.9 - player.trapCooldownBonus);
}

function damageEnemy(enemy: Enemy, amount: number, knockback: V2): void {
  enemy.hp -= amount;
  enemy.vel.add(knockback);
  enemy.stun = Math.max(enemy.stun, enemy.boss ? 0.08 : 0.16);
  enemy.sprite.scale.multiplyScalar(1.04);
  spawnCombatText(enemy.pos.clone().add(new THREE.Vector2(randomRange(-0.25, 0.25), 0.6)), `${Math.ceil(amount)}`, enemy.boss ? "#ffb86b" : "#fff2a8");
  burst(enemy.pos, enemy.boss ? "#ff7d66" : "#ffd166", enemy.boss ? 10 : 6);

  if (enemy.hp <= 0) {
    const score = Math.round(enemyStats[enemy.kind].score * player.scoreMultiplier);
    player.score += score;
    spawnCombatText(enemy.pos.clone().add(new THREE.Vector2(0, 1)), `+${score} syrup`, "#ffd166");
    burst(enemy.pos, "#fff2a8", enemy.boss ? 34 : 16);
    maybeDropPowerup(enemy);
    removeEnemy(enemy);
  }
}

function maybeDropPowerup(enemy: Enemy): void {
  if (enemy.boss) {
    spawnPowerup("heal", enemy.pos.clone().add(new THREE.Vector2(-0.7, 0.35)));
    spawnPowerup(randomBuffPowerup(), enemy.pos.clone().add(new THREE.Vector2(0.7, 0.35)));
    return;
  }

  const wounded = player.hp < player.maxHp * 0.58;
  const dropChance = Math.min(0.62, (wounded ? 0.42 : 0.3) + player.dropBonus);

  if (Math.random() > dropChance) {
    return;
  }

  const roll = Math.random();
  const kind: PowerupKind = wounded && roll < 0.48
    ? "heal"
    : roll < 0.64
      ? "syrup"
      : roll < 0.82
        ? "haste"
        : "might";
  spawnPowerup(kind, enemy.pos.clone());
}

function randomBuffPowerup(): PowerupKind {
  const buffs: PowerupKind[] = ["syrup", "haste", "might"];
  return buffs[Math.floor(Math.random() * buffs.length)] ?? "syrup";
}

function spawnPowerup(kind: PowerupKind, pos: V2): void {
  const angle = randomRange(0, Math.PI * 2);
  const material = new THREE.SpriteMaterial({
    map: textures.orb,
    transparent: true,
    depthTest: false,
    color: powerupColors[kind]
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(pos.x, pos.y, 5);
  sprite.scale.setScalar(0.62);
  sprite.renderOrder = 2400;
  fxGroup.add(sprite);
  powerups.push({
    sprite,
    kind,
    pos,
    vel: new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(randomRange(1.5, 2.9)),
    radius: 0.45,
    life: 8.5,
    phase: randomRange(0, Math.PI * 2)
  });
  spawnParticle(pos.clone(), new THREE.Vector2(), 0.34, 0.22, 0.02, powerupColors[kind], textures.star);
}

function applyPowerup(kind: PowerupKind): void {
  if (kind === "heal") {
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + Math.round(32 * player.healMultiplier));
    spawnCombatText(player.pos.clone().add(new THREE.Vector2(0, 0.9)), `HEAL +${Math.ceil(player.hp - before)}`, powerupColors[kind]);
  } else if (kind === "syrup") {
    player.specialCooldown = Math.max(0, player.specialCooldown - 0.85);
    player.score += Math.round(25 * player.scoreMultiplier);
    spawnCombatText(player.pos.clone().add(new THREE.Vector2(0, 0.9)), "SPELL CHARGE", powerupColors[kind]);
  } else if (kind === "haste") {
    player.hasteTimer = Math.max(player.hasteTimer, 6.2);
    player.dashCooldown = Math.max(0, player.dashCooldown - 0.25);
    spawnCombatText(player.pos.clone().add(new THREE.Vector2(0, 0.9)), "HASTE", powerupColors[kind]);
  } else if (kind === "might") {
    player.mightTimer = Math.max(player.mightTimer, 6.8);
    player.attackCooldown = Math.max(0, player.attackCooldown - 0.18);
    spawnCombatText(player.pos.clone().add(new THREE.Vector2(0, 0.9)), "MIGHT", powerupColors[kind]);
  }

  updateHud();
}

function damagePlayer(amount: number): void {
  if (player.invulnerable > 0 || mode !== "playing") {
    return;
  }

  player.hp -= amount;
  spawnCombatText(player.pos.clone().add(new THREE.Vector2(0, 0.78)), `-${Math.ceil(amount)}`, "#ff8aa0");
  player.invulnerable = 0.62;
  shake = Math.max(shake, 0.32);
  burst(player.pos, "#ff6f8f", 12);
}

function knockEnemy(enemy: Enemy, force: V2): void {
  enemy.vel.add(force);
  enemy.stun = Math.max(enemy.stun, 0.14);
}

function aimDirection(): V2 {
  if ((activeInput === "gamepad" && !gamepadAimActive) || (activeInput === "touch" && touchMove.lengthSq() < 0.04)) {
    const assisted = nearestEnemyDirection();

    if (assisted) {
      lastAim.copy(assisted);
      pointerWorld.copy(player.pos).add(assisted.clone().multiplyScalar(4));
      return assisted;
    }
  }

  const aim = tmp.copy(pointerWorld).sub(player.pos);

  if (aim.lengthSq() < 0.08) {
    aim.copy(lastAim);
  }

  return aim.normalize().clone();
}

function nearestEnemyDirection(): V2 | null {
  let target: Enemy | null = null;
  let bestDistanceSq = Infinity;

  for (const enemy of enemies) {
    const distanceSq = enemy.pos.distanceToSquared(player.pos);

    if (distanceSq < bestDistanceSq) {
      target = enemy;
      bestDistanceSq = distanceSq;
    }
  }

  if (!target || bestDistanceSq > 13 * 13) {
    return null;
  }

  return target.pos.clone().sub(player.pos).normalize();
}

function spawnEnemy(kind: EnemyKind, pos: V2): Enemy {
  const stats = enemyStats[kind];
  const sheet = enemySheets[kind];
  const map = sheet.texture.clone();
  map.repeat.set(1 / sheet.cols, 1 / sheet.rows);
  map.offset.set(0, 1 - 1 / sheet.rows);
  map.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(stats.scale);
  sprite.center.set(0.5, 0.36);
  actorGroup.add(sprite);

  const enemy: Enemy = {
    id: ++enemyId,
    kind,
    sprite,
    sheet,
    pos,
    vel: new THREE.Vector2(),
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    damage: stats.damage,
    attackCooldown: randomRange(0.2, 0.8),
    specialTimer: randomRange(0.8, 1.8),
    stun: 0,
    phase: randomRange(0, Math.PI * 2),
    baseScale: stats.scale,
    boss: stats.boss === true
  };
  enemies.push(enemy);
  syncEnemySprite(enemy);
  burst(pos, enemy.boss ? "#ff8066" : "#ffd166", enemy.boss ? 24 : 8);
  return enemy;
}

function syncEnemySprite(enemy: Enemy): void {
  const hop = Math.sin(enemy.phase * (enemy.boss ? 3.2 : enemy.kind === "golem" ? 3.8 : 5.8)) * (enemy.kind === "golem" ? 0.025 : 0.045);
  const hurtPulse = enemy.stun > 0 ? 1.08 : 1;
  const frame = Math.floor(enemy.phase * enemy.sheet.fps + enemy.id) % enemy.sheet.frameCount;
  const col = frame % enemy.sheet.cols;
  const row = Math.floor(frame / enemy.sheet.cols);
  enemy.sprite.material.map?.offset.set(col / enemy.sheet.cols, 1 - (row + 1) / enemy.sheet.rows);
  enemy.sprite.position.set(enemy.pos.x, enemy.pos.y + hop, 3);
  enemy.sprite.scale.setScalar(enemy.baseScale * hurtPulse);
  enemy.sprite.renderOrder = renderOrderFor(enemy.pos.y, 90);
  enemy.sprite.material.opacity = THREE.MathUtils.clamp(0.55 + (enemy.hp / enemy.maxHp) * 0.45, 0.55, 1);
}

function enemyShoot(enemy: Enemy): void {
  const dir = player.pos.clone().sub(enemy.pos).normalize();
  const projectile = createProjectile({
    texture: textures.syrup,
    pos: enemy.pos.clone().addScaledVector(dir, 0.6),
    vel: dir.multiplyScalar(enemy.boss ? 6.2 : 5.6),
    radius: 0.34,
    scale: 0.58,
    damage: enemy.boss ? 14 : 10,
    team: "enemy",
    life: 3,
    pierce: 0,
    spin: -4,
    trailColor: enemy.kind === "candleBoss" ? "#8bdcff" : "#ffb65c"
  });
  projectile.sprite.material.color.set(enemy.kind === "candleBoss" ? "#a9dcff" : "#ffb65c");
}

function bossAttack(enemy: Enemy): void {
  const hpRatio = enemy.hp / enemy.maxHp;
  const count = enemy.kind === "burgerBoss" ? (hpRatio < 0.45 ? 16 : 12) : hpRatio < 0.45 ? 12 : 8;
  const base = Math.atan2(player.pos.y - enemy.pos.y, player.pos.x - enemy.pos.x);

  for (let i = 0; i < count; i += 1) {
    const spread = enemy.kind === "candleBoss" ? 0.38 : enemy.kind === "burgerBoss" ? 0.2 : 0.26;
    const angle = enemy.kind === "griddleBoss"
      ? (i / count) * Math.PI * 2 + enemy.phase * 0.45
      : base + (i - (count - 1) / 2) * spread;
    const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    const projectile = createProjectile({
      texture: textures.syrup,
      pos: enemy.pos.clone().addScaledVector(dir, 1.1),
      vel: dir.multiplyScalar(enemy.kind === "candleBoss" ? 4.5 + i * 0.04 : 5.2 + i * 0.06),
      radius: 0.34,
      scale: enemy.kind === "burgerBoss" ? 0.7 : 0.62,
      damage: enemy.kind === "burgerBoss" ? 14 : 12,
      team: "enemy",
      life: 2.8,
      pierce: 0,
      spin: 4,
      trailColor: enemy.kind === "candleBoss" ? "#8bdcff" : enemy.kind === "griddleBoss" ? "#ff9859" : "#ffd166"
    });
    projectile.sprite.material.color.set(enemy.kind === "candleBoss" ? "#a9dcff" : enemy.kind === "griddleBoss" ? "#ff9859" : "#ffd166");
  }

  if (hpRatio < 0.65 && enemies.length < 8) {
    const angle = randomRange(0, Math.PI * 2);
    const summon = enemy.kind === "candleBoss"
      ? (Math.random() > 0.35 ? "shade" : "mage")
      : enemy.kind === "griddleBoss"
        ? (Math.random() > 0.45 ? "golem" : "burger")
        : (Math.random() > 0.45 ? "burger" : "shade");
    spawnEnemy(summon, enemy.pos.clone().add(new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(2.4)));
  }

  spawnShockwave(enemy.pos, enemy.kind === "candleBoss" ? "#8bdcff" : "#ff9859", enemy.boss ? 1.2 : 0.85);
  shake = Math.max(shake, 0.2);
}

function createProjectile(options: {
  texture: THREE.Texture;
  pos: V2;
  vel: V2;
  radius: number;
  scale: number;
  damage: number;
  team: Team;
  life: number;
  pierce: number;
  spin: number;
  color?: string;
  trailColor?: string;
}): Projectile {
  const material = new THREE.SpriteMaterial({
    map: options.texture,
    transparent: true,
    depthTest: false,
    color: options.color ?? "#ffffff"
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(options.scale);
  sprite.position.set(options.pos.x, options.pos.y, 4);
  sprite.renderOrder = 2200;
  fxGroup.add(sprite);

  const projectile: Projectile = {
    sprite,
    pos: options.pos,
    vel: options.vel,
    radius: options.radius,
    damage: options.damage,
    team: options.team,
    life: options.life,
    maxLife: options.life,
    pierce: options.pierce,
    spin: options.spin,
    trailColor: options.trailColor ?? "",
    trailTimer: 0,
    hitIds: new Set()
  };
  projectiles.push(projectile);
  return projectile;
}

function spawnSlash(origin: V2, dir: V2, scale: number): void {
  const material = new THREE.SpriteMaterial({
    map: textures.slash,
    transparent: true,
    depthTest: false,
    color: "#ffd166"
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(origin.x + dir.x * 0.8, origin.y + dir.y * 0.8, 6);
  sprite.scale.set(2.2 * scale, 1.35 * scale, 1);
  sprite.material.rotation = Math.atan2(dir.y, dir.x);
  sprite.renderOrder = 2600;
  fxGroup.add(sprite);
  particles.push({
    sprite,
    pos: new THREE.Vector2(sprite.position.x, sprite.position.y),
    vel: dir.clone().multiplyScalar(0.5),
    life: 0.16,
    maxLife: 0.16,
    startScale: 1,
    endScale: 1.25
  });
}

function burst(pos: V2, color: string, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(1.2, 5.2);
    spawnParticle(
      pos.clone(),
      new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(speed),
      randomRange(0.25, 0.62),
      randomRange(0.08, 0.18),
      randomRange(0.01, 0.04),
      color
    );
  }
}

function spawnShockwave(pos: V2, color: string, scale: number): void {
  spawnParticle(pos.clone(), new THREE.Vector2(), 0.34, scale, scale * 2.4, color, textures.ring);
}

function spawnCombatText(pos: V2, text: string, color: string): void {
  const element = document.createElement("div");
  element.className = "floatText";
  element.textContent = text;
  element.style.color = color;
  combatLayer.append(element);
  combatTexts.push({
    element,
    pos,
    vel: new THREE.Vector2(randomRange(-0.18, 0.18), randomRange(0.85, 1.18)),
    life: 0.9,
    maxLife: 0.9
  });
}

function spawnParticle(
  pos: V2,
  vel: V2,
  life: number,
  startScale: number,
  endScale: number,
  color: string,
  texture: THREE.Texture = textures.spark
): void {
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    color
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(pos.x, pos.y, 6);
  sprite.scale.setScalar(startScale);
  fxGroup.add(sprite);
  particles.push({
    sprite,
    pos,
    vel,
    life,
    maxLife: life,
    startScale,
    endScale
  });
}

function buildArena(): void {
  arenaBackdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(world.width, world.height),
    arenaBackdropMaterial
  );
  arenaBackdrop.position.z = -2;
  arenaGroup.add(arenaBackdrop);

  const gridMaterial = new THREE.LineBasicMaterial({ color: "#e8d6a0", transparent: true, opacity: 0.08 });
  const grid = new THREE.Group();

  for (let x = -world.halfWidth + 2; x <= world.halfWidth - 2; x += 2) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, -world.halfHeight + 1.4, -1.6),
      new THREE.Vector3(x, world.halfHeight - 1.4, -1.6)
    ]);
    grid.add(new THREE.Line(geometry, gridMaterial));
  }

  for (let y = -world.halfHeight + 1.5; y <= world.halfHeight - 1.5; y += 2) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-world.halfWidth + 1.5, y, -1.6),
      new THREE.Vector3(world.halfWidth - 1.5, y, -1.6)
    ]);
    grid.add(new THREE.Line(geometry, gridMaterial));
  }

  arenaGroup.add(grid);

  const wallMaterial = new THREE.MeshBasicMaterial({ color: "#120d18", transparent: true, opacity: 0.28 });
  const trimMaterial = new THREE.MeshBasicMaterial({ color: "#8d5a36", transparent: true, opacity: 0.36 });
  addWall(0, world.halfHeight + 0.25, world.width + 1, 0.9, wallMaterial);
  addWall(0, -world.halfHeight - 0.25, world.width + 1, 0.9, wallMaterial);
  addWall(-world.halfWidth - 0.25, 0, 0.9, world.height + 1, wallMaterial);
  addWall(world.halfWidth + 0.25, 0, 0.9, world.height + 1, wallMaterial);
  addWall(0, world.halfHeight - 0.42, world.width - 1.7, 0.16, trimMaterial);
  addWall(0, -world.halfHeight + 0.42, world.width - 1.7, 0.16, trimMaterial);
}

function addWall(x: number, y: number, width: number, height: number, material: THREE.Material): void {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(x, y, -1);
  arenaGroup.add(mesh);
}

function keepInArena(pos: V2, radius: number): void {
  pos.x = THREE.MathUtils.clamp(pos.x, -world.halfWidth + radius + 1.1, world.halfWidth - radius - 1.1);
  pos.y = THREE.MathUtils.clamp(pos.y, -world.halfHeight + radius + 1.1, world.halfHeight - radius - 1.1);
}

function updatePointer(clientX: number, clientY: number): void {
  const rect = renderer.domElement.getBoundingClientRect();
  const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
  const width = camera.right - camera.left;
  const height = camera.top - camera.bottom;
  pointerWorld.set(camera.position.x + nx * width * 0.5, camera.position.y - ny * height * 0.5);
}

function worldToScreen(pos: V2): { x: number; y: number } {
  const rect = renderer.domElement.getBoundingClientRect();
  const left = camera.position.x + camera.left;
  const bottom = camera.position.y + camera.bottom;
  const width = camera.right - camera.left;
  const height = camera.top - camera.bottom;
  return {
    x: rect.left + ((pos.x - left) / width) * rect.width,
    y: rect.top + (1 - (pos.y - bottom) / height) * rect.height
  };
}

const touchMove = new THREE.Vector2();
let activeStick: number | null = null;

function setupTouchControls(): void {
  stick.addEventListener("pointerdown", (event) => {
    activeInput = "touch";
    activeStick = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    updateStick(event);
  });

  stick.addEventListener("pointermove", (event) => {
    if (activeStick === event.pointerId) {
      updateStick(event);
    }
  });

  const release = (event: PointerEvent) => {
    if (activeStick === event.pointerId) {
      activeStick = null;
      touchMove.set(0, 0);
      knob.style.transform = "translate(0px, 0px)";
    }
  };

  stick.addEventListener("pointerup", release);
  stick.addEventListener("pointercancel", release);

  touch.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      activeInput = "touch";
      button.setPointerCapture(event.pointerId);
      navigator.vibrate?.(12);

      if (mode === "title") {
        startGame();
        return;
      }

      const act = button.dataset.act;

      if (isInputAction(act)) {
        performAction(act);

        if (act !== "dash") {
          heldActions.add(act);
        }
      } else if (act === "cycle") {
        cycleSpellSelection(1);
      } else if (act === "weapon") {
        cycleWeaponSelection(1);
      }
    });

    const release = (event: PointerEvent) => {
      if (button.hasPointerCapture(event.pointerId)) {
        button.releasePointerCapture(event.pointerId);
      }

      const act = button.dataset.act;

      if (isInputAction(act)) {
        heldActions.delete(act);
      }
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });
}

function updateStick(event: PointerEvent): void {
  activeInput = "touch";
  const rect = stick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const max = rect.width * 0.34;
  const len = Math.hypot(dx, dy);
  const clamped = len > max ? max / len : 1;
  const x = dx * clamped;
  const y = dy * clamped;
  knob.style.transform = `translate(${x}px, ${y}px)`;
  touchMove.set(x / max, -y / max);

  if (touchMove.lengthSq() > 0.04) {
    pointerWorld.copy(player.pos).add(touchMove.clone().normalize().multiplyScalar(4));
  }
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / Math.max(1, height);
  const viewHeight = aspect < 0.75 ? 23 : 18;
  const viewWidth = viewHeight * aspect;
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function removeEnemy(enemy: Enemy): void {
  const index = enemies.indexOf(enemy);

  if (index >= 0) {
    enemies.splice(index, 1);
  }

  actorGroup.remove(enemy.sprite);
  enemy.sprite.material.map?.dispose();
  enemy.sprite.material.dispose();
}

function removeProjectile(projectile: Projectile): void {
  const index = projectiles.indexOf(projectile);

  if (index >= 0) {
    projectiles.splice(index, 1);
  }

  fxGroup.remove(projectile.sprite);
  projectile.sprite.material.dispose();
}

function removeParticle(particle: Particle): void {
  const index = particles.indexOf(particle);

  if (index >= 0) {
    particles.splice(index, 1);
  }

  fxGroup.remove(particle.sprite);
  particle.sprite.material.dispose();
}

function removeCombatText(text: CombatText): void {
  const index = combatTexts.indexOf(text);

  if (index >= 0) {
    combatTexts.splice(index, 1);
  }

  text.element.remove();
}

function removeTrap(trap: Trap): void {
  const index = traps.indexOf(trap);

  if (index >= 0) {
    traps.splice(index, 1);
  }

  fxGroup.remove(trap.sprite);
  trap.sprite.material.dispose();
}

function removePowerup(powerup: Powerup): void {
  const index = powerups.indexOf(powerup);

  if (index >= 0) {
    powerups.splice(index, 1);
  }

  fxGroup.remove(powerup.sprite);
  powerup.sprite.material.dispose();
}

function clearArray<T>(items: T[], remove: (item: T) => void): void {
  for (const item of [...items]) {
    remove(item);
  }
}

function renderOrderFor(y: number, offset: number): number {
  return 1500 - Math.round(y * 20) + offset;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function loadTexture(url: string): THREE.Texture {
  const texture = textureLoader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function makeSpriteSheet(url: string, rows: number, cols: number, fps: number): SpriteSheetDef {
  const texture = loadTexture(url);
  return {
    texture,
    rows,
    cols,
    frameCount: rows * cols,
    fps
  };
}

function setArena(id: ArenaId): void {
  arenaBackdropMaterial.map = arenaTextures[id];
  arenaBackdropMaterial.needsUpdate = true;
  const colors: Record<ArenaId, string> = {
    batterGate: "#1d171c",
    griddleFoundry: "#171419",
    syrupCanal: "#121923",
    candleCrypt: "#151421",
    burgerBasilica: "#1b1717"
  };
  scene.background = new THREE.Color(colors[id]);
}

function isBossKind(kind: EnemyKind): boolean {
  return kind === "griddleBoss" || kind === "candleBoss" || kind === "burgerBoss";
}

function makeTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not create canvas texture");
  }

  ctx.clearRect(0, 0, size, size);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function makeBurgerTexture(boss: boolean): THREE.CanvasTexture {
  return makeTexture((ctx, size) => {
    const c = size / 2;
    const scale = boss ? 1.08 : 0.88;
    ctx.translate(c, c + (boss ? 8 : 12));
    ctx.scale(scale, scale);
    drawBlobShadow(ctx, 0, 54, 82, 20);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#201018";
    ctx.fillStyle = boss ? "#f2a33b" : "#e9a84f";
    roundRect(ctx, -78, -70, 156, 58, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff0a5";

    for (let i = 0; i < (boss ? 12 : 8); i += 1) {
      const x = randomSeed(i, -54, 54);
      const y = randomSeed(i + 9, -58, -34);
      ctx.beginPath();
      ctx.ellipse(x, y, 5, 2.4, randomSeed(i + 2, -0.8, 0.8), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#73c55b";
    ctx.beginPath();

    for (let x = -74; x <= 74; x += 18) {
      const y = -12 + Math.sin(x * 0.2) * 7;
      if (x === -74) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.lineTo(74, 16);
    ctx.lineTo(-74, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8b3827";
    roundRect(ctx, -72, 0, 144, 42, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(-55, 0);
    ctx.lineTo(-24, 0);
    ctx.lineTo(-42, 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c97a37";
    roundRect(ctx, -78, 28, 156, 42, 24);
    ctx.fill();
    ctx.stroke();

    if (boss) {
      ctx.fillStyle = "#7a304e";
      ctx.beginPath();
      ctx.moveTo(-70, -66);
      ctx.lineTo(-112, -88);
      ctx.lineTo(-86, -34);
      ctx.closePath();
      ctx.moveTo(70, -66);
      ctx.lineTo(112, -88);
      ctx.lineTo(86, -34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.moveTo(-38, -92);
      ctx.lineTo(0, -126);
      ctx.lineTo(38, -92);
      ctx.lineTo(26, -76);
      ctx.lineTo(0, -98);
      ctx.lineTo(-26, -76);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    drawEyes(ctx, -28, -20, 28, -20, boss ? "#ffcf55" : "#fff8d9");
    ctx.strokeStyle = "#201018";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 6, boss ? 24 : 18, 0.1, Math.PI - 0.1);
    ctx.stroke();
  });
}

function makeShadeTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, size) => {
    const c = size / 2;
    ctx.translate(c, c + 12);
    drawBlobShadow(ctx, 0, 60, 64, 18);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#170e20";
    ctx.fillStyle = "#6f4bb6";
    ctx.beginPath();
    ctx.moveTo(-58, 34);
    ctx.bezierCurveTo(-84, -22, -42, -82, 6, -78);
    ctx.bezierCurveTo(60, -74, 78, -12, 52, 42);
    ctx.bezierCurveTo(26, 76, -36, 74, -58, 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#9c7bea";
    ctx.beginPath();
    ctx.ellipse(-18, -36, 20, 28, -0.3, 0, Math.PI * 2);
    ctx.fill();
    drawEyes(ctx, -18, -10, 24, -12, "#fcefb4");
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-46, 20);
    ctx.lineTo(-78, 6);
    ctx.moveTo(48, 22);
    ctx.lineTo(78, 0);
    ctx.stroke();
  });
}

function makeMageTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, size) => {
    const c = size / 2;
    ctx.translate(c, c + 10);
    drawBlobShadow(ctx, 0, 62, 62, 18);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#181018";
    ctx.fillStyle = "#3f7f6f";
    ctx.beginPath();
    ctx.moveTo(-50, 58);
    ctx.quadraticCurveTo(-26, -24, 0, -76);
    ctx.quadraticCurveTo(28, -24, 54, 58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(-28, -30);
    ctx.lineTo(0, -90);
    ctx.lineTo(32, -30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2b202e";
    ctx.beginPath();
    ctx.ellipse(0, 6, 38, 31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawEyes(ctx, -14, 0, 16, 0, "#a9dcff");
    ctx.strokeStyle = "#d96459";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(44, 10);
    ctx.lineTo(86, -30);
    ctx.stroke();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(92, -36, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function makeWaffleTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, size) => {
    const c = size / 2;
    ctx.translate(c, c);
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#28140b";
    ctx.fillStyle = "#f1ad39";
    ctx.beginPath();
    ctx.arc(0, 0, 82, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#a96024";
    ctx.lineWidth = 8;

    for (let x = -48; x <= 48; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, -68);
      ctx.lineTo(x, 68);
      ctx.stroke();
    }

    for (let y = -48; y <= 48; y += 32) {
      ctx.beginPath();
      ctx.moveTo(-68, y);
      ctx.lineTo(68, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#fff1a8";
    ctx.beginPath();
    ctx.arc(18, -22, 18, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makeSlashTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, size) => {
    ctx.translate(size / 2, size / 2);
    ctx.strokeStyle = "#3a1d0e";
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.arc(-8, 4, 82, -0.55, 0.56);
    ctx.stroke();
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.arc(-8, 4, 82, -0.55, 0.56);
    ctx.stroke();
    ctx.strokeStyle = "#fff6c6";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-4, -2, 68, -0.48, 0.48);
    ctx.stroke();
  });
}

function makeSyrupTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, size) => {
    ctx.translate(size / 2, size / 2);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#190e1d";
    const gradient = ctx.createLinearGradient(-64, 0, 64, 0);
    gradient.addColorStop(0, "#7c3aed");
    gradient.addColorStop(0.55, "#d96459");
    gradient.addColorStop(1, "#ffd166");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 72, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff6c6";
    ctx.beginPath();
    ctx.ellipse(22, -8, 24, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makeSparkTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, size) => {
    ctx.translate(size / 2, size / 2);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 76, 0, Math.PI * 2);
    ctx.fill();
  }, 96);
}

function makeTrapTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, size) => {
    ctx.translate(size / 2, size / 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#201018";
    ctx.fillStyle = "rgba(255, 209, 102, 0.62)";
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#fff3a4";
    ctx.lineWidth = 7;

    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 26, Math.sin(a) * 26);
      ctx.lineTo(Math.cos(a) * 78, Math.sin(a) * 78);
      ctx.stroke();
    }

    ctx.strokeStyle = "#a96024";
    ctx.lineWidth = 9;
    ctx.strokeRect(-44, -44, 88, 88);
  });
}

function makeOrbTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, size) => {
    const c = size / 2;
    const glow = ctx.createRadialGradient(c, c, 8, c, c, c * 0.48);
    glow.addColorStop(0, "rgba(255, 255, 255, 1)");
    glow.addColorStop(0.42, "rgba(255, 255, 255, 0.86)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(c, c);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.beginPath();
    ctx.arc(-18, -18, 16, 0, Math.PI * 2);
    ctx.fill();
  }, 160);
}

function makeRingTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, size) => {
    ctx.translate(size / 2, size / 2);
    ctx.lineWidth = 14;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.96)";
    ctx.beginPath();
    ctx.arc(0, 0, 76, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.stroke();
  }, 192);
}

function makeStarTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, size) => {
    ctx.translate(size / 2, size / 2);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();

    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? 58 : 24;
      const angle = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.fill();
  }, 128);
}

function makeFlameTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, size) => {
    ctx.translate(size / 2, size / 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#190e1d";
    const gradient = ctx.createLinearGradient(0, -74, 0, 70);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.38, "#ffd166");
    gradient.addColorStop(0.78, "#ff6f8f");
    gradient.addColorStop(1, "#7c3aed");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, -82);
    ctx.bezierCurveTo(58, -24, 46, 44, 0, 78);
    ctx.bezierCurveTo(-48, 42, -58, -18, 0, -82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.moveTo(4, -40);
    ctx.bezierCurveTo(28, -6, 20, 32, -4, 48);
    ctx.bezierCurveTo(-22, 20, -18, -8, 4, -40);
    ctx.fill();
  }, 192);
}

function drawEyes(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x1, y1, 13, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(x2, y2, 13, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#211518";
  ctx.beginPath();
  ctx.arc(x1 + 2, y1 + 2, 6, 0, Math.PI * 2);
  ctx.arc(x2 + 2, y2 + 2, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawBlobShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function randomSeed(seed: number, min: number, max: number): number {
  const n = Math.sin(seed * 999.91) * 43758.5453;
  return min + (n - Math.floor(n)) * (max - min);
}
