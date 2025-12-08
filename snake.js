// ================== Config ==================
const CELL_SIZE = 24;
const GRID_WIDTH = 26;
const GRID_HEIGHT = 22;
const PANEL_HEIGHT = 80;
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
    const raw = window.localStorage.getItem(HIGHSCORE_KEY);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
}

function saveHighscore(score) {
    window.localStorage.setItem(HIGHSCORE_KEY, String(score));
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
        this.growPending = 0;
        this.alive = true;
    }

    changeDirection(newDir) {
        // prevent 180° turn
        if (
            (newDir.x === -this.direction.x && newDir.x !== 0) ||
            (newDir.y === -this.direction.y && newDir.y !== 0)
        ) {
            return;
        }
        this.pendingDirection = newDir;
    }

    step(wrap) {
        if (!this.alive) return;

        this.direction = { ...this.pendingDirection };

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
                color = lerpColor(snakeColor, [40, 80, 40], t);
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

        this.state = "menu"; // "menu" / "running" / "paused" / "game_over"
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

        this.state = "running";
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
            if (x === midX) continue;
            cross.push({ x, y: midY });
        }
        // 垂直线
        for (let y = 0; y < GRID_HEIGHT; y++) {
            if (y === midY) continue;
            cross.push({ x: midX, y });
        }
        levels.push(new Level("Cross Maze", cross));

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
        const obstacles = new Set(
            this.currentLevel.obstacles.map(p => `${p.x},${p.y}`)
        );
        const wrap = this.mode === "Portal (Wrap)";
        const dirs = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
        ];

        for (let tries = 0; tries < 2000; tries++) {
            const x = Math.floor(Math.random() * GRID_WIDTH);
            const y = Math.floor(Math.random() * GRID_HEIGHT);
            if (obstacles.has(`${x},${y}`)) continue;

            // shuffle dirs
            const shuffled = [...dirs].sort(() => Math.random() - 0.5);
            for (const d of shuffled) {
                const body = [
                    { x, y },
                    { x: x - d.x, y: y - d.y },
                    { x: x - 2 * d.x, y: y - 2 * d.y },
                ];

                const outOfBounds = body.some(
                    b =>
                        b.x < 0 || b.x >= GRID_WIDTH ||
                        b.y < 0 || b.y >= GRID_HEIGHT
                );
                if (outOfBounds) continue;

                const onObstacle = body.some(b => obstacles.has(`${b.x},${b.y}`));
                if (onObstacle) continue;

                // simulate first step
                let nx = x + d.x;
                let ny = y + d.y;
                if (wrap) {
                    nx = (nx + GRID_WIDTH) % GRID_WIDTH;
                    ny = (ny + GRID_HEIGHT) % GRID_HEIGHT;
                } else {
                    if (
                        nx < 0 || nx >= GRID_WIDTH ||
                        ny < 0 || ny >= GRID_HEIGHT
                    ) {
                        continue;
                    }
                }
                if (obstacles.has(`${nx},${ny}`)) continue;

                return [{ x, y }, d];
            }
        }

        // fallback
        const sx = Math.floor(GRID_WIDTH / 2);
        const sy = Math.floor(GRID_HEIGHT / 2);
        return [{ x: sx, y: sy }, { x: 1, y: 0 }];
    }

    resetGame() {
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
                if (!occupied.has(`${x},${y}`)) freeCells.push({ x, y });
            }
        }
        if (freeCells.length === 0) return;
        const pos = freeCells[Math.floor(Math.random() * freeCells.length)];
        if (isSuper) {
            this.superFood = new Food(pos, true, 8);
        } else {
            this.food = new Food(pos, false, 0);
        }
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
                if (!occupied.has(`${x},${y}`)) freeCells.push({ x, y });
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
        this.updateUI();
    }

    // ---------- UI 绑定 & 按键 ----------

    addEventListeners() {
        window.addEventListener("keydown", (e) => {
            // 只有在 snake 屏幕是 active 时才响应
            if (!this.isActiveScreen()) return;
            if (!this.snake) return;
            // 后面保持不变：
            if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
                this.snake.changeDirection({ x: 0, y: -1 });
            } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
                this.snake.changeDirection({ x: 0, y: 1 });
            } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
                this.snake.changeDirection({ x: -1, y: 0 });
            } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
                this.snake.changeDirection({ x: 1, y: 0 });
            } else if (e.key === "Escape") {
                if (this.state === "running") this.state = "paused";
                else if (this.state === "paused") this.state = "running";
            }
        });
    }

    isActiveScreen() {
        const screen = document.getElementById("snake-screen");
        return !!(screen && screen.classList.contains("active"));
    }

    addTouchControls() {
        let startX = 0;
        let startY = 0;
        let tracking = false;
        const threshold = 18;

        const startHandler = (e) => {
            if (!this.isActiveScreen()) return;
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            tracking = true;
        };

        const endHandler = (e) => {
            if (!tracking) return;
            tracking = false;
            if (!this.isActiveScreen()) return;
            if (!this.snake) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;

            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            if (absX > absY) {
                this.snake.changeDirection({ x: dx > 0 ? 1 : -1, y: 0 });
            } else {
                this.snake.changeDirection({ x: 0, y: dy > 0 ? 1 : -1 });
            }
            e.preventDefault();
        };

        const moveHandler = (e) => {
            if (tracking && this.isActiveScreen()) {
                e.preventDefault();
            }
        };

        this.canvas.addEventListener("touchstart", startHandler, { passive: true });
        this.canvas.addEventListener("touchend", endHandler, { passive: false });
        this.canvas.addEventListener("touchmove", moveHandler, { passive: false });
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
        const {
            modeLabel,
            speedLabel,
            levelLabel,
            scoreLabel,
            highscoreLabel,
            skinLabel,
            skinNameLabel,
            statusLabel,
        } = this.ui;

        if (modeLabel) modeLabel.textContent = this.mode;
        if (speedLabel) speedLabel.textContent = String(this.speedLevel);
        if (levelLabel) levelLabel.textContent = this.currentLevel.name;
        if (scoreLabel) scoreLabel.textContent = String(this.score);
        if (highscoreLabel) highscoreLabel.textContent = String(this.highscore);
        if (skinLabel) skinLabel.textContent = `Skin: ${this.currentSkin.name}`;
        if (skinNameLabel) skinNameLabel.textContent = this.currentSkin.name;

        let status = "Normal";
        if (this.activeSpeedEffect === "slow") status = "Slowed";
        if (this.activeSpeedEffect === "fast") status = "Boosted";
        if (statusLabel) statusLabel.textContent = status;
    }

    onGameOver() {
        this.spawnDeathParticles();
        this.state = "game_over";
        if (this.score > this.highscore) {
            this.highscore = this.score;
            saveHighscore(this.highscore);
        }
        this.updateUI();
        // 简单：直接重开一局，但保留一点停顿感
        setTimeout(() => {
            this.resetGame();
            this.state = "running";
        }, 600);
    }

    // ---------- Update & Draw ----------

    update(dt) {
        this.elapsedTime += dt;

        // 粒子
        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.life > 0);

        if (this.state !== "running" || !this.snake) return;

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
        let baseFactor = { 1: 0.8, 2: 1.0, 3: 1.35 }[this.speedLevel];
        if (this.activeSpeedEffect === "slow") {
            baseFactor *= 0.6;
        } else if (this.activeSpeedEffect === "fast") {
            baseFactor *= 1.6;
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
                this.snake.alive = false;
                this.onGameOver();
                return;
            }

            // 普通 food
            if (this.food && head.x === this.food.pos.x && head.y === this.food.pos.y) {
                this.snake.grow(2);
                this.score += 10;
                this.spawnFood(false);
                this.updateUI();
                this.spawnEatParticles(head);
            }

            // super food
            if (this.superFood && head.x === this.superFood.pos.x && head.y === this.superFood.pos.y) {
                this.snake.grow(5);
                this.score += 40;
                this.superFood = null;
                this.updateUI();
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

        // 底部 panel
        const panelY = GRID_HEIGHT * CELL_SIZE;
        ctx.fillStyle = colorToCss(PANEL_COLOR, 0.96);
        ctx.fillRect(0, panelY, CANVAS_WIDTH, PANEL_HEIGHT);

        ctx.font = "14px system-ui, sans-serif";
        ctx.fillStyle = TEXT_COLOR;
        ctx.textBaseline = "top";

        ctx.fillText(`Mode: ${this.mode}`, 16, panelY + 8);
        ctx.fillText(`Speed: ${this.speedLevel}`, 16, panelY + 28);
        ctx.fillText(`Level: ${this.currentLevel.name}`, 16, panelY + 48);

        ctx.fillStyle = ACCENT_COLOR;
        ctx.textAlign = "right";
        ctx.fillText(`Score: ${this.score}`, CANVAS_WIDTH - 16, panelY + 8);

        ctx.fillStyle = TEXT_COLOR;
        ctx.fillText(`Best: ${this.highscore}`, CANVAS_WIDTH - 16, panelY + 28);
        ctx.fillText(`Skin: ${this.currentSkin.name}`, CANVAS_WIDTH - 16, panelY + 48);

        ctx.textAlign = "center";
        ctx.fillStyle = "#b4b4d8";
        let status = "Status: Normal";
        if (this.activeSpeedEffect === "slow") status = "Status: Slowed";
        if (this.activeSpeedEffect === "fast") status = "Status: Boosted";
        ctx.fillText(
            status,
            CANVAS_WIDTH / 2,
            panelY + 8
        );

        if (this.state === "paused") {
            const overlayColor = "rgba(0,0,0,0.55)";
            ctx.fillStyle = overlayColor;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.fillStyle = TEXT_COLOR;
            ctx.font = "bold 26px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Paused", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 12);
            ctx.font = "14px system-ui, sans-serif";
            ctx.fillText("Press ESC to resume", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 12);
        }

        ctx.restore();
    }
}

