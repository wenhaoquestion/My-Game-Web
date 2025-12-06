# Wenhao's Web Arcade

A small web arcade featuring a neon-styled Snake and a smooth 2048 puzzle. You can play directly in the browser: **https://wenhaoquestion.github.io/My-Game-Web/**.

## Games

### Neon Snake
- Neon grid visuals with adjustable skins and glow.
- Modes for wall-wrap or classic boundaries, plus speed toggles and selectable level layouts.
- Tracks score and best run locally.

### 2048 Puzzle
- Slick tile animations and multiple board sizes (3×3 to 6×6).
- Win prompt at 2048 with an optional endless mode so you can keep merging higher.
- Score and best score display.

## Controls
- **Snake:** Arrow keys or WASD to move; ESC to pause.
- **2048:** Arrow keys or WASD to slide tiles.

## Run locally
1. Clone the repo and install a simple static server (or use Python):
   ```bash
   git clone https://github.com/wenhaoquestion/My-Game-Web.git
   cd My-Game-Web
   python -m http.server 8000
   ```
2. Open `http://localhost:8000/` in your browser.

## Project structure
- `index.html` — Hub page with cards for each game.
- `style.css` — Shared styling for layout, cards, and overlays.
- `snake.js` — Canvas-driven Snake implementation and UI hooks.
- `2048.js` — 2048 logic, rendering, and endless-mode prompt.
- `main.js` — Screen switching and initialization for both games.

## Li
