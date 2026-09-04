// ================== Config ==================
const CELL_SIZE = 24;
const GRID_WIDTH = 26;
const GRID_HEIGHT = 22;
const PANEL_HEIGHT = 0;
const FPS_BASE = 10;

const CANVAS_WIDTH = CELL_SIZE * GRID_WIDTH;
const CANVAS_HEIGHT = CELL_SIZE * GRID_HEIGHT + PANEL_HEIGHT;

const BG_COLOR_TOP = [20, 20, 40];
const BG_COLOR_BOTTOM = [5, 5, 10];
const GRID_COLOR = [40, 40, 70];
const PANEL_COLOR = [15, 15, 25];
const TEXT_COLOR = "#e6e6f0";
const ACCENT_COLOR = "#5aaaff";
const OBSTACLE_COLOR = [120, 90, 160];

const HIGHSCORE_KEY = "snake_highscore_web";

// Skins
const SKINS = [
    {
        name: "Green",
        snake: [60, 220, 120],
        head: [80, 255, 160],
        food: [240, 80, 80],
        super_food: [255, 220, 70],
    },
    {
        name: "Blue",
        snake: [120, 140, 255],
        head: [180, 200, 255],
        food: [255, 120, 220],
        super_food: [255, 255, 255],
    },
    {
        name: "Warm",
        snake: [255, 160, 80],
        head: [255, 210, 120],
        food: [255, 110, 110],
        super_food: [255, 255, 150],
    },
];

// ============ Helpers ============

function loadHighscore() {
    try {
        const n = parseInt(window.localStorage.getItem(HIGHSCORE_KEY), 10);
        return Number.isFinite(n) ? n : 0;
    } catch { return 0; }
}

function saveHighscore(score) {
    try { window.localStorage.setItem(HIGHSCORE_KEY, String(score)); } catch { /* Scores remain available in this session. */ }
}

function lerpColor(c1, c2, t) {
    return [
        c1[0] * (1 - t) + c2[0] * t,
        c1[1] * (1 - t) + c2[1] * t,
        c1[2] * (1 - t) + c2[2] * t,
    ];
}

function roundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function colorToCss(c, alpha = 1) {
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

// 简单粒子效果：吃到食物时闪一下
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 80;
        this.vy = (Math.random() - 0.5) * 80;
        this.life = 0.3;
        this.color = color;
    }

    update(dt) {
        this.life -= dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const alpha = Math.max(0, this.life / 0.3);
        ctx.fillStyle = colorToCss(this.color, alpha);
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============ Core Classes ============

class Snake {
    constructor(body, direction) {
        this.body = body; // array of {x,y}
        this.direction = direction;
        this.pendingDirection = { ...direction };
        this.directionQueue = [];
        this.deathReason = "";
        this.growPending = 0;
        this.alive = true;
    }

    changeDirection(newDir) {
        const previous = this.directionQueue.at(-1) || this.direction;
        if (this.directionQueue.length >= 2 ||
            (newDir.x === previous.x && newDir.y === previous.y) ||
            (newDir.x === -previous.x && newDir.y === -previous.y)) return false;
        this.directionQueue.push({ ...newDir });
        this.pendingDirection = { ...this.directionQueue[0] };
        return true;
    }

    step(wrap) {
        if (!this.alive) return;

        this.direction = this.directionQueue.shift() || this.direction;
        this.pendingDirection = { ...(this.directionQueue[0] || this.direction) };

        const head = this.body[0];
        let nx = head.x + this.direction.x;
        let ny = head.y + this.direction.y;

        if (wrap) {
            nx = (nx + GRID_WIDTH) % GRID_WIDTH;
            ny = (ny + GRID_HEIGHT) % GRID_HEIGHT;
        } else {
            if (
                nx < 0 || nx >= GRID_WIDTH ||
                ny < 0 || ny >= GRID_HEIGHT
            ) {
                this.deathReason = "wall";
                this.alive = false;
                return;
            }
        }

        const newHead = { x: nx, y: ny };

        const bodyToCheck =
            this.growPending > 0
                ? this.body
                : this.body.slice(0, this.body.length - 1);

        if (bodyToCheck.some(seg => seg.x === nx && seg.y === ny)) {
            this.deathReason = "tail";
            this.alive = false;
            return;
        }

        // 正式移动
        this.body.unshift(newHead);
        if (this.growPending > 0) {
            this.growPending -= 1;
        } else {
            this.body.pop();
        }
    }


    grow(amount = 1) {
        this.growPending += amount;
    }

    draw(ctx, skin, glowPhase) {
        const snakeColor = skin.snake;
        const headColor = skin.head;

        for (let i = 0; i < this.body.length; i++) {
            const seg = this.body[i];
            const px = seg.x * CELL_SIZE;
            const py = seg.y * CELL_SIZE;
            const rectX = px + 2;
            const rectY = py + 2;
            const rectW = CELL_SIZE - 4;
            const rectH = CELL_SIZE - 4;

            let color;
            if (i === 0) {
                const pulse = 0.6 + 0.4 * Math.sin(glowPhase * 4);
                color = [
                    headColor[0] * pulse,
                    headColor[1] * pulse,
                    headColor[2] * pulse,
                ];
            } else {
                const t = i / Math.max(1, this.body.length - 1);
                const darkTail = [
                    Math.floor(snakeColor[0] * 0.25),
                    Math.floor(snakeColor[1] * 0.25),
                    Math.floor(snakeColor[2] * 0.25),
                ];
                color = lerpColor(snakeColor, darkTail, t);
            }

            // subtle outline
            ctx.fillStyle = colorToCss([0, 0, 0], 0.3);
            roundedRect(ctx, rectX - 1, rectY - 1, rectW + 2, rectH + 2, 9);
            ctx.fill();

            // body
            ctx.fillStyle = colorToCss(color);
            roundedRect(ctx, rectX, rectY, rectW, rectH, 8);
            ctx.fill();
        }
    }
}

class Food {
    constructor(pos, isSuper = false, lifetime = 0) {
        this.pos = pos;
        this.isSuper = isSuper;
        this.lifetime = lifetime;
    }

    draw(ctx, t, skin) {
        const { x, y } = this.pos;
        const px = x * CELL_SIZE;
        const py = y * CELL_SIZE;

        const rectX = px + 4;
        const rectY = py + 4;
        const rectW = CELL_SIZE - 8;
        const rectH = CELL_SIZE - 8;

        const foodColor = skin.food;
        const superColor = skin.super_food;

        if (this.isSuper) {
            const pulse = 0.5 + 0.5 * Math.sin(t * 6);
            const base = [
                superColor[0] * (0.7 + 0.3 * pulse),
                superColor[1] * (0.7 + 0.3 * pulse),
                superColor[2] * (0.7 + 0.3 * pulse),
            ];

            ctx.fillStyle = colorToCss(base);
            roundedRect(ctx, rectX, rectY, rectW, rectH, 10);
            ctx.fill();

            // highlight ring
            ctx.strokeStyle = "rgba(255,255,255,0.85)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(
                rectX + rectW / 2,
                rectY + rectH / 2,
                rectW / 2 - 4,
                rectH / 2 - 4,
                0, 0, Math.PI * 2
            );
            ctx.stroke();
        } else {
            ctx.fillStyle = colorToCss(foodColor);
            roundedRect(ctx, rectX, rectY, rectW, rectH, 10);
            ctx.fill();
        }
    }
}