// ============ 启动 & 页面切换 ============

let snakeGame = null;

function initSnakeGame() {
    const canvas = document.getElementById("snake-canvas");
    if (!canvas) return;

    const uiRefs = {
        modeLabel: document.getElementById("mode-label"),
        speedLabel: document.getElementById("speed-label"),
        levelLabel: document.getElementById("level-label"),
        scoreLabel: document.getElementById("score-label"),
        highscoreLabel: document.getElementById("highscore-label"),
        skinLabel: document.getElementById("skin-label"),
        skinNameLabel: document.getElementById("skin-name-label"),
        statusLabel: document.getElementById("status-label"),
    };

    snakeGame = new SnakeGame(canvas, uiRefs);
    snakeGame.resetGame();

    let lastTime = performance.now();
    function loop(now) {
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        if (snakeGame) {
            snakeGame.update(dt);
            snakeGame.draw();
        }
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // 绑定右侧按钮
    document.getElementById("toggle-mode-btn")?.addEventListener("click", () => {
        snakeGame.toggleMode();
    });
    document.getElementById("toggle-speed-btn")?.addEventListener("click", () => {
        snakeGame.toggleSpeed();
    });
    document.getElementById("toggle-level-btn")?.addEventListener("click", () => {
        snakeGame.toggleLevel();
    });
    document.getElementById("toggle-skin-btn")?.addEventListener("click", () => {
        snakeGame.toggleSkin();
    });
}

