// ================= 2048 Config =================
const BOARD_SIZE = 4;
const TILE_SIZE = 72;   // 要和 CSS 里的 tile 宽高一致
const TILE_GAP = 12;
const BOARD_PADDING = 12;
const BEST_KEY_2048 = "game2048_best";

function loadBest2048() {
    const raw = localStorage.getItem(BEST_KEY_2048);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
}

function saveBest2048(score) {
    localStorage.setItem(BEST_KEY_2048, String(score));
}

class Game2048 {
    constructor(rootEl) {
        this.rootEl = rootEl;
        this.bgEl = rootEl.querySelector("#board-2048-bg");
        this.tilesEl = rootEl.querySelector("#board-2048-tiles");

        this.scoreEl = document.getElementById("game2048-score");
        this.bestEl = document.getElementById("game2048-best");
        this.stateLabelEl = document.getElementById("game2048-state-label");

        this.score = 0;
        this.best = loadBest2048();
        this.state = "playing"; // "playing" | "won" | "over"
        this.grid = this.emptyGrid();
        this.tiles = [];
        this.nextTileId = 1;

        this.buildBackground();
        this.bindKeyboard();

        this.updateScoreUI();
        this.reset();
    }

    emptyGrid() {
        return Array.from({ length: BOARD_SIZE }, () =>
            Array.from({ length: BOARD_SIZE }, () => null)
        );
    }

    buildBackground() {
        this.bgEl.innerHTML = "";
        for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
            const cell = document.createElement("div");
            cell.className = "cell-2048";
            this.bgEl.appendChild(cell);
        }
    }

    bindKeyboard() {
        window.addEventListener("keydown", (e) => {
            // 只有在 2048 screen 显示的时候响应
            const screen = document.getElementById("game2048-screen");
            if (!screen || !screen.classList.contains("active")) return;
            if (this.state === "over") return;

            let handled = false;
            if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
                this.move({ x: 0, y: -1 });
                handled = true;
            } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
                this.move({ x: 0, y: 1 });
                handled = true;
            } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
                this.move({ x: -1, y: 0 });
                handled = true;
            } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
                this.move({ x: 1, y: 0 });
                handled = true;
            }
            if (handled) {
                e.preventDefault();
            }
        });
    }

    reset() {
        this.grid = this.emptyGrid();
        this.tiles = [];
        this.score = 0;
        this.state = "playing";

        this.addRandomTile();
        this.addRandomTile();
        this.updateScoreUI();
        this.render();
        this.updateStateLabel();
    }

    updateScoreUI() {
        if (this.scoreEl) this.scoreEl.textContent = String(this.score);
        if (this.bestEl) this.bestEl.textContent = String(this.best);
    }

    updateStateLabel() {
        if (!this.stateLabelEl) return;
        if (this.state === "playing") this.stateLabelEl.textContent = "Playing";
        if (this.state === "won") this.stateLabelEl.textContent = "You reached 2048!";
        if (this.state === "over") this.stateLabelEl.textContent = "No more moves";
    }

    addRandomTile() {
        const empty = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (!this.grid[r][c]) empty.push({ r, c });
            }
        }
        if (empty.length === 0) return false;

        const spot = empty[Math.floor(Math.random() * empty.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        const tile = {
            id: this.nextTileId++,
            value,
            row: spot.r,
            col: spot.c,
            new: true,
            merged: false,
        };
        this.grid[spot.r][spot.c] = tile;
        this.tiles.push(tile);
        return true;
    }

    // 根据方向构建遍历顺序
    buildTraversals(vector) {
        const rows = [];
        const cols = [];
        for (let i = 0; i < BOARD_SIZE; i++) {
            rows.push(i);
            cols.push(i);
        }
        if (vector.y === 1) rows.reverse();
        if (vector.x === 1) cols.reverse();
        return { rows, cols };
    }

    findFarthestPosition(start, vector) {
        let prev;
        let { row, col } = start;
        do {
            prev = { row, col };
            row += vector.y;
            col += vector.x;
        } while (this.withinBounds(row, col) && !this.grid[row][col]);
        return {
            farthest: prev,
            next: { row, col },
        };
    }

    withinBounds(r, c) {
        return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
    }

    move(vector) {
        if (this.state !== "playing") return;

        let moved = false;

        // 清除 merge 标记 / new 标记
        this.tiles.forEach(t => {
            t.merged = false;
            t.new = false;
        });

        const traversals = this.buildTraversals(vector);

        for (const r of traversals.rows) {
            for (const c of traversals.cols) {
                const tile = this.grid[r][c];
                if (!tile) continue;

                const positions = this.findFarthestPosition({ row: r, col: c }, vector);
                const next = this.grid[positions.next.row]?.[positions.next.col];

                if (next && next.value === tile.value && !next.merged) {
                    // 合并
                    const mergedValue = tile.value * 2;
                    next.value = mergedValue;
                    next.merged = true;

                    this.grid[r][c] = null;

                    this.score += mergedValue;
                    if (this.score > this.best) {
                        this.best = this.score;
                        saveBest2048(this.best);
                    }

                    // 标记 old tile 已经被合并（从 tiles list 删除）
                    this.tiles = this.tiles.filter(t => t !== tile);

                    moved = true;

                    if (mergedValue === 2048 && this.state === "playing") {
                        this.state = "won";
                    }
                } else {
                    // 移动到 farthest 位置
                    if (positions.farthest.row !== r || positions.farthest.col !== c) {
                        this.grid[r][c] = null;
                        this.grid[positions.farthest.row][positions.farthest.col] = tile;
                        tile.row = positions.farthest.row;
                        tile.col = positions.farthest.col;
                        moved = true;
                    }
                }
            }
        }

        if (!moved) return;

        this.addRandomTile();
        this.updateScoreUI();
        this.render();
        this.checkGameOver();
        this.updateStateLabel();
    }

    checkGameOver() {
        if (this.canMove()) return;
        this.state = "over";
    }

    canMove() {
        // 有空格就还能动
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const tile = this.grid[r][c];
                if (!tile) return true;
                // 检查右和下是否能合并
                const right = this.grid[r][c + 1];
                const down = this.grid[r + 1]?.[c];
                if (right && right.value === tile.value) return true;
                if (down && down.value === tile.value) return true;
            }
        }
        return false;
    }

    render() {
        // 删掉所有 DOM tiles，再重新渲染（数量少，性能没问题）
        this.tilesEl.innerHTML = "";

        for (const tile of this.tiles) {
            const el = document.createElement("div");
            el.classList.add("tile-2048");
            el.textContent = tile.value;

            // 颜色 class
            const valueClass = "tile-v-" + Math.min(tile.value, 2048);
            el.classList.add(valueClass);

            if (tile.new) el.classList.add("tile-new");
            if (tile.merged) el.classList.add("tile-merged");

            // 计算像素坐标
            const x = tile.col * (TILE_SIZE + TILE_GAP);
            const y = tile.row * (TILE_SIZE + TILE_GAP);
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;

            this.tilesEl.appendChild(el);
        }
    }
}

// 初始化 & 按钮绑定
let game2048 = null;

function init2048Game() {
    const boardEl = document.getElementById("game2048-board");
    if (!boardEl) return;
    game2048 = new Game2048(boardEl);

    const newGameBtn = document.getElementById("game2048-newgame-btn");
    if (newGameBtn) {
        newGameBtn.addEventListener("click", () => {
            game2048.reset();
        });
    }
}

