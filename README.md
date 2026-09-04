# Wenhao’s Arcade

A collection of 12 browser games and tools. A quiet, image-led library with instant search, favorites, recently played games and responsive game screens.

[Play on GitHub Pages](https://wenhaoquestion.github.io/My-Game-Web/)

## Run locally

Requires Python 3 to serve the site. There is no build step and no production dependency to install.

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000**. You can also run `npm run dev` with Node.js installed. Opening `index.html` directly works for the core games, but the local server is recommended for the helper’s background solver and optional OCR.

## Find your next game

- Search by English or Chinese game name.
- Filter Arcade, Puzzle, Strategy or Tools.
- Use the heart on a cover to save a favorite.
- Recently played lists the games you opened, most recent first. It is a history of launches, not a saved-game system.
- Game links such as `#/tetris` and `#/ten-helper` can be bookmarked or shared.
- Browser back/forward and **All games** return you to the library.
- Five color themes and the optional Aura effect are available in the header.
- Every activity has a How to play guide, fullscreen mode where supported, and optional sound feedback. Sound starts off and remembers your preference.

Favorites, recent games, themes and supported high scores are stored in this browser. If browser storage is unavailable, the site remains playable with session-only library preferences. Game scripts load only when opened and are reused on subsequent visits.

## Collection

| Game or tool | Features | Controls |
|---|---|---|
| Neon Snake | Four arenas, buffered turns, fruit bonuses, countdown and results | Arrow keys / WASD, Esc pause; swipe or direction pad |
| Prismatic Tetris | Four modes, combos, wall/floor kicks, mode records and AI practice | Arrows / WASD, Q/E rotate, Space hard drop, Shift/C hold, P/Esc pause, B AI; touch buttons |
| 2048 Puzzle | Adjustable boards, undo, automatic save and resume | Arrow keys / WASD or swipe; U undo |
| Prism Sudoku | Classic and Killer, candidate notes, undo and selected-cell hints | Select a cell, 1–9 to enter, Backspace to erase; on-screen keypad |
| Neon Shooter | Five sectors, bosses, endless waves, chains and sector repairs | Drag to steer or Arrows / A/D; auto-fire, Space shoot, Shift bomb, P pause; touch buttons |
| Merge 10 · 合成10 | Custom countdown, Clear Race, highlighted hints, undo and stuck-board feedback | Drag a sum-10 rectangle, or use arrows and Enter to select corners |
| Lucky Coin Toss | Free play and ten-flip prediction challenge, streaks and history | Choose a prediction, then Flip or Space |
| Chess | Full rules, three AI levels, full-position undo and legal hints | Select a piece, then a legal destination; tools below board |
| Five in a Row | Local two-player or AI, undo, win/block hints and threat readout | Select an intersection; tools below board |
| Chinese Chess | Local two-player or AI, full-position undo, legal hints and move history | Select a piece, then a legal destination; tools below board |
| Texas Hold’em Odds | Cancellable Monte Carlo equity calculation with progress | Choose your hand and board, set opponents, calculate |
| Merge 10 Solver | Editable board, OCR, background solver, playback and export | Enter/import a board, Solve, then Next or Play |

Realtime games pause or stop updating when you leave their screen. Board AI tasks and helper playback are invalidated when a game or board is replaced. The helper solves in a Web Worker when supported so navigation remains responsive.

Opening instructions pauses active play. Realtime games require an explicit resume; Sudoku resumes its clock when the guide closes. Tetris AI practice and assisted Merge 10 runs do not overwrite unassisted records. Undo does not refund Merge 10 time or Sudoku hint/mistake counters. Chess and Xiangqi hints use a short legal search and are suggestions, not guaranteed best moves.

## Project structure

```text
index.html         Semantic shell and game screens
catalog.js         Titles, categories, covers, routes and initializer metadata
main.js            Library rendering, routing, lazy loading and preferences
game-experience.js  Instructions, fullscreen and opt-in synthesized sound
ambient.js         Optional motion effect, suspended when the tab is hidden
style.css          Game-specific boards, tiles and effects
styles/shell.css   Design tokens, header, library and responsive layout
styles/games.css   Shared game chrome, controls and mobile adjustments
styles/*-play.css  Controls and layouts for each family of games
assets/            Optimized WebP feature/cover artwork and SVG favicon
*.js               Independent game engines (merge10.js also owns the helper)
scripts/check.mjs  Syntax and static asset/registry validation
```

Keep game metadata in `catalog.js`. Each entry names its DOM screen, JavaScript file and global initialization function. The router calls an initializer once, after its screen is visible, and emits `arcade:screenchange` on `document` with `{ screenId, previousScreenId }`. Game modules use this event to suspend timers or cancel stale work. Shared instructions emit `arcade:pause` and `arcade:helpclose`. `ArcadeFeedback.play()` provides optional sound; game engines remain usable without it.

The UI uses neutral charcoal surfaces, readable type and theme accents defined in `styles/shell.css`. Shared gameplay controls belong in `styles/games.css`; individual board rendering stays with its game. Covers and the featured banner were created with OpenAI image generation and optimized to WebP (about 600 KB combined); no external image or font service is required.

## Checks

```sh
npm run check
```

The dependency-free check validates JavaScript syntax, unique HTML IDs, local asset references and each catalog entry’s screen and initializer. For a browser regression, verify search → filter → favorite → open → return, all 12 direct game links, theme persistence, blocked storage, background pauses, helper solve/cancel, and 390 px / 320 px layouts.

## Deployment and optional network features

Publish the repository root using GitHub Pages; no build output or server is required. Hash routes work under the repository subpath.

The regular games, calculator and fast OCR run locally in the browser. **Deep OCR** downloads Tesseract.js and its worker/language data when requested, so that optional feature needs an internet connection. OCR results may need manual correction.

## AI engines

Chess and Xiangqi use minimax, alpha-beta pruning, move ordering and quiescence search. Gomoku uses minimax with alpha-beta pruning. Tetris autoplay evaluates board height, complete lines, holes and unevenness. Poker equity is estimated with Monte Carlo simulation.