class PowerUp {
    constructor(pos, kind, duration = 8) {
        this.pos = pos;
        this.kind = kind; // "slow" | "fast"
        this.duration = duration;
    }

    draw(ctx, t) {
        const { x, y } = this.pos;
        const px = x * CELL_SIZE;
        const py = y * CELL_SIZE;
        const rectX = px + 5;
        const rectY = py + 5;
        const rectW = CELL_SIZE - 10;
        const rectH = CELL_SIZE - 10;

        const pulse = 0.5 + 0.5 * Math.sin(t * 5);
        let baseColor, letter;
        if (this.kind === "slow") {
            baseColor = [90, 200, 255];
            letter = "S";
        } else {
            baseColor = [255, 140, 90];
            letter = "F";
        }
        const col = [
            baseColor[0] * (0.7 + 0.3 * pulse),
            baseColor[1] * (0.7 + 0.3 * pulse),
            baseColor[2] * (0.7 + 0.3 * pulse),
        ];

        ctx.fillStyle = colorToCss(col, 0.9);
        roundedRect(ctx, rectX, rectY, rectW, rectH, 8);
        ctx.fill();

        ctx.fillStyle = "rgba(10,10,20,0.95)";
        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letter, rectX + rectW / 2, rectY + rectH / 2);
    }
}

class Level {
    constructor(name, obstacles) {
        this.name = name;
        this.obstacles = obstacles; // array of {x,y}
    }
}

// ============ Game ============

class SnakeGame {
    constructor(canvas, uiRefs) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;

        this.state = "ready"; // ready | countdown | running | paused | game_over
        this.rafId = null;
        this.lastFrame = null;
        this.countdownRemaining = 0;
        this.fruitCount = 0;
        this.feedbackRemaining = 0;
        this.resultReason = "";
        this.mode = "Classic";
        this.speedLevel = 2;
        this.skinIndex = 0;
        this.levels = [];
        this.levelIndex = 0;

        this.elapsedTime = 0;
        this.moveAcc = 0;
        this.score = 0;
        this.highscore = loadHighscore();

        this.snake = null;
        this.food = null;
        this.superFood = null;
        this.superFoodTimer = 0;
        this.superFoodInterval = 12;

        this.powerups = [];
        this.powerupTimer = 0;
        this.nextPowerupTime = 8 + Math.random() * 8;
        this.activeSpeedEffect = null;
        this.speedEffectTime = 0;

        this.particles = [];

        this.trail = [];

        this.ui = uiRefs;

