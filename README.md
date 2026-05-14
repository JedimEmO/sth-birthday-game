# Sindre's Waffle Adventure

Play it here: https://jedimemo.github.io/sth-birthday-game/

Sindre's Waffle Adventure is a small browser action RPG about defending the birthday waffles from burger shades, syrup mages, candle liches, and oversized kitchen bosses. Fight through themed arenas, collect healing and powerup orbs, choose birthday boons between rooms, and upgrade a four-spell loadout as the run escalates.

## Controls

- Move: `WASD` or arrow keys
- Strike: `J` or left mouse
- Dash: `Space` or `Shift`
- Cast active spell: `Q`, `K`, or right mouse
- Drop waffle trap: `E` or `L`
- Cycle spells: `R` or `Tab`
- Select spell directly: `1` through `4`

Touch controls are available on mobile, including a spell button for cycling the active spell.

## Local Development

```bash
npm ci
npm run check
npm run check:sprite
npm run build
npm run dev
```

The built game is generated into `dist/`, which is ignored locally. GitHub Actions builds and publishes `dist/` to GitHub Pages on pushes to `master`.
