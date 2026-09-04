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
        modifiers: ["Slow start", "Clean board"],
    },
    {
        id: "storm",
        name: "Stage 2 · Storm Rift",
        gravity: 750,
        startGarbage: 2,
        garbageInterval: 15000,
        modifiers: ["Garbage at start", "Periodic garbage waves"],
    },
    {
        id: "pulse",
        name: "Stage 3 · Neon Pulse",
        gravity: 600,
        startGarbage: 4,
        garbageInterval: 10000,
        modifiers: ["Faster fall", "Progressive garbage"],
    },
    {
        id: "void",
        name: "Stage 4 · Void Wells",
        gravity: 500,
        startGarbage: 6,
        garbageInterval: 8000,
        modifiers: ["High-pressure fall", "Dense garbage attacks"],
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
        this.canvas.tabIndex = -1;
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
        this.aiTimer = null;
        this.rafId = null;
        this.pausedAt = null;
        this.timerStart = null;
        this.elapsed = 0;
        this.remainingTime = null;

        this.aiMode = false;
        this.assisted = false;
        this.heldInputs = new Map();
        this.groundResets = 0;
        this.lastClear = '';
        this.clearUntil = 0;
        this.best = 0;
        this.records = new Map();

        this.ui = this.cacheUI();
        this.initStageOptions();
        this.ui.stageSelect.value = this.stage.id;
        this.ui.stageLabel.textContent = this.stage.name;
        this.ui.modeLabel.textContent = MODES[this.mode].label;
        this.bindEvents();
        const suspend = () => {
            if ((!this.isActiveScreen() || document.hidden) && this.state === "playing") this.togglePause();
        };
        document.addEventListener("arcade:screenchange", suspend);
        document.addEventListener("visibilitychange", suspend);
        document.addEventListener('arcade:pause', () => { if (this.isActiveScreen() && this.state === 'playing') this.togglePause(); });
        this.draw();
        this.updateModifiers();
        this.updateUI();
        this.showOverlay('Find your rhythm.', 'Clear full rows, use Hold to plan ahead, and follow the landing guide. Ready when you are.');
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
            aiToggleBtn: document.getElementById("tetris-ai-btn"),
            best: document.getElementById('tetris-best'),
            feedback: document.getElementById('tetris-feedback'),
            progress: document.getElementById('tetris-progress'),
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
            if (this.state === 'playing' || this.state === 'paused') return;
            this.mode = this.ui.modeSelect.value;
            this.ui.modeLabel.textContent = MODES[this.mode].label;
            this.updateUI();
            this.updateModifiers();
        });

        this.ui.stageSelect.addEventListener("change", () => {
            if (this.state === 'playing' || this.state === 'paused') return;
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
        if (this.ui.aiToggleBtn) {
            this.ui.aiToggleBtn.addEventListener("click", () => this.toggleAI());
        }

        window.addEventListener("keydown", (e) => {
            if (!this.isActiveScreen() || document.hidden) return;
            if (e.target instanceof Element && e.target.closest("input, textarea, select, button, a, [role=\"button\"], [contenteditable=\"true\"]")) return;
            if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(e.code)) e.preventDefault();
            if (this.state === "paused") {
                if (["Space", "KeyP", "Escape"].includes(e.code) && !e.repeat) this.togglePause();
                return;
            }
            if (this.state !== "playing") {
                if (['Space', 'Enter'].includes(e.code) && !e.repeat) this.startGame();
                return;
            }
            if (e.repeat) return;
            if (e.code === "ArrowLeft" || e.code === "KeyA") {
                this.pressInput('left');
            } else if (e.code === "ArrowRight" || e.code === "KeyD") {
                this.pressInput('right');
            } else if (e.code === "ArrowDown" || e.code === "KeyS") {
                this.pressInput('down');
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
            } else if (e.code === "KeyP" || e.code === "Escape") {
                if (!e.repeat) this.togglePause();
            } else if (e.code === "KeyB") {
                this.toggleAI();
            }
        });
        window.addEventListener('keyup', e => {
            const action = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down' }[e.code];
            if (action) this.heldInputs.delete(action);
        });
        window.addEventListener('blur', () => {
            this.heldInputs.clear();
            if (this.state === 'playing') this.togglePause();
        });
        document.querySelectorAll('[data-tetris-action]').forEach(button => {
            const action = button.dataset.tetrisAction;
            button.addEventListener('pointerdown', e => {
                if (this.state !== 'playing') return;
                e.preventDefault();
                button.setPointerCapture(e.pointerId);
                this.canvas.focus({ preventScroll: true });
                this.pressInput(action);
            });
            for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => this.heldInputs.delete(action));
            button.addEventListener('click', e => { if (e.detail === 0) this.performAction(action); });
        });
    }

    performAction(action) {
        if (this.state !== 'playing' || this.aiMode) return;
        if (action === 'left') this.move(-1);
        if (action === 'right') this.move(1);
        if (action === 'down') this.softDrop();
        if (action === 'rotate') this.rotate(1);
        if (action === 'reverse') this.rotate(-1);
        if (action === 'hold') this.holdPiece();
        if (action === 'drop') this.hardDrop();
    }

    pressInput(action) {
        this.performAction(action);
        if (['left', 'right', 'down'].includes(action)) this.heldInputs.set(action, performance.now() + (action === 'down' ? 35 : 150));
    }

    updateInput(now) {
        for (const [action, nextAt] of this.heldInputs) {
            if (now < nextAt) continue;
            this.performAction(action);
            this.heldInputs.set(action, now + (action === 'down' ? 35 : 45));
        }
    }

    scheduleFrame() {
        if (this.rafId !== null || this.state !== "playing") return;
        this.rafId = requestAnimationFrame((timestamp) => {
            this.rafId = null;
            this.loop(timestamp);
        });
    }

    stopAsyncWork() {
        this.heldInputs.clear();
        if (this.rafId !== null) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.clearLockTimer();
        clearTimeout(this.aiTimer);
        this.aiTimer = null;
    }

    scheduleAI() {
        clearTimeout(this.aiTimer);
        this.aiTimer = setTimeout(() => {
            this.aiTimer = null;
            this.aiExecute();
        }, 120);
    }

    isActiveScreen() {
        const screen = document.getElementById("tetris-screen");
        return screen && screen.classList.contains("active");
    }

    startGame() {
        this.stopAsyncWork();
        this.state = "idle";
        this.pausedAt = null;
        this.board = this.createBoard();
        this.queue = randomBag();
        this.current = null;
        this.hold = null;
        this.canHold = true;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.combo = 0;
        this.b2b = 0;
        this.energy = 0;
        this.assisted = this.aiMode;
        this.lastClear = '';
        this.best = this.readBest();
        this.lastFall = performance.now();
        this.state = "playing";
        this.timerStart = performance.now();
        this.elapsed = 0;
        this.remainingTime = MODES[this.mode].timer;

        this.applyStage();
        this.hideOverlay();
        this.spawnPiece();
        this.updateUI();
        this.updateModifiers();
        if (this.isActiveScreen()) this.canvas.focus({ preventScroll: true });
        if (window.innerWidth <= 760) this.canvas.closest('.tetris-playfield').scrollIntoView({ block: 'start', behavior: 'smooth' });
        this.scheduleFrame();
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
        this.garbageInterval = interval;
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
            li.textContent = "120-second high-score race";
            this.ui.modifiers.appendChild(li);
        } else if (this.mode === "sprint") {
            const li = document.createElement("li");
            li.textContent = "40-line sprint timer";
            this.ui.modifiers.appendChild(li);
        } else if (this.mode === "gauntlet") {
            const li = document.createElement("li");
            li.textContent = "Continuous garbage rise";
            this.ui.modifiers.appendChild(li);
        }
    }

    spawnPiece() {
        if (this.queue.length < 7) this.queue.push(...randomBag());
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
        this.groundResets = 0;
        if (this.collides(this.current, this.current.x, this.current.y)) {
            this.gameOver();
        }
        this.drawPreview();
        this.drawHold();
        if (this.aiMode && this.state === "playing") {
            this.scheduleAI();
        }
    }

    holdPiece() {
        if (!this.canHold || !this.current) return;
        this.clearLockTimer();
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
        this.groundResets = 0;
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
        if (!this.current || this.state !== 'playing') return;
        const nx = this.current.x + dir;
        if (!this.collides(this.current, nx, this.current.y)) {
            this.current.x = nx;
            this.resetGroundLock();
            this.draw();
        }
    }

    rotate(dir) {
        if (!this.current || this.state !== 'playing') return;
        const newRot = (this.current.rotation + dir + 4) % 4;
        // Small, collision-checked offsets make wall and floor rotations forgiving.
        for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [0, -2]]) {
            if (this.collides(this.current, this.current.x + dx, this.current.y + dy, newRot)) continue;
            this.current.x += dx;
            this.current.y += dy;
            this.current.rotation = newRot;
            this.resetGroundLock();
            window.ArcadeFeedback?.play('move');
            this.draw();
            break;
        }
    }

    resetGroundLock() {
        if (this.lockTimer && this.groundResets < 15) {
            this.groundResets++;
            this.clearLockTimer();
        }
        if (this.current && this.collides(this.current, this.current.x, this.current.y + 1)) this.lockPiece();
    }

    softDrop() {
        if (!this.current || this.state !== 'playing') return;
        if (!this.collides(this.current, this.current.x, this.current.y + 1)) {
            this.current.y += 1;
            this.score += 1;
            this.draw();
        } else {
            this.lockPiece();
        }
    }

    hardDrop() {
        if (!this.current || this.state !== 'playing') return;
        let dist = 0;
        while (!this.collides(this.current, this.current.x, this.current.y + 1)) {
            this.current.y += 1;
            dist += 1;
        }
        this.score += dist * 2;
        this.clearLockTimer();
        this.lockPiece(true);
        window.ArcadeFeedback?.play('score');
    }

    clearLockTimer() {
        if (this.lockTimer) {
            clearTimeout(this.lockTimer);
            this.lockTimer = null;
        }
    }

    lockPiece(immediate = false) {
        if (!this.current || this.state !== "playing") return;
        if (this.lockTimer && !immediate) return;
        this.clearLockTimer();
        const piece = this.current;
        const commit = () => {
            this.lockTimer = null;
            if (this.state !== "playing" || this.current !== piece) return;
            if (!this.collides(piece, piece.x, piece.y + 1)) return;
            const shape = piece.blocks[piece.rotation];
            if (shape.some(([dx, dy]) => piece.y + dy < 0)) {
                this.gameOver();
                return;
            }
            shape.forEach(([dx, dy]) => {
                const x = piece.x + dx;
                const y = piece.y + dy;
                if (y >= 0 && y < BOARD_HEIGHT) {
                    this.board[y][x] = { color: PIECE_COLORS[piece.type], type: piece.type };
                }
            });
            this.current = null;
            this.handleLines();
            if (this.state === "playing") this.spawnPiece();
            this.draw();
            this.updateUI();
        };
        if (immediate) commit();
        else this.lockTimer = setTimeout(commit, LOCK_DELAY);
    }

    handleLines() {
        const filledRows = [];
        for (let y = 0; y < BOARD_HEIGHT; y++) {
            if (this.board[y].every((c) => c)) filledRows.push(y);
        }

        if (filledRows.length > 0) {
            // Filter first: unshifting between splices changes remaining row indices.
            this.board = this.board.filter((_, row) => !filledRows.includes(row));
            while (this.board.length < BOARD_HEIGHT) this.board.unshift(Array(BOARD_WIDTH).fill(null));
            this.lines += filledRows.length;
            const lineScore = [0, 100, 300, 500, 800][filledRows.length] || 1200;
            const b2bBonus = filledRows.length >= 4 && this.b2b > 0 ? 1.5 : 1.0;
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
            this.lastClear = `${['', 'Single', 'Double', 'Triple', 'Tetris!'][filledRows.length] || 'Clear!'}${this.combo > 1 ? ' · ' + this.combo + ' combo' : ''}`;
            this.clearUntil = performance.now() + 1800;
            window.ArcadeFeedback?.play(filledRows.length >= 2 ? 'combo' : 'score');
            this.flashBoard();

            if (this.energy >= 100) {
                this.triggerEnergyWave();
            }
        } else {
            this.combo = 0;
        }

        this.level = 1 + Math.floor(this.lines / 10);
        this.fallInterval = Math.max(120, this.stage.gravity - (this.level - 1) * 45 - (this.mode === 'gauntlet' ? 120 : 0));

        if (this.mode === "sprint" && this.lines >= MODES.sprint.goalLines) {
            this.victory("Sprint Complete!");
        } else if (this.mode === "marathon" && this.lines >= MODES.marathon.goalLines) {
            this.victory("Marathon Clear!");
        } else if (this.mode === "gauntlet" && this.lines >= MODES.gauntlet.goalLines) {
            this.victory("Gauntlet Survived!");
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
        if (this.board[0].some(Boolean)) { this.gameOver(); return; }
        const hole = Math.floor(Math.random() * BOARD_WIDTH);
        this.board.shift();
        const row = Array.from({ length: BOARD_WIDTH }, (_, i) => (i === hole ? null : { color: "#202035", type: "G" }));
        this.board.push(row);
        if (this.current) {
            this.current.y--;
            if (this.collides(this.current, this.current.x, this.current.y)) this.gameOver();
        }
    }

    togglePause() {
        if (this.state === "playing") {
            this.state = "paused";
            this.pausedAt = performance.now();
            this.stopAsyncWork();
            this.updateUI();
            this.showOverlay("Paused", "Press Resume or Space to continue");
        } else if (this.state === "paused") {
            this.hideOverlay();
            this.state = "playing";
            const now = performance.now();
            const pausedFor = this.pausedAt === null ? 0 : now - this.pausedAt;
            this.timerStart += pausedFor;
            if (this.nextGarbageAt) this.nextGarbageAt += pausedFor;
            this.pausedAt = null;
            this.lastFall = now;
            if (this.isActiveScreen()) this.canvas.focus({ preventScroll: true });
            if (this.aiMode) this.scheduleAI();
            this.updateUI();
            this.scheduleFrame();
        }
    }

    resumeFromOverlay() {
        if (this.state === "paused") {
            this.togglePause();
        } else if (this.state === "over" || this.state === 'idle') {
            this.startGame();
        }
    }

    gameOver() {
        this.state = "over";
        this.stopAsyncWork();
        this.finishRecord();
        window.ArcadeFeedback?.play('lose');
        this.showOverlay("One more round?", this.resultText());
        this.updateUI();
    }

    victory(text) {
        this.state = "over";
        this.stopAsyncWork();
        this.finishRecord();
        window.ArcadeFeedback?.play('win');
        this.showOverlay(text, this.resultText());
        this.updateUI();
    }

    showOverlay(title, desc) {
        this.ui.overlayTitle.textContent = title;
        this.ui.overlayDesc.textContent = desc;
        this.ui.overlayPrimary.textContent = this.state === 'idle' ? 'Start game' : this.state === "over" ? "Play again" : "Resume";
        this.ui.overlaySecondary.textContent = "Restart";
        this.ui.overlaySecondary.hidden = this.state !== 'paused';
        this.ui.overlay.classList.add("visible");
    }

    hideOverlay() {
        this.ui.overlay.classList.remove("visible");
    }

    loop(timestamp) {
        if (this.state !== "playing") return;
        if (!this.isActiveScreen() || document.hidden) {
            this.togglePause();
            return;
        }
        this.updateInput(timestamp);
        const delta = timestamp - this.lastFall;
        this.elapsed = Math.max(0, (timestamp - this.timerStart) / 1000);

        // timers
        if (this.mode === "ultra") {
            this.remainingTime = Math.max(0, MODES.ultra.timer - (timestamp - this.timerStart) / 1000);
            if (this.remainingTime === 0) {
                this.victory("时间到！");
                this.updateUI();
                return;
            }
        } else {
            this.elapsed = (timestamp - this.timerStart) / 1000;
        }

        if (this.garbageInterval && this.nextGarbageAt && timestamp >= this.nextGarbageAt) {
            this.addGarbageLine();
            this.nextGarbageAt = timestamp + this.garbageInterval;
            if (this.state !== 'playing') return;
        }

        if (delta > this.fallInterval && this.current) {
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
        this.scheduleFrame();
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

    toggleAI() {
        this.aiMode = !this.aiMode;
        if (this.aiMode && ['playing', 'paused'].includes(this.state)) this.assisted = true;
        if (this.ui.aiToggleBtn) {
            this.ui.aiToggleBtn.textContent = this.aiMode ? "AI: ON" : "AI: OFF";
        }
        if (this.aiMode && this.state === "playing" && this.current) {
            this.scheduleAI();
        }
    }

    // El-Tetris heuristic: evaluate all piece placements and return the best {rotation, x}
    computeBestPlacement() {
        if (!this.current) return null;
        const type = this.current.type;
        const rotations = TETROMINOES[type];
        let bestScore = -Infinity;
        let bestRot = 0, bestX = this.current.x;

        for (let rot = 0; rot < rotations.length; rot++) {
            const shape = rotations[rot];
            const minX = Math.min(...shape.map(([x]) => x));
            const maxX = Math.max(...shape.map(([x]) => x));

            for (let x = -minX; x < BOARD_WIDTH - maxX; x++) {
                // Check if piece can enter from the top
                if (this.collides(this.current, x, -1, rot)) continue;

                // Drop to the lowest valid position
                let y = -1;
                while (!this.collides(this.current, x, y + 1, rot)) y++;

                // Apply piece to a scratch board
                const boardCopy = this.board.map(row => [...row]);
                let valid = true;
                for (const [dx, dy] of shape) {
                    const px = x + dx, py = y + dy;
                    if (py < 0 || py >= BOARD_HEIGHT || px < 0 || px >= BOARD_WIDTH) { valid = false; break; }
                    boardCopy[py][px] = { color: PIECE_COLORS[type], type };
                }
                if (!valid) continue;

                // Clear complete lines
                let lines = 0;
                const newBoard = [];
                for (let row = 0; row < BOARD_HEIGHT; row++) {
                    if (boardCopy[row].every(c => c)) lines++;
                    else newBoard.push(boardCopy[row]);
                }
                while (newBoard.length < BOARD_HEIGHT) newBoard.unshift(Array(BOARD_WIDTH).fill(null));

                // Column heights
                const heights = Array(BOARD_WIDTH).fill(0);
                for (let col = 0; col < BOARD_WIDTH; col++) {
                    for (let row = 0; row < BOARD_HEIGHT; row++) {
                        if (newBoard[row][col]) { heights[col] = BOARD_HEIGHT - row; break; }
                    }
                }

                // Holes (empty cell with filled cell above in same column)
                let holes = 0;
                for (let col = 0; col < BOARD_WIDTH; col++) {
                    let found = false;
                    for (let row = 0; row < BOARD_HEIGHT; row++) {
                        if (newBoard[row][col]) found = true;
                        else if (found) holes++;
                    }
                }

                // Bumpiness (sum of absolute height differences between adjacent columns)
                let bumpiness = 0;
                for (let col = 0; col < BOARD_WIDTH - 1; col++) {
                    bumpiness += Math.abs(heights[col] - heights[col + 1]);
                }

                const aggregateHeight = heights.reduce((s, h) => s + h, 0);

                // El-Tetris weights (Dellacherie heuristic)
                const score = -0.510066 * aggregateHeight
                            + 0.760666 * lines
                            - 0.35663  * holes
                            - 0.184483 * bumpiness;

                if (score > bestScore) {
                    bestScore = score;
                    bestRot = rot;
                    bestX = x;
                }
            }
        }

        return { rotation: bestRot, x: bestX };
    }

    aiExecute() {
        if (!this.current || this.state !== "playing" || !this.aiMode) return;
        const best = this.computeBestPlacement();
        if (!best) return;

        const origY = this.current.y;
        this.current.rotation = best.rotation;
        this.current.x = best.x;

        // Drop piece to bottom
        let y = this.current.y;
        while (!this.collides(this.current, this.current.x, y + 1)) y++;
        this.score += Math.max(0, y - origY) * 2;
        this.current.y = y;

        this.lockPiece(true);
    }

    updateUI() {
        const running = this.state === 'playing' || this.state === 'paused';
        this.ui.modeSelect.disabled = running;
        this.ui.stageSelect.disabled = running;
        this.ui.pauseBtn.disabled = !running;
        this.ui.pauseBtn.textContent = this.state === 'paused' ? 'Resume' : 'Pause';
        this.ui.startBtn.textContent = running ? 'Restart' : 'Start';
        if (this.ui.best) this.ui.best.textContent = this.readBest().toLocaleString();
        if (this.ui.feedback) this.ui.feedback.textContent = performance.now() < this.clearUntil ? this.lastClear : this.assisted ? 'AI-assisted run · personal records paused' : 'Stack smart. Leave room to breathe.';
        if (this.ui.progress) {
            const percent = this.mode === 'ultra' ? this.elapsed / 120 : this.lines / MODES[this.mode].goalLines;
            this.ui.progress.value = Math.min(100, percent * 100);
        }
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
            this.ui.message.textContent = this.aiMode ? 'AI is playing · B to take control' : 'Hold a piece, plan your landing, build a clean stack.';
        } else if (this.state === "paused") {
            this.ui.message.textContent = "Paused · Click Resume or press Space";
        } else if (this.state === "over") {
            this.ui.message.textContent = "Game over · Click Start / Restart to play again";
        } else {
            this.ui.message.textContent = "Choose a mode to begin.";
        }
    }

    readBest() {
        const key = `tetris_best_${this.mode}_${this.stage.id}`;
        if (this.records.has(key)) return this.records.get(key);
        let value = 0;
        try { value = Math.max(0, Number(localStorage.getItem(key)) || 0); } catch {}
        this.records.set(key, value);
        return value;
    }

    finishRecord() {
        if (this.assisted) return;
        this.best = Math.max(this.readBest(), this.score);
        this.records.set(`tetris_best_${this.mode}_${this.stage.id}`, this.best);
        try { localStorage.setItem(`tetris_best_${this.mode}_${this.stage.id}`, String(this.best)); } catch {}
    }

    resultText() {
        return `${this.score.toLocaleString()} points · ${this.lines} lines · ${this.elapsed.toFixed(1)}s. ${this.assisted ? 'AI-assisted practice run.' : 'Best for this mode and stage: ' + this.best.toLocaleString() + '.'}`;
    }
}

let tetrisGame = null;

function initTetrisGame() {
    if (!tetrisGame) tetrisGame = new TetrisGame();
}

window.initTetrisGame = initTetrisGame;
const previousTetrisText = window.render_game_to_text;
window.render_game_to_text = () => document.body.dataset.game === 'tetris' && tetrisGame
    ? JSON.stringify({ game: 'tetris', coordinates: 'x right, y down; rows 0-1 hidden', state: tetrisGame.state, mode: tetrisGame.mode, score: tetrisGame.score, lines: tetrisGame.lines, current: tetrisGame.current && { type: tetrisGame.current.type, x: tetrisGame.current.x, y: tetrisGame.current.y, rotation: tetrisGame.current.rotation }, hold: tetrisGame.hold, queue: tetrisGame.queue.slice(0, 3), board: tetrisGame.board.map(row => row.map(cell => cell?.type || null)), assisted: tetrisGame.assisted })
    : previousTetrisText?.() || JSON.stringify({ game: document.body.dataset.game });
