// tetris.js - Prismatic Tetris with multi-mode stages, combos, energy meter and neon effects

const TETROMINOES = {
    I: [
        [[0, 1], [1, 1], [2, 1], [3, 1]],
        [[2, 0], [2, 1], [2, 2], [2, 3]],
        [[0, 2], [1, 2], [2, 2], [3, 2]],
        [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
    O: [
        [[1, 0], [2, 0], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
    T: [
        [[1, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [1, 1], [2, 1], [1, 2]],
        [[0, 1], [1, 1], [2, 1], [1, 2]],
        [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
    S: [
        [[1, 0], [2, 0], [0, 1], [1, 1]],
        [[1, 0], [1, 1], [2, 1], [2, 2]],
        [[1, 1], [2, 1], [0, 2], [1, 2]],
        [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
    Z: [
        [[0, 0], [1, 0], [1, 1], [2, 1]],
        [[2, 0], [1, 1], [2, 1], [1, 2]],
        [[0, 1], [1, 1], [1, 2], [2, 2]],
        [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
    J: [
        [[0, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [1, 2]],
        [[0, 1], [1, 1], [2, 1], [2, 2]],
        [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
    L: [
        [[2, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [1, 1], [1, 2], [2, 2]],
        [[0, 1], [1, 1], [2, 1], [0, 2]],
        [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
};

const PIECE_COLORS = {
    I: "#5aaaff",
    O: "#ffd166",
    T: "#c38dff",
    S: "#6bf2a2",
    Z: "#ff6b6b",
    J: "#5ecbff",
    L: "#ffb86c",
};

const MODES = {
    marathon: { label: "Marathon", goalLines: 150, timer: null },
    sprint: { label: "Sprint", goalLines: 40, timer: null },
    ultra: { label: "Ultra", goalLines: Infinity, timer: 120 },
    gauntlet: { label: "Gauntlet", goalLines: 80, timer: null },
};

const STAGES = [
    {
        id: "aurora",
        name: "Stage 1 · Aurora",
        gravity: 1000,
        startGarbage: 0,
        garbageInterval: null,
        modifiers: ["慢速起步", "干净棋盘"],
    },
    {
        id: "storm",
        name: "Stage 2 · Storm Rift",
        gravity: 750,
        startGarbage: 2,
        garbageInterval: 15000,
        modifiers: ["初始垃圾行", "周期性上升垃圾"],
    },
    {
        id: "pulse",
        name: "Stage 3 · Neon Pulse",
        gravity: 600,
        startGarbage: 4,
        garbageInterval: 10000,
        modifiers: ["更快下落", "渐进式垃圾"],
    },
    {
        id: "void",
        name: "Stage 4 · Void Wells",
        gravity: 500,
        startGarbage: 6,
        garbageInterval: 8000,
        modifiers: ["高压下落", "密集垃圾攻击"],
    },
];

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 22; // includes 2 hidden rows at the top
const HIDDEN_ROWS = 2;
const CELL = 32;
const LOCK_DELAY = 500;

function randomBag() {
    const bag = Object.keys(TETROMINOES);
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
}

class TetrisGame {
    constructor() {
        this.canvas = document.getElementById("tetris-canvas");
        this.ctx = this.canvas.getContext("2d");

        this.board = this.createBoard();
        this.current = null;
        this.hold = null;
        this.canHold = true;
        this.queue = [];
        this.lastFall = 0;
        this.fallInterval = 1000;
        this.mode = "marathon";
        this.stage = STAGES[0];

        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.combo = 0;
        this.b2b = 0;
        this.energy = 0;
        this.state = "idle"; // idle | playing | paused | over
        this.lockTimer = null;
        this.timerStart = null;
        this.elapsed = 0;
        this.remainingTime = null;

        this.ui = this.cacheUI();
        this.initStageOptions();
        this.ui.stageSelect.value = this.stage.id;
        this.ui.stageLabel.textContent = this.stage.name;
        this.ui.modeLabel.textContent = MODES[this.mode].label;
        this.bindEvents();
        this.draw();
        this.updateModifiers();
        this.updateUI();
    }

    cacheUI() {
        return {
            score: document.getElementById("tetris-score"),
            lines: document.getElementById("tetris-lines"),
            level: document.getElementById("tetris-level"),
            goal: document.getElementById("tetris-goal"),
            combo: document.getElementById("tetris-combo"),
            b2b: document.getElementById("tetris-b2b"),
            energy: document.getElementById("tetris-energy"),
            energyFill: document.getElementById("tetris-energy-fill"),
            timer: document.getElementById("tetris-timer"),
            message: document.getElementById("tetris-message"),
            modeLabel: document.getElementById("tetris-mode-label"),
            stageLabel: document.getElementById("tetris-stage-label"),
            modeSelect: document.getElementById("tetris-mode-select"),
            stageSelect: document.getElementById("tetris-stage-select"),
            startBtn: document.getElementById("tetris-start-btn"),
            pauseBtn: document.getElementById("tetris-pause-btn"),
            overlay: document.getElementById("tetris-overlay"),
            overlayTitle: document.getElementById("tetris-overlay-title"),
            overlayDesc: document.getElementById("tetris-overlay-desc"),
            overlayPrimary: document.getElementById("tetris-overlay-primary"),
            overlaySecondary: document.getElementById("tetris-overlay-secondary"),
            next: document.getElementById("tetris-next"),
            hold: document.getElementById("tetris-hold"),
            modifiers: document.getElementById("tetris-modifiers"),
        };
    }

    createBoard() {
        return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
    }

    initStageOptions() {
        this.ui.stageSelect.innerHTML = "";
        STAGES.forEach((s) => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = s.name;
            this.ui.stageSelect.appendChild(opt);
        });
    }

    bindEvents() {
        this.ui.modeSelect.addEventListener("change", () => {
            this.mode = this.ui.modeSelect.value;
            this.ui.modeLabel.textContent = MODES[this.mode].label;
            this.updateUI();
        });

        this.ui.stageSelect.addEventListener("change", () => {
            const chosen = STAGES.find((s) => s.id === this.ui.stageSelect.value);
            if (chosen) {
                this.stage = chosen;
                this.ui.stageLabel.textContent = chosen.name;
                this.updateModifiers();
            }
        });

        this.ui.startBtn.addEventListener("click", () => this.startGame());
        this.ui.pauseBtn.addEventListener("click", () => this.togglePause());
        this.ui.overlayPrimary.addEventListener("click", () => this.resumeFromOverlay());
        this.ui.overlaySecondary.addEventListener("click", () => this.startGame());

        window.addEventListener("keydown", (e) => {
            if (!this.isActiveScreen()) return;
            if (this.state !== "playing" && e.code !== "Space") {
                if (this.state === "paused" && e.code === "Space") this.togglePause();
                return;
            }
            if (e.code === "ArrowLeft" || e.code === "KeyA") {
                this.move(-1);
            } else if (e.code === "ArrowRight" || e.code === "KeyD") {
                this.move(1);
            } else if (e.code === "ArrowDown" || e.code === "KeyS") {
                this.softDrop();
            } else if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "KeyE") {
                this.rotate(1);
            } else if (e.code === "KeyQ") {
                this.rotate(-1);
            } else if (e.code === "Space") {
                e.preventDefault();
                if (this.state === "playing") {
                    this.hardDrop();
                } else if (this.state === "paused") {
                    this.togglePause();
                }
            } else if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyC") {
                this.holdPiece();
            } else if (e.code === "KeyP") {
                this.togglePause();
            }
        });
    }

    isActiveScreen() {
        const screen = document.getElementById("tetris-screen");
        return screen && screen.classList.contains("active");
    }

    startGame() {
        this.board = this.createBoard();
        this.queue = randomBag();
        this.spawnPiece();
        this.hold = null;
        this.canHold = true;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.combo = 0;
        this.b2b = 0;
        this.energy = 0;
        this.lastFall = performance.now();
        this.state = "playing";
        this.timerStart = performance.now();
        this.elapsed = 0;
        this.remainingTime = MODES[this.mode].timer;

        this.applyStage();
        this.hideOverlay();
        this.updateUI();
        this.updateModifiers();
        requestAnimationFrame((t) => this.loop(t));
    }

    applyStage() {
        this.stage = STAGES.find((s) => s.id === this.ui.stageSelect.value) || STAGES[0];
        this.ui.stageLabel.textContent = this.stage.name;
        const stageGravity = this.stage.gravity;
        const stageGarbage = this.stage.startGarbage;
        this.fallInterval = this.mode === "gauntlet" ? Math.max(300, stageGravity - 120) : stageGravity;
        if (stageGarbage) {
            for (let i = 0; i < stageGarbage; i++) this.addGarbageLine();
        }
        const baseInterval = this.stage.garbageInterval ?? (this.mode === "gauntlet" ? 7000 : null);
        const interval = this.mode === "gauntlet" && baseInterval ? Math.max(4000, baseInterval - 3000) : baseInterval;
        this.nextGarbageAt = interval ? performance.now() + interval : null;
    }

    updateModifiers() {
        this.ui.modifiers.innerHTML = "";
        this.stage.modifiers.forEach((m) => {
            const li = document.createElement("li");
            li.textContent = m;
            this.ui.modifiers.appendChild(li);
        });
        if (this.mode === "ultra") {
            const li = document.createElement("li");
            li.textContent = "120 秒高分竞速";
            this.ui.modifiers.appendChild(li);
        } else if (this.mode === "sprint") {
            const li = document.createElement("li");
            li.textContent = "40 行冲刺计时";
            this.ui.modifiers.appendChild(li);
        } else if (this.mode === "gauntlet") {
            const li = document.createElement("li");
            li.textContent = "持续垃圾上升";
            this.ui.modifiers.appendChild(li);
        }
    }

    spawnPiece() {
        if (this.queue.length === 0) this.queue = randomBag();
        const type = this.queue.shift();
        const rotations = TETROMINOES[type];
        this.current = {
            type,
            rotation: 0,
            x: 3,
            y: -1,
            blocks: rotations,
        };
        this.canHold = true;
        if (this.collides(this.current, this.current.x, this.current.y)) {
            this.gameOver();
        }
        this.drawPreview();
        this.drawHold();
    }

    holdPiece() {
        if (!this.canHold || !this.current) return;
        const tmp = this.hold;
        this.hold = this.current.type;
        if (tmp) {
            this.current = null;
            this.spawnSpecific(tmp);
        } else {
            this.spawnPiece();
        }
        this.canHold = false;
        this.drawHold();
    }

    spawnSpecific(type) {
        const rotations = TETROMINOES[type];
        this.current = {
            type,
            rotation: 0,
            x: 3,
            y: -1,
            blocks: rotations,
        };
        if (this.collides(this.current, this.current.x, this.current.y)) {
            this.gameOver();
        }
        this.drawPreview();
    }

    collides(piece, ox, oy, rotation = piece.rotation) {
        const shape = piece.blocks[rotation];
        for (const [dx, dy] of shape) {
            const x = ox + dx;
            const y = oy + dy;
            if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) return true;
            if (y >= 0 && this.board[y][x]) return true;
        }
        return false;
    }

    move(dir) {
        if (!this.current) return;
        const nx = this.current.x + dir;
        if (!this.collides(this.current, nx, this.current.y)) {
            this.current.x = nx;
            this.clearLockTimer();
            this.draw();
        }
    }

    rotate(dir) {
        if (!this.current) return;
        const newRot = (this.current.rotation + dir + 4) % 4;
        if (!this.collides(this.current, this.current.x, this.current.y, newRot)) {
            this.current.rotation = newRot;
            this.clearLockTimer();
            this.draw();
        }
    }

    softDrop() {
        if (!this.current) return;
        if (!this.collides(this.current, this.current.x, this.current.y + 1)) {
            this.current.y += 1;
            this.score += 1;
            this.draw();
        } else {
            this.lockPiece();
        }
    }

    hardDrop() {
        if (!this.current) return;
        let dist = 0;
        while (!this.collides(this.current, this.current.x, this.current.y + 1)) {
            this.current.y += 1;
            dist += 1;
        }
        this.score += dist * 2;
        this.clearLockTimer();
        this.lockPiece();
    }

    clearLockTimer() {
        if (this.lockTimer) {
            clearTimeout(this.lockTimer);
            this.lockTimer = null;
        }
    }

    lockPiece() {
        if (!this.current) return;
        this.clearLockTimer();
        this.lockTimer = setTimeout(() => {
            const shape = this.current.blocks[this.current.rotation];
            shape.forEach(([dx, dy]) => {
                const x = this.current.x + dx;
                const y = this.current.y + dy;
                if (y >= 0 && y < BOARD_HEIGHT) {
                    this.board[y][x] = { color: PIECE_COLORS[this.current.type], type: this.current.type };
                }
            });
            this.handleLines();
            this.spawnPiece();
            this.draw();
        }, LOCK_DELAY);
    }

    handleLines() {
        const filledRows = [];
        for (let y = 0; y < BOARD_HEIGHT; y++) {
            if (this.board[y].every((c) => c)) filledRows.push(y);
        }

        if (filledRows.length > 0) {
            filledRows.forEach((row) => {
                this.board.splice(row, 1);
                this.board.unshift(Array(BOARD_WIDTH).fill(null));
            });
            this.lines += filledRows.length;
            const lineScore = [0, 100, 300, 500, 800][filledRows.length] || 1200;
            const b2bBonus = filledRows.length >= 4 ? 1.5 : 1.0;
            const comboBonus = this.combo > 0 ? 1 + this.combo * 0.12 : 1;
            this.score += Math.floor(lineScore * this.level * b2bBonus * comboBonus);

            if (filledRows.length >= 4) {
                this.b2b += 1;
                this.energy = Math.min(100, this.energy + 25);
            } else {
                this.b2b = 0;
                this.energy = Math.min(100, this.energy + 10 * filledRows.length);
            }

            this.combo += 1;
            this.flashBoard();

            if (this.energy >= 100) {
                this.triggerEnergyWave();
            }
        } else {
            this.combo = 0;
        }

        this.level = 1 + Math.floor(this.lines / 10);
        this.fallInterval = Math.max(150, this.stage.gravity - this.level * 40);

        if (this.mode === "sprint" && this.lines >= MODES.sprint.goalLines) {
            this.victory("冲刺完成！");
        } else if (this.mode === "marathon" && this.lines >= MODES.marathon.goalLines) {
            this.victory("马拉松通关！");
        } else if (this.mode === "gauntlet" && this.lines >= MODES.gauntlet.goalLines) {
            this.victory("乱斗逃出生天！");
        }
    }

    flashBoard() {
        this.canvas.classList.remove("tetris-pulse");
        void this.canvas.offsetWidth;
        this.canvas.classList.add("tetris-pulse");
    }

    triggerEnergyWave() {
        let cleared = 0;
        for (let y = BOARD_HEIGHT - 1; y >= 0 && cleared < 2; y--) {
            const occupied = this.board[y].filter(Boolean).length;
            if (occupied >= BOARD_WIDTH - 1) {
                this.board.splice(y, 1);
                this.board.unshift(Array(BOARD_WIDTH).fill(null));
                cleared += 1;
                y++; // re-check same index after unshift
            }
        }
        if (cleared > 0) {
            this.score += cleared * 400;
            this.lines += cleared;
        }
        this.energy = 0;
    }

    addGarbageLine() {
        const hole = Math.floor(Math.random() * BOARD_WIDTH);
        this.board.shift();
        const row = Array.from({ length: BOARD_WIDTH }, (_, i) => (i === hole ? null : { color: "#202035", type: "G" }));
        this.board.push(row);
    }

    togglePause() {
        if (this.state === "playing") {
            this.state = "paused";
            this.showOverlay("Paused", "按下 Resume 或空格继续");
        } else if (this.state === "paused") {
            this.hideOverlay();
            this.state = "playing";
            this.lastFall = performance.now();
            requestAnimationFrame((t) => this.loop(t));
        }
    }

    resumeFromOverlay() {
        if (this.state === "paused") {
            this.togglePause();
        } else if (this.state === "over") {
            this.startGame();
        }
    }

    gameOver() {
        this.state = "over";
        this.showOverlay("Game Over", "再来一局，冲击更高分数！");
    }

    victory(text) {
        this.state = "over";
        this.showOverlay(text, "点击 Restart 再战一把吧。");
    }

    showOverlay(title, desc) {
        this.ui.overlayTitle.textContent = title;
        this.ui.overlayDesc.textContent = desc;
        this.ui.overlayPrimary.textContent = this.state === "over" ? "Restart" : "Resume";
        this.ui.overlaySecondary.textContent = "Restart";
        this.ui.overlay.classList.add("visible");
    }

    hideOverlay() {
        this.ui.overlay.classList.remove("visible");
    }

    loop(timestamp) {
        if (this.state !== "playing") return;
        const delta = timestamp - this.lastFall;

        // timers
        if (this.mode === "ultra") {
            this.remainingTime = Math.max(0, MODES.ultra.timer - (timestamp - this.timerStart) / 1000);
            if (this.remainingTime === 0) {
                this.victory("时间到！");
            }
        } else {
            this.elapsed = (timestamp - this.timerStart) / 1000;
        }

        if (this.stage.garbageInterval && this.nextGarbageAt && timestamp >= this.nextGarbageAt) {
            this.addGarbageLine();
            this.nextGarbageAt = timestamp + this.stage.garbageInterval;
        }

        if (delta > this.fallInterval) {
            if (!this.collides(this.current, this.current.x, this.current.y + 1)) {
                this.current.y += 1;
                this.lastFall = timestamp;
            } else {
                this.lockPiece();
                this.lastFall = timestamp;
            }
            this.draw();
        }

        this.updateUI();
        requestAnimationFrame((t) => this.loop(t));
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // grid background
        for (let y = HIDDEN_ROWS; y < BOARD_HEIGHT; y++) {
            for (let x = 0; x < BOARD_WIDTH; x++) {
                ctx.fillStyle = "rgba(255,255,255,0.02)";
                ctx.fillRect(x * CELL, (y - HIDDEN_ROWS) * CELL, CELL - 1, CELL - 1);
            }
        }

        // placed blocks
        for (let y = 0; y < BOARD_HEIGHT; y++) {
            for (let x = 0; x < BOARD_WIDTH; x++) {
                const cell = this.board[y][x];
                if (cell) {
                    this.drawCell(x, y - HIDDEN_ROWS, cell.color, 0.95);
                }
            }
        }

        // ghost
        if (this.current) {
            const ghostY = this.computeGhostY();
            this.drawPiece(this.current, ghostY, true);
            this.drawPiece(this.current, this.current.y, false);
        }
    }

    drawCell(x, y, color, alpha = 1) {
        if (y < 0) return;
        const ctx = this.ctx;
        const px = x * CELL;
        const py = y * CELL;
        ctx.save();
        ctx.globalAlpha = alpha;
        const grad = ctx.createLinearGradient(px, py, px + CELL, py + CELL);
        grad.addColorStop(0, color);
        grad.addColorStop(1, "#0b0b20");
        ctx.fillStyle = grad;
        drawRoundedRect(ctx, px + 1, py + 1, CELL - 2, CELL - 2, 6);
        ctx.restore();
    }

    drawPiece(piece, yOverride = piece.y, ghost = false) {
        const shape = piece.blocks[piece.rotation];
        shape.forEach(([dx, dy]) => {
            const x = piece.x + dx;
            const y = yOverride + dy - HIDDEN_ROWS;
            this.drawCell(x, y, PIECE_COLORS[piece.type], ghost ? 0.25 : 1);
        });
    }

    computeGhostY() {
        let y = this.current.y;
        while (!this.collides(this.current, this.current.x, y + 1)) {
            y += 1;
        }
        return y;
    }

    drawMini(container, type) {
        container.innerHTML = "";
        const canvas = document.createElement("canvas");
        canvas.width = 140;
        canvas.height = 140;
        const ctx = canvas.getContext("2d");
        if (!type) {
            container.appendChild(canvas);
            return;
        }
        const shape = TETROMINOES[type][0];
        const offsetX = Math.min(...shape.map(([x]) => x));
        const offsetY = Math.min(...shape.map(([, y]) => y));
        shape.forEach(([x, y]) => {
            const px = (x - offsetX + 1) * 28;
            const py = (y - offsetY + 1) * 28;
            ctx.fillStyle = PIECE_COLORS[type];
            drawRoundedRect(ctx, px, py, 26, 26, 6);
        });
        container.appendChild(canvas);
    }

    drawPreview() {
        const preview = this.queue.slice(0, 3);
        this.ui.next.innerHTML = "";
        preview.forEach((type) => {
            const slot = document.createElement("div");
            slot.className = "tetris-mini";
            this.drawMini(slot, type);
            this.ui.next.appendChild(slot);
        });
    }

    drawHold() {
        this.ui.hold.innerHTML = "";
        const slot = document.createElement("div");
        slot.className = "tetris-mini";
        this.drawMini(slot, this.hold);
        this.ui.hold.appendChild(slot);
    }

    updateUI() {
        this.ui.score.textContent = this.score.toLocaleString();
        this.ui.lines.textContent = this.lines;
        this.ui.level.textContent = this.level;
        const goal = MODES[this.mode].goalLines === Infinity ? "—" : MODES[this.mode].goalLines;
        this.ui.goal.textContent = goal;
        this.ui.combo.textContent = this.combo;
        this.ui.b2b.textContent = this.b2b;
        this.ui.energy.textContent = `${Math.round(this.energy)}%`;
        this.ui.energyFill.style.width = `${this.energy}%`;

        if (this.mode === "ultra") {
            this.ui.timer.textContent = `${(this.remainingTime ?? MODES.ultra.timer).toFixed(1)}s`;
        } else {
            this.ui.timer.textContent = `${this.elapsed.toFixed(1)}s`;
        }

        if (this.state === "playing") {
            this.ui.message.textContent = "Neon storm in play — keep stacking!";
        } else if (this.state === "paused") {
            this.ui.message.textContent = "暂停中 · 点击 Resume 或空格继续";
        } else if (this.state === "over") {
            this.ui.message.textContent = "本局已结束 · 点击 Start / Restart 再战";
        } else {
            this.ui.message.textContent = "Choose a mode to begin.";
        }
    }
}

let tetrisGame = null;

function initTetrisGame() {
    tetrisGame = new TetrisGame();
}

window.initTetrisGame = initTetrisGame;