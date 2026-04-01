# Wenhao's Web Arcade

A browser-based arcade featuring 10 games with a neon cyberpunk aesthetic, responsive design, and powerful AI opponents. Play directly at **https://wenhaoquestion.github.io/My-Game-Web/** or open `index.html` locally — no installation required.

---

## Games

| Game | Mode | AI |
|------|------|----|
| Snake | Solo | — |
| 2048 | Solo | — |
| Tetris | Solo / AI Auto-play | El-Tetris heuristic |
| Sudoku | Solo | — |
| Coin Toss | Solo | — |
| Texas Hold'em Odds | Calculator | Monte Carlo |
| Space Shooter | Solo | — |
| Gomoku | PvP / PvE | Minimax + alpha-beta |
| Xiangqi (Chinese Chess) | PvP / PvE | Minimax + alpha-beta + quiescence |
| International Chess | PvP / PvE | Minimax + alpha-beta + quiescence |

---

## How to Play

### Launch locally
```bash
git clone https://github.com/wenhaoquestion/My-Game-Web.git
cd My-Game-Web
python -m http.server 8000   # or open index.html directly
```

### Navigation
- Click a game card on the main menu to enter that game
- Click **← Back** (top-left of any game screen) to return to the menu
- Use the **theme swatches** (top-right) to switch between 5 colour themes: Nebula, Solaris, Aqua Rift, Ember, Verdant
- Toggle **Aura** to enable/disable the ambient background glow

---

## Controls

### Snake
| Key | Action |
|-----|--------|
| Arrow keys / WASD | Steer |

### 2048
| Key | Action |
|-----|--------|
| Arrow keys | Slide tiles |

### Tetris
| Key | Action |
|-----|--------|
| Arrow Left / A | Move left |
| Arrow Right / D | Move right |
| Arrow Down / S | Soft drop |
| Arrow Up / W / E | Rotate clockwise |
| Q | Rotate counter-clockwise |
| Space | Hard drop |
| Shift / C | Hold piece |
| P | Pause |
| **B** | **Toggle AI auto-play** |

Tetris modes: **Marathon** (150 lines), **Sprint** (40 lines), **Ultra** (120 s), **Gauntlet** (continuous garbage).
Stages (Aurora → Storm → Neon Pulse → Void Wells) increase gravity and garbage pressure.

### Chess & Xiangqi
- Click a piece to select (legal moves highlight)
- Click a highlighted square to move
- Choose Easy / Medium / Hard before starting a PvE game

### Sudoku
- Click a cell, then type 1–9 or use the on-screen numpad
- **Hint** reveals one cell, **Check** validates, **Solve** auto-completes

### Texas Hold'em Odds
1. Select a slot (Hero Hand or Board card)
2. Click a card in the deck to assign it
3. Set opponents and simulation iterations
4. Click **Calculate** — equity is computed via Monte Carlo simulation

---

## AI Technical Details

### Chess AI
- **Algorithm**: Minimax with alpha-beta pruning
- **Quiescence search**: After the depth limit, captures and promotions are searched further until a quiet position is reached — eliminates tactical blunders at the search horizon
- **Move ordering**: MVV-LVA (Most Valuable Victim – Least Valuable Attacker) maximises alpha-beta cutoffs
- **Evaluation**: Material values (Pawn=100, Knight=320, Bishop=330, Rook=500, Queen=900) + piece-square tables for all six piece types
- **Depths**: Easy = random move, Medium = 3 plies + quiescence, Hard = 4 plies + quiescence

### Xiangqi AI
- Same minimax + alpha-beta + quiescence architecture as Chess
- **Evaluation**: Xiangqi piece values (General=6000, Chariot=600, Cannon=285, Horse=270, Soldier=30, …) + positional bonus tables
- **Depths**: Easy = 1 ply, Medium = 3 plies + quiescence, Hard = 4 plies + quiescence

### Tetris AI (press **B** to toggle)
- Implements the **Dellacherie / El-Tetris heuristic**: every possible placement of the current piece (all rotations × all columns) is scored by four board features:
  - Aggregate height × −0.510 (prefer low boards)
  - Complete lines × +0.761 (reward line clears)
  - Holes × −0.357 (penalise gaps under filled cells)
  - Bumpiness × −0.184 (penalise uneven column heights)
- The highest-scoring placement is chosen and the piece is instantly dropped there

---

## Themes

| Theme | Accent |
|-------|--------|
| Nebula | Ice blue |
| Solaris | Gold |
| Aqua Rift | Cyan |
| Ember | Coral |
| Verdant | Green |

Theme preference is saved to `localStorage` and restored on reload.

---

## File Structure

```
index.html    — Single-page app, all 10 game screens
style.css     — Global styles, CSS themes, responsive layout
main.js       — Screen switching, theme/ambient controls

snake.js      — Snake game
2048.js       — 2048 tile game
tetris.js     — Prismatic Tetris + El-Tetris AI
sudoku.js     — Sudoku generator, solver, UI
coin.js       — Coin toss simulator
poker.js      — Texas Hold'em Monte Carlo equity calculator
shooter.js    — Space shooter
gomoku.js     — Gomoku (five-in-a-row)
xiangqi.js    — Chinese Chess with minimax AI
chess.js      — International Chess with minimax + quiescence AI
```

---

## Tech Stack

- Vanilla HTML5, CSS3, JavaScript (ES6+) — no frameworks, no build step
- Canvas API for board rendering (Chess, Xiangqi, Tetris, Snake, Shooter)
- CSS custom properties for real-time theming
- `localStorage` for theme / ambient persistence