        this.createLevels();
        this.addEventListeners();
        this.addTouchControls();
        this.updateUI();

    }

    get currentSkin() {
        return SKINS[this.skinIndex];
    }

    get currentLevel() {
        return this.levels[this.levelIndex];
    }

    createLevels() {
        const levels = [];

        // Level 0
        levels.push(new Level("Free Practice", []));

        // Level 1
        const box = [];
        // 上下边
        for (let x = 0; x < GRID_WIDTH; x++) {
            box.push({ x, y: 0 });
            box.push({ x, y: GRID_HEIGHT - 1 });
        }
        // 左右边
        for (let y = 1; y < GRID_HEIGHT - 1; y++) {
            box.push({ x: 0, y });
            box.push({ x: GRID_WIDTH - 1, y });
        }
        levels.push(new Level("Box Arena", box));

        // Level 2
        const cross = [];
        const midX = Math.floor(GRID_WIDTH / 2);
        const midY = Math.floor(GRID_HEIGHT / 2);

        // 水平线
        for (let x = 0; x < GRID_WIDTH; x++) {
            if ([5, midX, GRID_WIDTH - 6].some(gap => Math.abs(x - gap) <= 1)) continue;
            cross.push({ x, y: midY });
        }
        // 垂直线
        for (let y = 0; y < GRID_HEIGHT; y++) {
            if ([5, midY, GRID_HEIGHT - 6].some(gap => Math.abs(y - gap) <= 1)) continue;
            cross.push({ x: midX, y });
        }
        levels.push(new Level("Crossroads", cross));

        // Level 3
        const stripes = [];
        for (let x = 2; x < GRID_WIDTH - 2; x += 3) {
            for (let y = 2; y < GRID_HEIGHT - 2; y++) {
                stripes.push({ x, y });
            }
        }
        levels.push(new Level("Striped Corridor", stripes));


        this.levels = levels;

        if (this.levelIndex < 0 || this.levelIndex >= this.levels.length) {
            this.levelIndex = 0;
        }
    }


    findSafeSpawn() {
        const blocked = new Set(this.currentLevel.obstacles.map(p => `${p.x},${p.y}`));
        const preferred = { x: Math.floor(GRID_WIDTH / 3), y: Math.floor(GRID_HEIGHT / 2) };
        const positions = [];
        for (let y = 3; y < GRID_HEIGHT - 3; y++) {
            for (let x = 3; x < GRID_WIDTH - 3; x++) positions.push({ x, y });
        }
        positions.sort((a, b) => Math.abs(a.x - preferred.x) + Math.abs(a.y - preferred.y) - Math.abs(b.x - preferred.x) - Math.abs(b.y - preferred.y));
        for (const head of positions) {
            for (const direction of [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]) {
                let clear = true;
                for (let offset = -2; offset <= 6; offset++) {
                    const x = head.x + offset * direction.x;
                    const y = head.y + offset * direction.y;
                    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT || blocked.has(`${x},${y}`)) { clear = false; break; }
                }
                if (clear) return [head, direction];
            }
        }
        return [{ x: 3, y: 1 }, { x: 1, y: 0 }];
    }

    findReachableCells() {
        const blocked = new Set(this.currentLevel.obstacles.map(p => `${p.x},${p.y}`));
        const visited = new Set();
        const queue = [this.snake.body[0]];
        for (let index = 0; index < queue.length; index++) {
            let { x, y } = queue[index];
            if (this.mode === "Portal (Wrap)") {
                x = (x + GRID_WIDTH) % GRID_WIDTH;
                y = (y + GRID_HEIGHT) % GRID_HEIGHT;
            }
            const key = `${x},${y}`;
            if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT || blocked.has(key) || visited.has(key)) continue;
            visited.add(key);
            queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
        }
        return visited;
    }

    resetGame() {
        this.state = "ready";
        this.fruitCount = 0;
        this.resultReason = "";
        this.feedbackRemaining = 0;
        if (this.ui.feedback) { this.ui.feedback.textContent = ""; this.ui.feedback.classList.remove("visible"); }
        const [startPos, dir] = this.findSafeSpawn();
        this.snake = new Snake(
            [
                startPos,
                { x: startPos.x - dir.x, y: startPos.y - dir.y },
                { x: startPos.x - 2 * dir.x, y: startPos.y - 2 * dir.y },
            ],
            dir
        );

        this.score = 0;
        this.elapsedTime = 0;
        this.moveAcc = 0;
        this.food = null;
        this.reachableCells = this.findReachableCells();
        this.superFood = null;
        this.superFoodTimer = 0;
        this.powerups = [];
        this.powerupTimer = 0;
        this.nextPowerupTime = 8 + Math.random() * 8;
        this.activeSpeedEffect = null;
        this.speedEffectTime = 0;
        this.particles = [];
        this.trail = [];

        this.spawnFood(false);
        this.updateUI();
    }

    spawnFood(isSuper) {
        const occupied = new Set();
        if (this.snake) {
            this.snake.body.forEach(p => occupied.add(`${p.x},${p.y}`));
        }
        if (this.food) occupied.add(`${this.food.pos.x},${this.food.pos.y}`);
        if (this.superFood) occupied.add(`${this.superFood.pos.x},${this.superFood.pos.y}`);
        this.currentLevel.obstacles.forEach(p => occupied.add(`${p.x},${p.y}`));
        this.powerups.forEach(p => occupied.add(`${p.pos.x},${p.pos.y}`));

        const freeCells = [];
        for (let x = 0; x < GRID_WIDTH; x++) {
            for (let y = 0; y < GRID_HEIGHT; y++) {
                if (!occupied.has(`${x},${y}`) && this.reachableCells.has(`${x},${y}`)) freeCells.push({ x, y });
            }
        }
        if (freeCells.length === 0) {
            if (!isSuper && (this.superFood || this.powerups.length)) {
                this.superFood = null;
                this.powerups = [];
                return this.spawnFood(false);
            }
            if (!isSuper) this.food = null;
            return false;
        }
        const pos = freeCells[Math.floor(Math.random() * freeCells.length)];
        if (isSuper) {
            this.superFood = new Food(pos, true, 8);
        } else {
            this.food = new Food(pos, false, 0);
        }
        return true;
    }

    spawnPowerup() {
        const occupied = new Set();
        if (this.snake) {
            this.snake.body.forEach(p => occupied.add(`${p.x},${p.y}`));
        }
        if (this.food) occupied.add(`${this.food.pos.x},${this.food.pos.y}`);
        if (this.superFood) occupied.add(`${this.superFood.pos.x},${this.superFood.pos.y}`);
        this.currentLevel.obstacles.forEach(p => occupied.add(`${p.x},${p.y}`));
        this.powerups.forEach(p => occupied.add(`${p.pos.x},${p.pos.y}`));

        const freeCells = [];
        for (let x = 0; x < GRID_WIDTH; x++) {
            for (let y = 0; y < GRID_HEIGHT; y++) {
                if (!occupied.has(`${x},${y}`) && this.reachableCells.has(`${x},${y}`)) freeCells.push({ x, y });
            }
        }
        if (freeCells.length === 0) return;
        const pos = freeCells[Math.floor(Math.random() * freeCells.length)];
        const kind = Math.random() < 0.5 ? "slow" : "fast";
        this.powerups.push(new PowerUp(pos, kind, 8));
    }

    applySpeedEffect(kind) {
        this.activeSpeedEffect = kind;
        this.speedEffectTime = 8;
        this.showFeedback(kind === "slow" ? "A little breathing room · 8s" : "Pick up the pace · 8s");
        window.ArcadeFeedback?.play("score");
        this.updateUI();
    }

    // ---------- UI 绑定 & 按键 ----------

    addEventListeners() {
        window.addEventListener("keydown", (event) => {
            if (!this.isActiveScreen() || document.hidden || event.target.closest?.('input, textarea, select, button, a, [role="button"], [contenteditable="true"]')) return;
            const directions = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
            const direction = directions[event.key] || directions[event.key.toLowerCase()];
            if (direction) {
                event.preventDefault();
                if (!event.repeat) this.steer({ x: direction[0], y: direction[1] });
            } else if ([" ", "Escape", "p", "P"].includes(event.key)) {
                event.preventDefault();
                if (event.repeat) return;
                if (this.state === "ready" || this.state === "game_over") { if (event.key === " ") this.startGame(); }
                else this.togglePause();
            } else if (event.key.toLowerCase() === "r" && ["ready", "game_over"].includes(this.state)) {
                event.preventDefault();
                if (!event.repeat) this.startGame();
            }
        });
        document.addEventListener("arcade:screenchange", () => this.syncActivity());
        document.addEventListener("visibilitychange", () => this.syncActivity());
        document.addEventListener("arcade:pause", event => { if (event.detail?.gameId === "snake") this.pauseGame(); });
        window.addEventListener("blur", () => { if (this.isActiveScreen()) this.pauseGame(); });
        this.ui.startBtn?.addEventListener("click", () => this.startGame());
        this.ui.pauseBtn?.addEventListener("click", () => this.togglePause());
        this.ui.overlayPrimary?.addEventListener("click", () => this.state === "paused" ? this.resumeGame() : this.startGame());
        this.ui.overlaySecondary?.addEventListener("click", () => this.finishRun("Run complete", "A good moment for a fresh start."));
        for (const control of [this.ui.modeSelect, this.ui.speedSelect, this.ui.levelSelect]) {
            control?.addEventListener("change", () => {
                if (!["ready", "game_over"].includes(this.state)) return;
                this.readSettings();
                this.resetGame();
                this.showStateOverlay();
                this.draw();
            });
        }
        this.ui.skinSelect?.addEventListener("change", () => {
            this.skinIndex = Number(this.ui.skinSelect.value);
            this.draw();
        });
        const vectors = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
        document.querySelectorAll('[data-snake-direction]').forEach(button => {
            const turn = () => { this.steer(vectors[button.dataset.snakeDirection]); this.canvas.focus({ preventScroll: true }); };
            button.addEventListener("pointerdown", event => { event.preventDefault(); turn(); });
            button.addEventListener("click", event => { if (event.detail === 0) turn(); });
        });
    }

    isActiveScreen() {
        return document.getElementById("snake-screen")?.classList.contains("active");
    }

    steer(direction) {
        if (["running", "countdown"].includes(this.state)) this.snake?.changeDirection(direction);
    }

    addTouchControls() {
        let gesture = null;
        const move = event => {
            if (!gesture || event.pointerId !== gesture.id) return;
            const dx = event.clientX - gesture.x;
            const dy = event.clientY - gesture.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
            this.steer(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
            gesture.x = event.clientX;
            gesture.y = event.clientY;
        };
        this.canvas.addEventListener("pointerdown", event => {
            if (event.button !== 0 || !this.isActiveScreen()) return;
            gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
            this.canvas.setPointerCapture(event.pointerId);
            this.canvas.focus({ preventScroll: true });
        });
        this.canvas.addEventListener("pointermove", move);
        this.canvas.addEventListener("pointerup", event => { move(event); gesture = null; });
        this.canvas.addEventListener("pointercancel", () => { gesture = null; });
    }

    readSettings() {
        this.mode = this.ui.modeSelect?.value || "Classic";
        this.speedLevel = Number(this.ui.speedSelect?.value || 2);
        this.levelIndex = Number(this.ui.levelSelect?.value || 0);
        this.skinIndex = Number(this.ui.skinSelect?.value || 0);
    }

    startGame() {
        this.readSettings();
        this.resetGame();
        this.state = "countdown";
        this.countdownRemaining = 1.5;
        this.lastFrame = null;
        this.showStateOverlay();
        this.updateUI();
        this.canvas.focus({ preventScroll: true });
        this.scheduleFrame();
    }

    pauseGame() {
        if (!["running", "countdown"].includes(this.state)) return;
        this.state = "paused";
        this.snake.directionQueue = [];
        this.snake.pendingDirection = { ...this.snake.direction };
        this.moveAcc = 0;
        this.showStateOverlay();
        this.updateUI();
        this.stopLoop();
        this.draw();
    }

    resumeGame() {
        if (this.state !== "paused") return;
        this.state = "countdown";
        this.countdownRemaining = 1;
        this.lastFrame = null;
        this.showStateOverlay();
        this.updateUI();
        this.canvas.focus({ preventScroll: true });
        this.scheduleFrame();
    }

    togglePause() {
        if (this.state === "paused") this.resumeGame();
        else this.pauseGame();
    }

    scheduleFrame() {
        if (this.rafId !== null || !this.isActiveScreen() || document.hidden) return;
        this.rafId = requestAnimationFrame(now => {
            this.rafId = null;
            const dt = this.lastFrame === null ? 0 : Math.min((now - this.lastFrame) / 1000, 0.05);
            this.lastFrame = now;
            this.update(dt);
            this.draw();
            if (["running", "countdown"].includes(this.state) || this.particles.length) this.scheduleFrame();
        });
    }

    stopLoop() {
        if (this.rafId !== null) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.lastFrame = null;
    }

    syncActivity() {
        if (!this.isActiveScreen() || document.hidden) { this.pauseGame(); this.stopLoop(); return; }
        this.lastFrame = null;
        this.draw();
        this.scheduleFrame();
    }

    showFeedback(text) {
        this.feedbackRemaining = 2.4;
        if (this.ui.feedback) { this.ui.feedback.textContent = text; this.ui.feedback.classList.add("visible"); }
    }

    showStateOverlay() {
        const ui = this.ui;
        if (!ui.overlay) return;
        ui.overlay.hidden = this.state === "running";
        if (this.state !== "running") ui.feedback?.classList.remove("visible");
        ui.resultStats.hidden = this.state !== "game_over";
        ui.overlaySecondary.hidden = this.state !== "paused";
        ui.overlayPrimary.hidden = this.state === "countdown";
        ui.overlayTip.hidden = this.state === "countdown";
        ui.overlay.classList.toggle("is-countdown", this.state === "countdown");
        const content = {
            ready: ["A fresh start", "Find your rhythm.", "Collect fruit, leave room to turn, and make every move count.", "Start run →"],
            paused: ["Take a breath", "Your run is waiting.", "Your score and position are saved. Resume when you’re ready.", "Resume →"],
            game_over: ["That’s a wrap", this.resultTitle || "Run complete", this.resultReason, "Try again →"],
            countdown: ["Get ready", String(Math.ceil(this.countdownRemaining * 2)), "Find your first turn.", ""],
        }[this.state];
        if (content) [ui.overlayEyebrow.textContent, ui.overlayTitle.textContent, ui.overlayDesc.textContent, ui.overlayPrimary.textContent] = content;
        if (this.state === "game_over") {
            ui.resultStats.replaceChildren(...[["Score", this.score], ["Fruit", this.fruitCount], ["Time", this.formatTime()]].map(([label, value]) => {
                const item = document.createElement("div");
                const number = document.createElement("strong"); number.textContent = value;
                const caption = document.createElement("span"); caption.textContent = label;
                item.append(number, caption); return item;
            }));
        }
    }

    formatTime() {
        const seconds = Math.floor(this.elapsedTime);
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    }

    collectFruit(isGolden) {
        this.fruitCount += 1;
        this.score += isGolden ? 40 : 10;
        if (this.fruitCount % 5 === 0) {
            this.score += 25;
            this.showFeedback("Harvest complete · +25 bonus");
            window.ArcadeFeedback?.play("combo");
        } else {
            this.showFeedback(isGolden ? "Golden find · +40" : "+10 · Keep growing");
            window.ArcadeFeedback?.play("score");
        }
        if (this.score > this.highscore) { this.highscore = this.score; saveHighscore(this.highscore); }
        this.updateUI();
    }

    toggleMode() {
        if (this.mode === "Classic") {
            this.mode = "Portal (Wrap)";
        } else {
            this.mode = "Classic";
        }
        this.resetGame();
        this.updateUI();
    }

    toggleSpeed() {
        this.speedLevel = (this.speedLevel % 3) + 1;
        this.updateUI();
    }

    toggleSkin() {
        this.skinIndex = (this.skinIndex + 1) % SKINS.length;
        this.updateUI();
    }

    toggleLevel() {
        this.levelIndex = (this.levelIndex + 1) % this.levels.length;
        this.resetGame();
        this.updateUI();
    }

    updateUI() {
        const ui = this.ui;
        if (ui.scoreLabel) ui.scoreLabel.textContent = String(this.score);
        if (ui.highscoreLabel) ui.highscoreLabel.textContent = String(this.highscore);
        if (ui.fruitCount) ui.fruitCount.textContent = String(this.fruitCount);
        if (ui.runTime) ui.runTime.textContent = this.formatTime();
        if (ui.stateBadge) ui.stateBadge.textContent = { ready: "Ready", countdown: "Get ready", running: "In play", paused: "Paused", game_over: "Run complete" }[this.state];
        if (ui.startBtn) ui.startBtn.textContent = ["ready", "game_over"].includes(this.state) ? "Start run" : "New run";
        if (ui.pauseBtn) { ui.pauseBtn.disabled = ["ready", "game_over"].includes(this.state); ui.pauseBtn.textContent = this.state === "paused" ? "Resume" : "Pause"; }
        for (const control of [ui.modeSelect, ui.speedSelect, ui.levelSelect]) if (control) control.disabled = !["ready", "game_over"].includes(this.state);
        const progress = this.fruitCount % 5;
        if (ui.goalCount) ui.goalCount.textContent = `${progress} / 5 fruit`;
        if (ui.goalLabel) ui.goalLabel.textContent = this.fruitCount < 5 ? "First harvest" : `Harvest ${Math.floor(this.fruitCount / 5) + 1}`;
        if (ui.goalFill) ui.goalFill.style.width = `${progress * 20}%`;
        if (ui.goalProgress) ui.goalProgress.setAttribute("aria-valuenow", String(progress));
        if (ui.statusLabel) {
            ui.statusLabel.textContent = this.activeSpeedEffect ? `${this.activeSpeedEffect === "slow" ? "Slowed" : "Boosted"} · ${Math.ceil(this.speedEffectTime)}s left` : {
                ready: "Choose your setup, then start.", countdown: "A moment to find your bearings.", running: "Every 5 fruit earns a harvest bonus.", paused: "Your progress is safe.", game_over: "A fresh run is one click away.",
            }[this.state];
        }
    }

    finishRun(title, reason) {
        if (this.state === "game_over") return;
        this.state = "game_over";
        this.resultTitle = title;
        this.resultReason = reason;
        if (this.score > this.highscore) { this.highscore = this.score; saveHighscore(this.highscore); }
        this.showStateOverlay();
        this.updateUI();
        this.scheduleFrame();
    }

    onGameOver() {
        this.spawnDeathParticles();
        const reason = { wall: "The edge caught you. Try Portal mode to wrap around the field.", tail: "You crossed your own path. Leave a little more room for the next turn.", obstacle: "That obstacle ended the run. Follow the open lanes and plan ahead." }[this.snake.deathReason] || "Every run teaches you the next turn. Ready for another?";
        this.finishRun("A good run.", reason);
        window.ArcadeFeedback?.play("lose");
    }

    // ---------- Update & Draw ----------

    update(dt) {
        if (this.feedbackRemaining > 0) {
            this.feedbackRemaining -= dt;
            if (this.feedbackRemaining <= 0) this.ui.feedback?.classList.remove("visible");
        }

        // 粒子
        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.life > 0);

        if (this.state === "countdown") {
            this.countdownRemaining = Math.max(0, this.countdownRemaining - dt);
            if (this.countdownRemaining < 0.000001) this.countdownRemaining = 0;
            if (this.ui.overlayTitle) this.ui.overlayTitle.textContent = String(Math.max(1, Math.ceil(this.countdownRemaining * 2)));
            if (this.countdownRemaining === 0) { this.state = "running"; this.showStateOverlay(); this.updateUI(); }
            return;
        }
        if (this.state !== "running" || !this.snake) return;
        this.elapsedTime += dt;
        this.updateUI();

        if (this.activeSpeedEffect) {
            this.speedEffectTime -= dt;
            if (this.speedEffectTime <= 0) {
                this.activeSpeedEffect = null;
                this.speedEffectTime = 0;
                this.updateUI();
            }
        }

        // super food 计时
        this.superFoodTimer += dt;
        if (this.superFood) {
            this.superFood.lifetime -= dt;
            if (this.superFood.lifetime <= 0) {
                this.superFood = null;
            }
        } else if (this.superFoodTimer >= this.superFoodInterval) {
            this.superFoodTimer = 0;
            this.spawnFood(true);
        }

        // powerup 计时
        this.powerupTimer += dt;
        if (this.powerups.length === 0 && this.powerupTimer >= this.nextPowerupTime) {
            this.powerupTimer = 0;
            this.nextPowerupTime = 8 + Math.random() * 8;
            this.spawnPowerup();
        }

        // 速度控制
        let baseFactor = ({ 1: 6, 2: 8.5, 3: 11 }[this.speedLevel] + Math.min(Math.floor(this.fruitCount / 5) * 0.45, 2.25)) / FPS_BASE;
        if (this.activeSpeedEffect === "slow") {
            baseFactor *= 0.75;
        } else if (this.activeSpeedEffect === "fast") {
            baseFactor *= 1.35;
        }

        const moveInterval = Math.max(0.05, 1.0 / (FPS_BASE * baseFactor));
        this.moveAcc += dt;
        if (this.moveAcc >= moveInterval) {
            this.moveAcc -= moveInterval;

            const wrap = this.mode === "Portal (Wrap)";
            this.snake.step(wrap);

            if (!this.snake.alive) {
                this.onGameOver();
                return;
            }

            const head = this.snake.body[0];
            this.trail.push({ x: head.x, y: head.y, spawnTime: this.elapsedTime });
            this.trail = this.trail.filter(p => this.elapsedTime - p.spawnTime < 0.6);

            // 障碍物
            const hitObstacle = this.currentLevel.obstacles.some(
                p => p.x === head.x && p.y === head.y
            );
            if (hitObstacle) {
                this.snake.deathReason = "obstacle";
                this.snake.alive = false;
                this.onGameOver();
                return;
            }

            // 普通 food
            if (this.food && head.x === this.food.pos.x && head.y === this.food.pos.y) {
                this.snake.grow(2);
                this.collectFruit(false);
                if (!this.spawnFood(false)) {
                    this.finishRun("You filled the field!", "Every reachable square is yours. What a harvest.");
                    window.ArcadeFeedback?.play("win");
                }
                this.spawnEatParticles(head);
            }

            // super food
            if (this.superFood && head.x === this.superFood.pos.x && head.y === this.superFood.pos.y) {
                this.snake.grow(5);
                this.collectFruit(true);
                this.superFood = null;
                this.spawnEatParticles(head, true);
            }

            // powerup
            for (let i = 0; i < this.powerups.length; i++) {
                const pu = this.powerups[i];
                if (pu.pos.x === head.x && pu.pos.y === head.y) {
                    this.applySpeedEffect(pu.kind);
                    this.powerups.splice(i, 1);
                    break;
                }
            }
        }
    }

    spawnDeathParticles() {
        if (!this.snake) return;
        const baseColor = this.currentSkin.snake;
        for (const seg of this.snake.body) {
            const cx = seg.x * CELL_SIZE + CELL_SIZE / 2;
            const cy = seg.y * CELL_SIZE + CELL_SIZE / 2;
            // 每一节身体生成若干粒子
            const count = 4;
            for (let i = 0; i < count; i++) {
                this.particles.push(new Particle(cx, cy, baseColor));
            }
        }
    }


    spawnEatParticles(cell, isSuper = false) {
        const baseColor = isSuper ? this.currentSkin.super_food : this.currentSkin.food;
        const cx = cell.x * CELL_SIZE + CELL_SIZE / 2;
        const cy = cell.y * CELL_SIZE + CELL_SIZE / 2;
        for (let i = 0; i < (isSuper ? 12 : 7); i++) {
            this.particles.push(new Particle(cx, cy, baseColor));
        }
    }

    drawTrail(ctx) {
        if (!this.trail || this.trail.length === 0) return;
        const headColor = this.currentSkin.head;

        for (const p of this.trail) {
            const age = this.elapsedTime - p.spawnTime;
            const life = 0.6;
            if (age < 0 || age > life) continue;
            const t = age / life;
            const alpha = (1 - t) * 0.5;          // 渐隐
            const radius = 4 + (1 - t) * 4;      // 越新越大

            const cx = p.x * CELL_SIZE + CELL_SIZE / 2;
            const cy = p.y * CELL_SIZE + CELL_SIZE / 2;

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${headColor[0]}, ${headColor[1]}, ${headColor[2]}, ${alpha})`;
            ctx.fill();
        }
    }

    draw() {
        const ctx = this.ctx;
        ctx.save();
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 背景渐变
        const grad = ctx.createLinearGradient(0, 0, 0, GRID_HEIGHT * CELL_SIZE);
        grad.addColorStop(0, colorToCss(BG_COLOR_TOP));
        grad.addColorStop(1, colorToCss(BG_COLOR_BOTTOM));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);

        // 网格
        ctx.strokeStyle = colorToCss(GRID_COLOR, 0.4);
        ctx.lineWidth = 1;
        for (let x = 0; x <= GRID_WIDTH; x++) {
            const px = x * CELL_SIZE + 0.5;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, GRID_HEIGHT * CELL_SIZE);
            ctx.stroke();
        }
        for (let y = 0; y <= GRID_HEIGHT; y++) {
            const py = y * CELL_SIZE + 0.5;
            ctx.beginPath();
            ctx.moveTo(0, py);
            ctx.lineTo(GRID_WIDTH * CELL_SIZE, py);
            ctx.stroke();
        }

        // 障碍
        ctx.fillStyle = colorToCss(OBSTACLE_COLOR, 0.9);
        for (const p of this.currentLevel.obstacles) {
            const px = p.x * CELL_SIZE + 1;
            const py = p.y * CELL_SIZE + 1;
            roundedRect(ctx, px, py, CELL_SIZE - 2, CELL_SIZE - 2, 6);
            ctx.fill();
        }

        if (this.trail) {
            this.drawTrail(ctx);
        }

        // 蛇 & 食物 & powerups
        if (this.snake) {
            this.snake.draw(ctx, this.currentSkin, this.elapsedTime);
        }
        if (this.food) {
            this.food.draw(ctx, this.elapsedTime, this.currentSkin);
        }
        if (this.superFood) {
            this.superFood.draw(ctx, this.elapsedTime, this.currentSkin);
        }
        for (const pu of this.powerups) {
            pu.draw(ctx, this.elapsedTime);
        }

        // 粒子
        this.particles.forEach(p => p.draw(ctx));

        ctx.restore();
    }
}

// ============ 启动 & 页面切换 ============

let snakeGame = null;

function initSnakeGame() {
    const canvas = document.getElementById("snake-canvas");
    if (!canvas || snakeGame) return;
    canvas.tabIndex = -1;

    const ids = {
        scoreLabel: "score-label", highscoreLabel: "highscore-label", statusLabel: "status-label",
        fruitCount: "snake-fruit-count", runTime: "snake-run-time", stateBadge: "snake-state-badge",
        startBtn: "snake-start-btn", pauseBtn: "snake-pause-btn", modeSelect: "snake-mode-select",
        speedSelect: "snake-speed-select", levelSelect: "snake-level-select", skinSelect: "snake-skin-select",
        overlay: "snake-overlay", overlayEyebrow: "snake-overlay-eyebrow", overlayTitle: "snake-overlay-title",
        overlayDesc: "snake-overlay-desc", overlayPrimary: "snake-overlay-primary", overlaySecondary: "snake-overlay-secondary",
        overlayTip: "snake-overlay-tip", resultStats: "snake-result-stats", feedback: "snake-feedback",
        goalLabel: "snake-goal-label", goalCount: "snake-goal-count", goalFill: "snake-goal-fill", goalProgress: "snake-goal-progress",
    };
    const uiRefs = Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, document.getElementById(id)]));
    snakeGame = new SnakeGame(canvas, uiRefs);
    snakeGame.resetGame();
    snakeGame.showStateOverlay();
    snakeGame.syncActivity();

    window.snakeGame = snakeGame;
}

const previousSnakeTextHook = window.render_game_to_text;
window.render_game_to_text = function () {
    if (document.body.dataset.game === "snake" && snakeGame) {
        return JSON.stringify({ game: "snake", state: snakeGame.state, score: snakeGame.score, best: snakeGame.highscore,
            fruit: snakeGame.fruitCount, elapsed: Number(snakeGame.elapsedTime.toFixed(2)), mode: snakeGame.mode,
            arena: snakeGame.currentLevel.name, speed: snakeGame.speedLevel, snake: snakeGame.snake?.body,
            direction: snakeGame.snake?.direction, queuedTurns: snakeGame.snake?.directionQueue,
            food: snakeGame.food?.pos, goldenFood: snakeGame.superFood?.pos || null,
            powerups: snakeGame.powerups.map(p => ({ ...p.pos, kind: p.kind })), effect: snakeGame.activeSpeedEffect,
            obstacles: snakeGame.currentLevel.obstacles,
            coordinates: "Grid origin is top left; x increases right, y increases down. Board is 26 × 22 cells." });
    }
    return typeof previousSnakeTextHook === "function" ? previousSnakeTextHook() : JSON.stringify({ game: document.body.dataset.game });
};
const previousSnakeTimeHook = window.advanceTime;
window.advanceTime = function (ms) {
    if (document.body.dataset.game === "snake" && snakeGame) {
        const steps = Math.max(1, Math.ceil(ms / (1000 / 60)));
        for (let step = 0; step < steps; step++) snakeGame.update(ms / steps / 1000);
        snakeGame.draw();
    } else if (typeof previousSnakeTimeHook === "function") previousSnakeTimeHook(ms);
};
