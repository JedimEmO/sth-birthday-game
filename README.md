# Sindre's Waffle Adventure

Play it here: https://jedimemo.github.io/sth-birthday-game/

Sindre's Waffle Adventure is a small browser action RPG about defending the birthday waffles from burger shades, syrup mages, candle liches, and oversized kitchen bosses. Fight through themed arenas, collect readable healing and powerup orbs, choose birthday boons between rooms, and build around scarce focus upgrades plus limited technique slots as the run escalates.

Between rooms you earn one focus point. Focus upgrades either a weapon style or a spell, so specializing in one path means leaving others behind. Technique picks are limited to three per run and come with tradeoffs such as more weapon damage for less health, faster spells for weaker strikes, or more drops for weaker healing.

## Controls

- Move: `WASD` or arrow keys
- Strike: `J` or left mouse
- Dash: `Space` or `Shift`
- Cast active spell: `Q`, `K`, or right mouse
- Drop waffle trap: `E` or `L`
- Cycle spells: `R` or `Tab`
- Cycle weapons: `T`
- Select spell directly: `1` through `4`

Touch controls are available on mobile, with a left movement stick, holdable action buttons, spell and weapon cycling, and assisted aim when attacking from touch.

Standard gamepads are supported:

- Left stick: move
- Right stick: aim
- A / Cross: dash or start run
- X / Square or right trigger: strike
- Y / Triangle or left trigger: cast active spell
- B / Circle: drop waffle trap
- Left bumper or D-pad left/right: cycle spells
- Right bumper or D-pad up/down: cycle weapons
- Start / Options: start or restart from title and end screens

## Local Development

```bash
npm ci
npm run check
npm run check:sprite
npm run build
npm run dev
```

The built game is generated into `dist/`, which is ignored locally. GitHub Actions builds and publishes `dist/` to GitHub Pages on pushes to `master`.
