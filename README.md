# Emoji Slots RPG

![Emoji Slots RPG](public/img/og-image-1200x630.png)

> Step into a glowing neon arcade, circa 1988. Emoji Slots is a browser-based fruit machine with full UK pub-style mechanics: spin three emoji reels, hold wheels between spins, nudge them up or down into line, and gamble your winnings through bonus rounds — Higher/Lower, Pick a Box, and Spin the Wheel. Random arcade encounters throw RPG-style events into the mix. Match cherries, unicorns, or the elusive 💯 to fill your pockets. Hit a triple 💩 and watch your coins vanish. Hit 💀💀💀 and it's game over. Built with a synthwave CRT aesthetic, arcade sound effects, and background music. Your coins are saved — come back any time.

A browser-based fruit machine with full UK pub-style mechanics, set in a glowing synthwave arcade. Built as a vanilla JS progressive web app (PWA).

## Gameplay

- **Spin** three emoji reels and match symbols to win coins.
- **Hold** one or more wheels between spins to keep favourable symbols in place.
- **Nudge** wheels up or down to coax a winning line into position.
- **Gamble** your winnings through bonus rounds: Higher/Lower, Pick a Box, and Spin the Wheel.
- **RPG encounters** — random arcade scenarios interrupt play with story choices that can win or lose you coins, straight out of 1988.

### Symbols

Symbols carry different values. Land triple 💀💀💀 and it's game over. Hit triple 💩 and watch your coins disappear.

### Persistence

Your coin balance is saved to `localStorage` so you can pick up where you left off.

## Tech

- Vanilla JavaScript (ES modules), HTML, CSS — no framework
- [Howler.js](https://howlerjs.com/) for audio (SFX + looping background music)
- Service Worker for offline support and PWA install
- Custom `cache-bust.js` script to fingerprint static assets on deploy

## Project Structure

```
public/
  index.html          # App shell
  main.js             # Game logic
  scenarios-rpg.json  # RPG encounter definitions
  sw.js               # Service worker
  css/main.css        # Synthwave CRT styling
  audio/              # SFX and background music tracks
  img/                # Icons and graphics
```

## Development

No build step required. To update asset cache-busting hashes before deploying:

```bash
node cache-bust.js
```

## Licence

See [LICENSE](LICENSE).
