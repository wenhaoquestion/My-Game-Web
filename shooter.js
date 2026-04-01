// shooter.js — Neon Space Shooter
// Controls: ← → / A D to move, Space to shoot, Shift for bomb
// Levels 1–5 + Endless mode

(function () {
    "use strict";

    // ===================== CONFIG =====================
    const CANVAS_W = 420;
    const CANVAS_H = 600;
    const PLAYER_SPEED = 260; // px/s
    const BULLET_SPEED = 520;
    const ENEMY_BULLET_SPEED = 200;
    const SHOOT_COOLDOWN = 0.14; // seconds between player shots
    const BOMB_COOLDOWN = 8;     // seconds between bombs

    const HIGHSCORE_KEY = "shooter_highscore";

    // Level definitions (1-5 + endless)
    const LEVELS = [
        { id: 1, name: "Sector 1",    enemyHp: 1, spawnRate: 0.9, speed: 70,  bossHp: 20,  givesBomb: true },
        { id: 2, name: "Sector 2",    enemyHp: 1, spawnRate: 1.2, speed: 90,  bossHp: 35,  givesBomb: true },
        { id: 3, name: "Sector 3",    enemyHp: 2, spawnRate: 1.5, speed: 110, bossHp: 55,  givesBomb: true },
        { id: 4, name: "Sector 4",    enemyHp: 2, spawnRate: 1.9, speed: 130, bossHp: 80,  givesBomb: true },
        { id: 5, name: "Sector 5",    enemyHp: 3, spawnRate: 2.3, speed: 150, bossHp: 120, givesBomb: true },
    ];

    const ENEMY_TYPES = {
        basic:   { color: "#ff6b6b", radius: 14, score: 10, shootInterval: null },
        zigzag:  { color: "#ffd166", radius: 13, score: 20, shootInterval: null },
        armored: { color: "#c38dff", radius: 16, score: 30, shootInterval: 3.2 },
        elite:   { color: "#ff9f43", radius: 15, score: 50, shootInterval: 2.0 },
    };

    const POWERUP_TYPES = ["spread", "shield", "speed"];

    // ===================== HELPERS =====================
    function rand(min, max) { return min + Math.random() * (max - min); }
    function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    function loadHS() {
        const n = parseInt(localStorage.getItem(HIGHSCORE_KEY) || "0", 10);
        return Number.isFinite(n) ? n : 0;
    }
    function saveHS(s) { localStorage.setItem(HIGHSCORE_KEY, String(s)); }

    // ===================== PARTICLES =====================
    class Particle {
        constructor(x, y, color, vx, vy, life, radius = 3) {
            this.x = x; this.y = y;
            this.vx = vx; this.vy = vy;
            this.life = life; this.maxLife = life;
            this.color = color;
            this.radius = radius;
        }
        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.life -= dt;
            this.vy += 60 * dt; // mild gravity
        }
        draw(ctx) {
            const a = Math.max(0, this.life / this.maxLife);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * a + 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        get dead() { return this.life <= 0; }
    }

    // ===================== STARS (bg) =====================
    class StarField {
        constructor(w, h) {
            this.stars = Array.from({ length: 80 }, () => ({
                x: rand(0, w), y: rand(0, h),
                speed: rand(20, 80),
                r: rand(0.5, 2),
                alpha: rand(0.2, 0.9),
            }));
            this.w = w; this.h = h;
        }
        update(dt) {
            for (const s of this.stars) {
                s.y += s.speed * dt;
                if (s.y > this.h + 4) { s.y = -4; s.x = rand(0, this.w); }
            }
        }
        draw(ctx) {
            ctx.save();
            for (const s of this.stars) {
                ctx.globalAlpha = s.alpha;
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    // ===================== PLAYER =====================
    class Player {
        constructor(x, y) {
            this.x = x; this.y = y;
            this.radius = 18;
            this.shootTimer = 0;
            this.bombTimer = 0;
            this.hp = 3;
            this.maxHp = 3;
            this.shield = false;
            this.shieldTimer = 0;
            this.speedBoost = false;
            this.speedTimer = 0;
            this.spread = false;
            this.spreadTimer = 0;
            this.invincible = false;
            this.invincibleTimer = 0;
            this.glowPhase = 0;
            this.bombs = 1;
        }
        update(dt) {
            this.shootTimer = Math.max(0, this.shootTimer - dt);
            this.bombTimer = Math.max(0, this.bombTimer - dt);
            this.glowPhase += dt * 3;
            if (this.shieldTimer > 0) {
                this.shieldTimer -= dt;
                if (this.shieldTimer <= 0) this.shield = false;
            }
            if (this.speedTimer > 0) {
                this.speedTimer -= dt;
                if (this.speedTimer <= 0) this.speedBoost = false;
            }
            if (this.spreadTimer > 0) {
                this.spreadTimer -= dt;
                if (this.spreadTimer <= 0) this.spread = false;
            }
            if (this.invincibleTimer > 0) {
                this.invincibleTimer -= dt;
                if (this.invincibleTimer <= 0) this.invincible = false;
            }
        }
        draw(ctx) {
            const glow = 0.6 + 0.4 * Math.sin(this.glowPhase);
            ctx.save();
            if (this.invincible && Math.floor(this.invincibleTimer * 8) % 2 === 0) {
                ctx.globalAlpha = 0.5;
            }

            // Shield ring
            if (this.shield) {
                ctx.save();
                ctx.strokeStyle = `rgba(126,249,255,${0.5 + 0.3 * glow})`;
                ctx.lineWidth = 3;
                ctx.shadowColor = "#7ef9ff";
                ctx.shadowBlur = 16;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Engine glow
            const engGrad = ctx.createRadialGradient(this.x, this.y + 18, 2, this.x, this.y + 18, 20);
            engGrad.addColorStop(0, "rgba(90,170,255,0.9)");
            engGrad.addColorStop(1, "rgba(90,170,255,0)");
            ctx.fillStyle = engGrad;
            ctx.beginPath();
            ctx.arc(this.x, this.y + 18, 20, 0, Math.PI * 2);
            ctx.fill();

            // Ship body
            ctx.shadowColor = "#5aaaff";
            ctx.shadowBlur = 18 * glow;
            ctx.fillStyle = this.spread ? "#ffd166" : "#5aaaff";
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.radius);
            ctx.lineTo(this.x + this.radius * 0.7, this.y + this.radius * 0.6);
            ctx.lineTo(this.x, this.y + this.radius * 0.2);
            ctx.lineTo(this.x - this.radius * 0.7, this.y + this.radius * 0.6);
            ctx.closePath();
            ctx.fill();

            // Cockpit
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(this.x, this.y - 4, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        canShoot() { return this.shootTimer <= 0; }
        shoot() {
            this.shootTimer = SHOOT_COOLDOWN;
            const bullets = [];
            if (this.spread) {
                bullets.push({ x: this.x, y: this.y - 20, vx: -80, vy: -BULLET_SPEED, color: "#ffd166" });
                bullets.push({ x: this.x, y: this.y - 20, vx: 0,   vy: -BULLET_SPEED, color: "#ffd166" });
                bullets.push({ x: this.x, y: this.y - 20, vx: 80,  vy: -BULLET_SPEED, color: "#ffd166" });
            } else {
                bullets.push({ x: this.x, y: this.y - 20, vx: 0, vy: -BULLET_SPEED, color: "#5aaaff" });
            }
            return bullets;
        }

        canBomb() { return this.bombTimer <= 0 && this.bombs > 0; }
        useBomb() {
            if (!this.canBomb()) return false;
            this.bombTimer = BOMB_COOLDOWN;
            this.bombs--;
            return true;
        }

        hitBy(r) {
            if (this.invincible || this.shield) return false;
            return dist(this, { x: this.x, y: this.y }) < this.radius + r;
        }

        takeDamage() {
            if (this.invincible) return false;
            if (this.shield) { this.shield = false; this.shieldTimer = 0; return false; }
            this.hp--;
            this.invincible = true;
            this.invincibleTimer = 1.8;
            return true;
        }

        applyPowerup(type) {
            if (type === "shield") { this.shield = true; this.shieldTimer = 8; }
            else if (type === "speed") { this.speedBoost = true; this.speedTimer = 6; }
            else if (type === "spread") { this.spread = true; this.spreadTimer = 7; }
        }
    }

    // ===================== ENEMY =====================
    class Enemy {
        constructor(x, y, type, level, speedMult = 1) {
            this.x = x; this.y = y;
            this.typeName = type;
            const def = ENEMY_TYPES[type];
            this.color = def.color;
            this.radius = def.radius;
            this.score = def.score;
            this.maxHp = level.enemyHp + (type === "armored" || type === "elite" ? 1 : 0);
            this.hp = this.maxHp;
            this.speed = level.speed * speedMult;
            this.shootInterval = def.shootInterval;
            this.shootTimer = this.shootInterval ? rand(0.5, this.shootInterval) : Infinity;
            this.phase = rand(0, Math.PI * 2);
            this.time = 0;
            this.dead = false;
            this.glowPhase = rand(0, Math.PI * 2);
        }
        update(dt) {
            this.time += dt;
            this.glowPhase += dt * 4;
            this.y += this.speed * dt;
            if (this.typeName === "zigzag") {
                this.x += Math.sin(this.time * 2.8 + this.phase) * 120 * dt;
            }
            if (this.shootInterval) {
                this.shootTimer -= dt;
            }
        }
        canShoot() {
            return this.shootInterval && this.shootTimer <= 0;
        }
        resetShootTimer() {
            this.shootTimer = this.shootInterval;
        }
        drawHpBar(ctx) {
            if (this.maxHp <= 1) return;
            const w = this.radius * 2;
            const x = this.x - this.radius;
            const y = this.y - this.radius - 8;
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(x, y, w, 4);
            ctx.fillStyle = "#6bf2a2";
            ctx.fillRect(x, y, w * (this.hp / this.maxHp), 4);
        }
        draw(ctx) {
            const glow = 0.5 + 0.5 * Math.abs(Math.sin(this.glowPhase));
            ctx.save();
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 14 * glow;
            ctx.fillStyle = this.color;
            // Different shape per type
            if (this.typeName === "basic") {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y + this.radius);
                ctx.lineTo(this.x + this.radius * 0.7, this.y - this.radius * 0.5);
                ctx.lineTo(this.x, this.y - this.radius * 0.1);
                ctx.lineTo(this.x - this.radius * 0.7, this.y - this.radius * 0.5);
                ctx.closePath();
                ctx.fill();
            } else if (this.typeName === "zigzag") {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.6)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius - 4, 0, Math.PI * 2);
                ctx.stroke();
            } else if (this.typeName === "armored") {
                const sides = 6;
                ctx.beginPath();
                for (let i = 0; i < sides; i++) {
                    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
                    const r = this.radius;
                    i === 0 ? ctx.moveTo(this.x + r * Math.cos(a), this.y + r * Math.sin(a))
                             : ctx.lineTo(this.x + r * Math.cos(a), this.y + r * Math.sin(a));
                }
                ctx.closePath();
                ctx.fill();
            } else {
                // elite — diamond
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - this.radius);
                ctx.lineTo(this.x + this.radius, this.y);
                ctx.lineTo(this.x, this.y + this.radius);
                ctx.lineTo(this.x - this.radius, this.y);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
            this.drawHpBar(ctx);
        }
        get offScreen() { return this.y > CANVAS_H + 40 || this.x < -60 || this.x > CANVAS_W + 60; }
    }

    // ===================== BOSS =====================
    class Boss {
        constructor(level, levelDef) {
            this.x = CANVAS_W / 2;
            this.y = -80;
            this.targetY = 120;
            this.radius = 42;
            this.maxHp = levelDef.bossHp;
            this.hp = this.maxHp;
            this.speed = 60;
            this.phase = "enter"; // enter | fight | dead
            this.shootTimer = 0;
            this.shootInterval = Math.max(0.8, 2.0 - level * 0.2);
            this.time = 0;
            this.level = level;
            this.dead = false;
            this.color = ["#ff6b6b", "#ffd166", "#c38dff", "#ff9f43", "#6bf2a2"][level - 1] || "#ff6b6b";
            this.moveDir = 1;
            this.glowPhase = 0;
        }
        update(dt) {
            this.time += dt;
            this.glowPhase += dt * 2;
            if (this.phase === "enter") {
                this.y += this.speed * dt;
                if (this.y >= this.targetY) { this.y = this.targetY; this.phase = "fight"; }
                return;
            }
            if (this.phase !== "fight") return;
            this.x += this.moveDir * 80 * dt;
            if (this.x > CANVAS_W - 60) { this.x = CANVAS_W - 60; this.moveDir = -1; }
            if (this.x < 60) { this.x = 60; this.moveDir = 1; }
            this.shootTimer -= dt;
        }
        canShoot() { return this.phase === "fight" && this.shootTimer <= 0; }
        resetShootTimer() { this.shootTimer = this.shootInterval; }
        getBullets() {
            const bullets = [];
            // Spread pattern depends on level
            const count = Math.min(3 + this.level, 7);
            for (let i = 0; i < count; i++) {
                const a = (Math.PI / (count - 1)) * i + Math.PI / 2;
                bullets.push({
                    x: this.x, y: this.y + this.radius,
                    vx: Math.cos(a) * ENEMY_BULLET_SPEED * 0.8,
                    vy: Math.sin(a) * ENEMY_BULLET_SPEED * 0.8,
                    color: this.color,
                    boss: true,
                });
            }
            return bullets;
        }
        draw(ctx) {
            const hp = this.hp / this.maxHp;
            const glow = 0.6 + 0.4 * Math.abs(Math.sin(this.glowPhase));
            ctx.save();
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 30 * glow;
            // Body
            ctx.fillStyle = this.color;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2 + this.time * 0.3;
                const r = this.radius * (i % 2 === 0 ? 1 : 0.65);
                i === 0 ? ctx.moveTo(this.x + r * Math.cos(a), this.y + r * Math.sin(a))
                         : ctx.lineTo(this.x + r * Math.cos(a), this.y + r * Math.sin(a));
            }
            ctx.closePath();
            ctx.fill();
            // Core
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            // HP bar
            const bw = 120;
            const bx = this.x - bw / 2;
            const by = this.y + this.radius + 10;
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(bx, by, bw, 8);
            ctx.fillStyle = hp > 0.5 ? "#6bf2a2" : hp > 0.25 ? "#ffd166" : "#ff6b6b";
            ctx.fillRect(bx, by, bw * hp, 8);
            // Label
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 11px system-ui";
            ctx.textAlign = "center";
            ctx.fillText(`BOSS  ${this.hp} / ${this.maxHp}`, this.x, by + 20);
        }
        get offScreen() { return false; }
    }

    // ===================== POWERUP =====================
    class PowerUp {
        constructor(x, y, type) {
            this.x = x; this.y = y;
            this.type = type;
            this.radius = 12;
            this.speed = 80;
            this.time = 0;
            this.dead = false;
        }
        update(dt) { this.y += this.speed * dt; this.time += dt; }
        draw(ctx) {
            const bob = Math.sin(this.time * 4) * 3;
            const colors = { spread: "#ffd166", shield: "#7ef9ff", speed: "#6bf2a2" };
            const labels = { spread: "S", shield: "⬡", speed: "⚡" };
            ctx.save();
            ctx.shadowColor = colors[this.type];
            ctx.shadowBlur = 18;
            ctx.fillStyle = colors[this.type];
            ctx.beginPath();
            ctx.arc(this.x, this.y + bob, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#0b0b20";
            ctx.font = `bold ${this.radius}px system-ui`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(labels[this.type], this.x, this.y + bob);
            ctx.restore();
        }
        get offScreen() { return this.y > CANVAS_H + 30; }
    }

    // ===================== BULLET =====================
    class Bullet {
        constructor(cfg) {
            Object.assign(this, cfg);
            this.dead = false;
            this.radius = this.boss ? 7 : 5;
        }
        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
        }
        draw(ctx) {
            ctx.save();
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 12;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        get offScreen() {
            return this.y < -20 || this.y > CANVAS_H + 20 || this.x < -20 || this.x > CANVAS_W + 20;
        }
    }

    // ===================== MAIN GAME =====================
    class ShooterGame {
        constructor() {
            this.canvas = document.getElementById("shooter-canvas");
            if (!this.canvas) return;
            this.ctx = this.canvas.getContext("2d");
            this.canvas.width = CANVAS_W;
            this.canvas.height = CANVAS_H;

            this.state = "menu"; // menu | countdown | playing | paused | boss | levelclear | gameover | victory
            this.levelIndex = 0; // 0-4 = levels 1-5, 5 = endless
            this.endless = false;
            this.score = 0;
            this.highscore = loadHS();
            this.kills = 0;
            this.killGoal = 20;

            this.player = null;
            this.enemies = [];
            this.playerBullets = [];
            this.enemyBullets = [];
            this.powerups = [];
            this.particles = [];
            this.stars = new StarField(CANVAS_W, CANVAS_H);
            this.boss = null;
            this.bossPhase = false;

            this.spawnTimer = 0;
            this.waveTimer = 0;
            this.countdownTimer = 3;
            this.levelClearTimer = 0;
            this.bombFlash = 0;
            this.endlessLevel = 1;

            this.keys = {};
            this.lastTime = null;

            this.ui = this.cacheUI();
            this.bindEvents();
            this.bindButtons();
            this.draw();
            this.updateUI();
        }

        cacheUI() {
            return {
                score: document.getElementById("shooter-score"),
                highscore: document.getElementById("shooter-highscore"),
                level: document.getElementById("shooter-level"),
                hp: document.getElementById("shooter-hp"),
                kills: document.getElementById("shooter-kills"),
                bombs: document.getElementById("shooter-bombs"),
                spread: document.getElementById("shooter-spread"),
                shield: document.getElementById("shooter-shield"),
                message: document.getElementById("shooter-message"),
                overlay: document.getElementById("shooter-overlay"),
                overlayTitle: document.getElementById("shooter-overlay-title"),
                overlayDesc: document.getElementById("shooter-overlay-desc"),
                overlayPrimary: document.getElementById("shooter-overlay-primary"),
                overlaySecondary: document.getElementById("shooter-overlay-secondary"),
                levelSelect: document.getElementById("shooter-level-select"),
                endlessCheck: document.getElementById("shooter-endless-check"),
                bombCooldown: document.getElementById("shooter-bomb-cooldown"),
            };
        }

        isActiveScreen() {
            const s = document.getElementById("shooter-screen");
            return s && s.classList.contains("active");
        }

        bindEvents() {
            window.addEventListener("keydown", (e) => {
                if (!this.isActiveScreen()) return;
                this.keys[e.code] = true;
                if (e.code === "Space") {
                    e.preventDefault();
                    if (this.state === "paused") this.resume();
                }
                if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
                    e.preventDefault();
                    if (this.state === "playing" || this.state === "boss") this.triggerBomb();
                }
                if (e.code === "KeyP" || e.code === "Escape") {
                    if (this.state === "playing" || this.state === "boss") this.pause();
                    else if (this.state === "paused") this.resume();
                }
            });
            window.addEventListener("keyup", (e) => { this.keys[e.code] = false; });
        }

        bindButtons() {
            const startBtn = document.getElementById("shooter-start-btn");
            if (startBtn) startBtn.addEventListener("click", () => this.startGame());
            const p = this.ui?.overlayPrimary;
            const s = this.ui?.overlaySecondary;
            if (p) p.addEventListener("click", () => this.overlayPrimary());
            if (s) s.addEventListener("click", () => this.startGame());
        }

        getLevelDef() {
            if (this.endless) return null;
            return LEVELS[this.levelIndex] || LEVELS[LEVELS.length - 1];
        }

        getEndlessDef() {
            const lvl = this.endlessLevel;
            return {
                enemyHp: Math.ceil(lvl / 2),
                spawnRate: Math.min(0.5 + lvl * 0.3, 4.0),
                speed: Math.min(60 + lvl * 18, 260),
                bossHp: Math.round(20 + lvl * 15),
                givesBomb: true,
            };
        }

        currentDef() {
            return this.endless ? this.getEndlessDef() : (this.getLevelDef() || LEVELS[LEVELS.length - 1]);
        }

        startGame() {
            const sel = this.ui?.levelSelect;
            const ec = this.ui?.endlessCheck;
            this.endless = ec?.checked || false;
            if (!this.endless && sel) {
                this.levelIndex = parseInt(sel.value, 10) - 1;
            }
            this.endlessLevel = 1;
            this.score = 0;
            this.kills = 0;
            this.killGoal = this.endless ? 25 : 20;
            this.enemies = [];
            this.playerBullets = [];
            this.enemyBullets = [];
            this.powerups = [];
            this.particles = [];
            this.boss = null;
            this.bossPhase = false;
            this.spawnTimer = 0;
            this.waveTimer = 0;
            this.player = new Player(CANVAS_W / 2, CANVAS_H - 70);
            this.player.bombs = 1;
            this.state = "countdown";
            this.countdownTimer = 3;
            this.hideOverlay();
            this.lastTime = null;
            requestAnimationFrame((t) => this.loop(t));
            this.updateUI();
        }

        pause() {
            if (this.state !== "playing" && this.state !== "boss") return;
            this._prevState = this.state;
            this.state = "paused";
            this.showOverlay("Paused", "Press Space or Resume to continue", "Resume", "Restart");
        }
        resume() {
            if (this.state !== "paused") return;
            this.state = this._prevState || "playing";
            this.hideOverlay();
            this.lastTime = null;
            requestAnimationFrame((t) => this.loop(t));
        }

        overlayPrimary() {
            if (this.state === "paused") this.resume();
            else if (this.state === "gameover" || this.state === "victory") this.startGame();
            else if (this.state === "levelclear") this.nextLevel();
        }

        triggerBomb() {
            if (!this.player?.canBomb()) return;
            if (!this.player.useBomb()) return;
            // Destroy all enemies on screen
            this.enemies.forEach(e => {
                this.score += e.score;
                this.kills++;
                this.spawnExplosion(e.x, e.y, e.color, 10);
                e.dead = true;
            });
            if (this.boss && this.bossPhase) {
                const dmg = Math.ceil(this.boss.maxHp * 0.15);
                this.boss.hp -= dmg;
                this.spawnExplosion(this.boss.x, this.boss.y, this.boss.color, 14);
                if (this.boss.hp <= 0) this.defeatBoss();
            }
            this.enemyBullets = [];
            this.bombFlash = 0.35;
            this.updateUI();
        }

        spawnExplosion(x, y, color, count = 8) {
            for (let i = 0; i < count; i++) {
                const angle = rand(0, Math.PI * 2);
                const speed = rand(60, 220);
                this.particles.push(new Particle(
                    x, y, color,
                    Math.cos(angle) * speed, Math.sin(angle) * speed,
                    rand(0.3, 0.8), rand(2, 5)
                ));
            }
        }

        spawnEnemy() {
            const def = this.currentDef();
            const x = rand(30, CANVAS_W - 30);
            const y = -30;
            let type;
            const r = Math.random();
            if (this.endless) {
                const lvl = this.endlessLevel;
                if (r < 0.35) type = "basic";
                else if (r < 0.60) type = "zigzag";
                else if (r < 0.80) type = "armored";
                else type = "elite";
                if (lvl < 3) type = r < 0.6 ? "basic" : "zigzag";
            } else {
                if (r < 0.45) type = "basic";
                else if (r < 0.70) type = "zigzag";
                else if (r < 0.88) type = "armored";
                else type = "elite";
                if (this.levelIndex < 2) type = r < 0.65 ? "basic" : "zigzag";
            }
            this.enemies.push(new Enemy(x, y, type, def));
        }

        checkWin() {
            if (!this.bossPhase && this.kills >= this.killGoal) {
                this.bossPhase = true;
                this.enemies = [];
                this.enemyBullets = [];
                const lvl = this.endless ? this.endlessLevel : (this.levelIndex + 1);
                this.boss = new Boss(lvl, this.currentDef());
            }
        }

        defeatBoss() {
            this.score += this.boss.maxHp * 5;
            this.spawnExplosion(this.boss.x, this.boss.y, this.boss.color, 25);
            this.boss = null;
            this.bossPhase = false;
            // Give bomb
            if (this.currentDef().givesBomb) this.player.bombs = Math.min(this.player.bombs + 1, 3);
            if (this.endless) {
                // Advance endless level
                this.endlessLevel++;
                this.kills = 0;
                this.killGoal = Math.round(this.killGoal * 1.3);
                this.state = "levelclear";
                this.levelClearTimer = 0;
                this.showOverlay(
                    `Wave ${this.endlessLevel - 1} Cleared!`,
                    `Score: ${this.score.toLocaleString()} · Prepare for next wave`,
                    "Next Wave", "Quit"
                );
            } else {
                // Check if more levels
                if (this.levelIndex < LEVELS.length - 1) {
                    this.state = "levelclear";
                    this.showOverlay(
                        `${LEVELS[this.levelIndex].name} Cleared!`,
                        `Score: ${this.score.toLocaleString()} · Ready for next sector?`,
                        "Next Level", "Restart"
                    );
                } else {
                    this.gameVictory();
                }
            }
            this.updateUI();
        }

        nextLevel() {
            if (this.endless) {
                // Resume endless
                this.state = "playing";
                this.enemies = [];
                this.spawnTimer = 0;
                this.hideOverlay();
                this.lastTime = null;
                requestAnimationFrame((t) => this.loop(t));
            } else {
                this.levelIndex++;
                this.kills = 0;
                this.killGoal = 20;
                this.enemies = [];
                this.playerBullets = [];
                this.enemyBullets = [];
                this.powerups = [];
                this.boss = null;
                this.bossPhase = false;
                this.spawnTimer = 0;
                this.state = "countdown";
                this.countdownTimer = 3;
                this.hideOverlay();
                this.lastTime = null;
                requestAnimationFrame((t) => this.loop(t));
            }
        }

        gameOver() {
            this.state = "gameover";
            if (this.score > this.highscore) { this.highscore = this.score; saveHS(this.score); }
            this.showOverlay("Game Over", `Score: ${this.score.toLocaleString()}  ·  Best: ${this.highscore.toLocaleString()}`, "Play Again", "Restart");
            this.updateUI();
        }

        gameVictory() {
            this.state = "victory";
            if (this.score > this.highscore) { this.highscore = this.score; saveHS(this.score); }
            this.showOverlay("Victory!", `All 5 sectors cleared!\nScore: ${this.score.toLocaleString()}`, "Play Again", "Restart");
            this.updateUI();
        }

        showOverlay(title, desc, primary = "Restart", secondary = "Restart") {
            if (!this.ui) return;
            this.ui.overlayTitle.textContent = title;
            this.ui.overlayDesc.textContent = desc;
            this.ui.overlayPrimary.textContent = primary;
            this.ui.overlaySecondary.textContent = secondary;
            this.ui.overlay.classList.add("visible");
        }
        hideOverlay() { this.ui?.overlay.classList.remove("visible"); }

        updateUI() {
            if (!this.ui) return;
            const p = this.player;
            this.ui.score.textContent = this.score.toLocaleString();
            this.ui.highscore.textContent = this.highscore.toLocaleString();
            const lvlName = this.endless
                ? `Endless Wave ${this.endlessLevel}`
                : (LEVELS[this.levelIndex]?.name || "—");
            this.ui.level.textContent = lvlName;
            this.ui.hp.textContent = p ? "❤".repeat(Math.max(0, p.hp)) || "☆" : "—";
            this.ui.kills.textContent = `${this.kills} / ${this.killGoal}`;
            this.ui.bombs.textContent = p ? "💣".repeat(Math.max(0, p.bombs)) || "0" : "—";
            this.ui.spread.textContent = p?.spread ? `Spread ${p.spreadTimer.toFixed(1)}s` : "—";
            this.ui.shield.textContent = p?.shield ? `Shield ${p.shieldTimer.toFixed(1)}s` : "—";
            const bc = p ? Math.max(0, p.bombTimer).toFixed(1) : "—";
            this.ui.bombCooldown.textContent = p && p.bombTimer > 0 ? `Bomb CD: ${bc}s` : "Bomb: Ready";
        }

        loop(timestamp) {
            if (this.lastTime === null) this.lastTime = timestamp;
            const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
            this.lastTime = timestamp;

            const s = this.state;
            if (s === "paused" || s === "gameover" || s === "victory" || s === "levelclear") {
                this.draw();
                return;
            }
            if (s === "menu") { this.draw(); return; }

            if (s === "countdown") {
                this.countdownTimer -= dt;
                this.stars.update(dt);
                if (this.countdownTimer <= 0) {
                    this.state = "playing";
                }
                this.draw();
                requestAnimationFrame((t) => this.loop(t));
                return;
            }

            // playing / boss
            this.update(dt);
            this.draw();

            if (this.state === "playing" || this.state === "boss") {
                requestAnimationFrame((t) => this.loop(t));
            }
        }

        update(dt) {
            this.stars.update(dt);
            this.player.update(dt);

            // Movement
            const speed = this.player.speedBoost ? PLAYER_SPEED * 1.6 : PLAYER_SPEED;
            if (this.keys["ArrowLeft"] || this.keys["KeyA"]) {
                this.player.x = clamp(this.player.x - speed * dt, this.player.radius, CANVAS_W - this.player.radius);
            }
            if (this.keys["ArrowRight"] || this.keys["KeyD"]) {
                this.player.x = clamp(this.player.x + speed * dt, this.player.radius, CANVAS_W - this.player.radius);
            }

            // Shoot
            if ((this.keys["Space"] || this.keys["ArrowUp"]) && this.player.canShoot()) {
                const blist = this.player.shoot();
                blist.forEach(b => this.playerBullets.push(new Bullet(b)));
            }

            // Bomb flash
            if (this.bombFlash > 0) this.bombFlash -= dt;

            // Spawn enemies (not during boss)
            if (!this.bossPhase) {
                const def = this.currentDef();
                this.spawnTimer -= dt;
                if (this.spawnTimer <= 0) {
                    this.spawnTimer = Math.max(0.2, 1.0 / def.spawnRate);
                    this.spawnEnemy();
                }
            }

            // Update enemies
            this.enemies.forEach(e => {
                e.update(dt);
                if (e.canShoot()) {
                    this.enemyBullets.push(new Bullet({
                        x: e.x, y: e.y + e.radius,
                        vx: 0, vy: ENEMY_BULLET_SPEED, color: e.color,
                    }));
                    e.resetShootTimer();
                }
            });

            // Boss
            if (this.boss) {
                this.state = "boss";
                this.boss.update(dt);
                if (this.boss.canShoot()) {
                    this.boss.getBullets().forEach(b => this.enemyBullets.push(new Bullet(b)));
                    this.boss.resetShootTimer();
                }
            }

            // Player bullets hit enemies / boss
            this.playerBullets.forEach(b => {
                b.update(dt);
                // vs enemies
                this.enemies.forEach(e => {
                    if (!e.dead && !b.dead && dist(b, e) < b.radius + e.radius) {
                        e.hp--;
                        b.dead = true;
                        this.spawnExplosion(b.x, b.y, e.color, 4);
                        if (e.hp <= 0) {
                            e.dead = true;
                            this.score += e.score;
                            this.kills++;
                            this.spawnExplosion(e.x, e.y, e.color, 8);
                            // Powerup drop
                            if (Math.random() < 0.12) {
                                const type = POWERUP_TYPES[randInt(0, 2)];
                                this.powerups.push(new PowerUp(e.x, e.y, type));
                            }
                        }
                    }
                });
                // vs boss
                if (this.boss && !b.dead && dist(b, this.boss) < b.radius + this.boss.radius) {
                    b.dead = true;
                    this.boss.hp--;
                    this.spawnExplosion(b.x, b.y, "#ffffff", 3);
                    if (this.boss.hp <= 0) this.defeatBoss();
                }
            });

            // Move enemy bullets
            this.enemyBullets.forEach(b => b.update(dt));

            // Enemy bullets hit player
            if (!this.player.invincible) {
                this.enemyBullets.forEach(b => {
                    if (!b.dead && dist(b, this.player) < b.radius + this.player.radius) {
                        b.dead = true;
                        if (this.player.takeDamage()) {
                            this.spawnExplosion(this.player.x, this.player.y, "#5aaaff", 6);
                            if (this.player.hp <= 0) this.gameOver();
                        }
                    }
                });
            }

            // Enemies reaching bottom
            this.enemies.forEach(e => {
                if (!e.dead && e.y > CANVAS_H - 20) {
                    e.dead = true;
                    if (this.player.takeDamage()) {
                        this.spawnExplosion(this.player.x, this.player.y, "#ff6b6b", 8);
                        if (this.player.hp <= 0) this.gameOver();
                    }
                }
            });

            // Powerups
            this.powerups.forEach(pu => {
                pu.update(dt);
                if (!pu.dead && dist(pu, this.player) < pu.radius + this.player.radius) {
                    this.player.applyPowerup(pu.type);
                    pu.dead = true;
                }
            });

            // Particles
            this.particles.forEach(p => p.update(dt));

            // Cleanup
            this.enemies = this.enemies.filter(e => !e.dead && !e.offScreen);
            this.playerBullets = this.playerBullets.filter(b => !b.dead && !b.offScreen);
            this.enemyBullets = this.enemyBullets.filter(b => !b.dead && !b.offScreen);
            this.powerups = this.powerups.filter(p => !p.dead && !p.offScreen);
            this.particles = this.particles.filter(p => !p.dead);

            this.checkWin();
            this.updateUI();
        }

        draw() {
            const ctx = this.ctx;
            // Background
            const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
            bg.addColorStop(0, "#020212");
            bg.addColorStop(1, "#050520");
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

            // Bomb flash overlay
            if (this.bombFlash > 0) {
                ctx.save();
                ctx.globalAlpha = this.bombFlash * 1.5;
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
                ctx.restore();
            }

            this.stars.draw(ctx);
            this.particles.forEach(p => p.draw(ctx));
            this.powerups.forEach(pu => pu.draw(ctx));
            this.enemies.forEach(e => e.draw(ctx));
            if (this.boss) this.boss.draw(ctx);
            this.playerBullets.forEach(b => b.draw(ctx));
            this.enemyBullets.forEach(b => b.draw(ctx));
            if (this.player) this.player.draw(ctx);

            // Countdown
            if (this.state === "countdown") {
                ctx.save();
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = "rgba(0,0,0,0.4)";
                ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
                ctx.globalAlpha = 1;
                const cd = Math.ceil(this.countdownTimer);
                ctx.font = `bold 80px system-ui`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.shadowColor = "#5aaaff";
                ctx.shadowBlur = 30;
                ctx.fillStyle = "#ffffff";
                ctx.fillText(cd > 0 ? String(cd) : "GO!", CANVAS_W / 2, CANVAS_H / 2);
                ctx.restore();
            }

            // Kill progress bar (not in boss phase)
            if ((this.state === "playing") && !this.bossPhase) {
                const pct = Math.min(this.kills / this.killGoal, 1);
                const bw = CANVAS_W - 24;
                ctx.fillStyle = "rgba(255,255,255,0.06)";
                ctx.fillRect(12, 10, bw, 6);
                const grad = ctx.createLinearGradient(12, 0, 12 + bw, 0);
                grad.addColorStop(0, "#5aaaff");
                grad.addColorStop(1, "#ff6eb4");
                ctx.fillStyle = grad;
                ctx.fillRect(12, 10, bw * pct, 6);
                ctx.fillStyle = "rgba(255,255,255,0.55)";
                ctx.font = "10px system-ui";
                ctx.textAlign = "right";
                ctx.fillText(`${this.kills}/${this.killGoal} kills`, CANVAS_W - 14, 30);
            }

            // Boss bar label
            if (this.state === "boss" && this.boss) {
                ctx.fillStyle = "rgba(255,80,80,0.8)";
                ctx.font = "bold 12px system-ui";
                ctx.textAlign = "center";
                ctx.fillText("⚠ BOSS INCOMING", CANVAS_W / 2, 22);
            }
        }
    }

    // ===================== INIT =====================
    let shooterGame = null;

    function initShooterGame() {
        shooterGame = new ShooterGame();
        window.shooterGame = shooterGame;
    }

    window.initShooterGame = initShooterGame;
})();
