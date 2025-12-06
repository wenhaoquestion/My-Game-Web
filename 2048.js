// ================= 2048 Config =================

// 默认棋盘大小
const DEFAULT_BOARD_SIZE = 4;

// 逻辑上的“参考”棋盘尺寸，用来算 tile size（和你 CSS 中的内框差不多）
const REF_BOARD_INNER = 72 * 4 + 12 * 3;   // 对应你原来的 4×4 配置
const TILE_GAP = 12;
const BOARD_PADDING = 12;

function bestKeyForSize(size) {
    return `game2048_best_${size}x${size}`;
}

function loadBest2048(size) {
    const raw = localStorage.getItem(bestKeyForSize(size));
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
}

function saveBest2048(size, score) {
    localStorage.setItem(bestKeyForSize(size), String(score));
}

class Game2048 {
    constructor(rootEl, options = {}) {
        this.rootEl = rootEl; // .board-2048 元素
        this.bgEl = rootEl.querySelector("#board-2048-bg");
        this.tilesEl = rootEl.querySelector("#board-2048-tiles");

        this.scoreEl = document.getElementById("game2048-score");
        this.bestEl = document.getElementById("game2048-best");
        this.stateLabelEl = document.getElementById("game2048-state-label");

        this.size = options.size || DEFAULT_BOARD_SIZE;  // 棋盘边长
        this.tileSize = this.computeTileSize(this.size);

        this.score = 0;
        this.best = loadBest2048(this.size);
        this.state = "playing"; // "playing" | "won" | "over"
        this.grid = this.emptyGrid();
        this.tiles = [];
        this.nextTileId = 1;

        this.buildBackground();
        this.bindKeyboard();

        this.updateScoreUI();
        this.reset();
    }

    // 根据 size 计算 tile 像素大小，让整体内框差不多保持不变
    computeTileSize(size) {
        const inner = REF_BOARD_INNER; // 固定目标尺寸
        const totalGap = TILE_GAP * (size - 1);
        return (inner - totalGap) / size;
    }

    // 对外暴露：修改棋盘大小，比如 game2048.setBoardSize(5)
    setBoardSize(newSize) {
        if (newSize < 3 || newSize > 6) return; // 限制范围，你可以改
        this.size = newSize;
        this.tileSize = this.computeTileSize(newSize);
        this.best = loadBest2048(this.size);

        // 更新背景格子 + 状态
        this.buildBackground();
        this.reset();
    }

    emptyGrid() {
        return Array.from({ length: this.size }, () =>
            Array.from({ length: this.size }, () => null)
        );
    }

    buildBackground() {
        this.bgEl.innerHTML = "";
        // 更新 CSS 网格列数
        this.bgEl.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;

        for (let i = 0; i < this.size * this.size; i++) {
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
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
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
        for (let i = 0; i < this.size; i++) {
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
        return r >= 0 && r < this.size && c >= 0 && c < this.size;
    }

    pulseBoard(maxMerge) {
        const el = this.rootEl;
        // 去掉再加 class 以重新触发动画
        el.classList.remove("board-pulse", "board-pulse-strong");
        // 强制 reflow
        void el.offsetWidth;

        if (maxMerge >= 512) {
            el.classList.add("board-pulse-strong");
        } else {
            el.classList.add("board-pulse");
        }
    }

    move(vector) {
        if (this.state !== "playing") return;

        let moved = false;
        let anyMerged = false;
        let maxMergeValue = 0;

        // 清除 merge / new 标记
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
                        saveBest2048(this.size, this.best);
                    }

                    this.tiles = this.tiles.filter(t => t !== tile);

                    moved = true;
                    anyMerged = true;
                    if (mergedValue > maxMergeValue) maxMergeValue = mergedValue;

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

        if (anyMerged) {
            this.pulseBoard(maxMergeValue);
        }
    }

    checkGameOver() {
        if (this.canMove()) return;
        this.state = "over";
    }

    canMove() {
        // 有空格就还能动
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const tile = this.grid[r][c];
                if (!tile) return true;
                const right = this.grid[r][c + 1];
                const down = this.grid[r + 1]?.[c];
                if (right && right.value === tile.value) return true;
                if (down && down.value === tile.value) return true;
            }
        }
        return false;
    }

    render() {
        // 简单做法：清 DOM，再渲染（数量不大）
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

            // 高数值 tile 增加 glow
            if (tile.value >= 128 && tile.value < 512) {
                el.classList.add("tile-glow");
            } else if (tile.value >= 512) {
                el.classList.add("tile-glow-strong");
            }

            // 设置动态宽高
            el.style.width = `${this.tileSize}px`;
            el.style.height = `${this.tileSize}px`;

            // 计算像素坐标
            const x = tile.col * (this.tileSize + TILE_GAP);
            const y = tile.row * (this.tileSize + TILE_GAP);
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

    // （可选）如果你在 HTML 里做了棋盘大小控制，比如：
    // <button data-size="4">4x4</button> 等，这里统一挂事件就行：
    const sizeButtons = document.querySelectorAll("[data-board-size]");
    sizeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const s = parseInt(btn.dataset.boardSize, 10);
            if (Number.isFinite(s)) {
                game2048.setBoardSize(s);
            }
        });
    });
}
