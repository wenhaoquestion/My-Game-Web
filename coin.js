function initCoinGame() {
    console.log("[coin.js] initCoinGame");

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const coin3d         = document.getElementById("coin-face");
    const coinMessage    = document.getElementById("coin-message");
    const coinLastResult = document.getElementById("coin-last-result");
    const flipBtn        = document.getElementById("flip-coin-btn");
    const resetBtn       = document.getElementById("reset-coin-btn");
    const totalEl        = document.getElementById("coin-total");
    const headsEl        = document.getElementById("coin-heads");
    const tailsEl        = document.getElementById("coin-tails");
    const streakEl       = document.getElementById("coin-streak");
    const bestStreakEl   = document.getElementById("coin-best-streak");
    const historyEl      = document.getElementById("coin-history");
    const predictStatus  = document.getElementById("coin-predict-status");
    const predictCorrect = document.getElementById("coin-predict-correct");
    const predictAcc     = document.getElementById("coin-predict-acc");
    const ratioHeads     = document.getElementById("coin-ratio-heads");
    const ratioTails     = document.getElementById("coin-ratio-tails");
    const shadowEl       = document.getElementById("coin-shadow");
    const particleCanvas = document.getElementById("coin-particles");
    const pctx           = particleCanvas ? particleCanvas.getContext("2d") : null;

    // ── State ─────────────────────────────────────────────────────────────────
    const state = {
        total: 0,
        heads: 0,
        tails: 0,
        streak: 0,
        bestStreak: 0,
        lastSide: null,
        history: [],
        prediction: null,       // "Heads" | "Tails" | null
        predictCorrect: 0,
        predictTotal: 0,
    };

    // Tracks the coin's current Y-rotation (degrees) so flips chain smoothly
    let currentRotY = 0;
    let flipLocked = false;
    let animationFrame = null;
    let pendingFinish = null;
    const modeSelect = document.getElementById('coin-mode');
    const challengeLabel = document.getElementById('coin-challenge-label');
    const challengeProgress = document.getElementById('coin-challenge-progress');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const challenge = () => modeSelect?.value === 'challenge';

    // ── Prediction buttons ────────────────────────────────────────────────────
    document.getElementById("predict-heads")?.addEventListener("click", () => setPrediction("Heads"));
    document.getElementById("predict-tails")?.addEventListener("click", () => setPrediction("Tails"));

    function setPrediction(side) {
        if (flipLocked) return;
        state.prediction = state.prediction === side ? null : side;
        refreshPredictButtons();
    }

    function refreshPredictButtons() {
        const hBtn = document.getElementById("predict-heads");
        const tBtn = document.getElementById("predict-tails");
        if (hBtn) {
            hBtn.classList.toggle("selected-heads", state.prediction === "Heads");
            hBtn.setAttribute('aria-pressed', String(state.prediction === 'Heads'));
        }
        if (tBtn) {
            tBtn.classList.toggle("selected-tails", state.prediction === "Tails");
            tBtn.setAttribute('aria-pressed', String(state.prediction === 'Tails'));
        }
        if (predictStatus) {
            predictStatus.textContent = state.prediction ? `Predicting: ${state.prediction}` : "No prediction";
        }
    }

    // ── Particle system ───────────────────────────────────────────────────────
    let particles = [];

    function spawnParticles(isHeads) {
        if (!pctx || reducedMotion.matches || document.body.dataset.game !== 'coin') return;
        const cx = particleCanvas.width / 2;
        const cy = particleCanvas.height / 2;
        const colors = isHeads
            ? ["#ffd166", "#ffe999", "#f4a81d", "#fff3a0", "#ffb800"]
            : ["#a78bfa", "#c4b5fd", "#7c3aed", "#ddd6fe", "#8b5cf6"];
        for (let i = 0; i < 38; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2.5 + Math.random() * 4;
            particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                r: 3 + Math.random() * 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                gravity: 0.12,
                life: 1,
                decay: 0.022 + Math.random() * 0.018,
            });
        }
        requestAnimationFrame(tickParticles);
    }

    function tickParticles() {
        if (!pctx) return;
        pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        let alive = false;
        for (const p of particles) {
            p.x  += p.vx;
            p.y  += p.vy;
            p.vy += p.gravity;
            p.life -= p.decay;
            p.alpha = Math.max(0, p.life);
            if (p.life > 0) {
                pctx.save();
                pctx.globalAlpha = p.alpha;
                pctx.fillStyle = p.color;
                pctx.beginPath();
                pctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
                pctx.fill();
                pctx.restore();
                alive = true;
            }
        }
        if (alive) {
            requestAnimationFrame(tickParticles);
        } else {
            particles = [];
            pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        }
    }

    // ── Coin animation ────────────────────────────────────────────────────────
    // Easing: fast start, smooth deceleration
    function easeOut(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function animateCoin(targetRotY, duration, onDone) {
        const startRot  = currentRotY;
        const deltaRot  = targetRotY - startRot;
        const startTime = performance.now();

        function frame(now) {
            const elapsed  = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased    = easeOut(progress);
            const rot      = startRot + deltaRot * eased;
            coin3d.style.transform = `rotateY(${rot}deg)`;

            // Shrink shadow while coin is "in the air", restore on land
            if (shadowEl) {
                const inAir = Math.sin(progress * Math.PI);
                shadowEl.style.opacity = 1 - inAir * 0.7;
                shadowEl.style.width   = (120 - inAir * 60) + "px";
            }

            if (progress < 1) {
                animationFrame = requestAnimationFrame(frame);
            } else {
                currentRotY = targetRotY;
                if (shadowEl) { shadowEl.style.opacity = "1"; shadowEl.style.width = "120px"; }
                onDone();
            }
        }
        animationFrame = requestAnimationFrame(frame);
    }

    // ── Core flip logic ───────────────────────────────────────────────────────
    function flipCoin() {
        if (!coin3d || flipLocked) return;
        if (challenge() && state.total >= 10) { resetGame(); return; }
        if (challenge() && !state.prediction) {
            coinMessage.textContent = 'Pick Heads or Tails before this round.';
            document.getElementById('predict-heads').focus();
            return;
        }
        flipLocked = true;
        flipBtn.disabled = true;
        resetBtn.disabled = true;
        modeSelect.disabled = true;
        document.getElementById('predict-heads').disabled = true;
        document.getElementById('predict-tails').disabled = true;
        flipBtn.textContent = 'Flipping…';

        const isHeads = Math.random() < 0.5;
        const result  = isHeads ? "Heads" : "Tails";

        // Number of full rotations before landing (random 5-9)
        const extraSpins = (5 + Math.floor(Math.random() * 5)) * 360;
        // Heads lands at 0 mod 360; Tails at 180 mod 360
        const landOffset  = isHeads ? 0 : 180;
        const targetRotY  = Math.ceil(currentRotY / 360) * 360 + extraSpins + landOffset;
        const duration    = reducedMotion.matches ? 50 : 800 + Math.random() * 250;

        // Remove old land-glow classes so animation can replay
        coin3d.classList.remove("land-heads", "land-tails");
        void coin3d.offsetWidth;

        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            pendingFinish = null;
            currentRotY = targetRotY;
            coin3d.style.transform = `rotateY(${targetRotY}deg)`;
            if (shadowEl) { shadowEl.style.opacity = '1'; shadowEl.style.width = '120px'; }
            // Land glow
            coin3d.classList.add(isHeads ? "land-heads" : "land-tails");

            // Particles
            spawnParticles(isHeads);

            // Evaluate prediction
            let predMsg = "";
            if (state.prediction) {
                state.predictTotal++;
                if (state.prediction === result) {
                    state.predictCorrect++;
                    predMsg = " ✓ Correct!";
                } else {
                    predMsg = " ✗ Wrong";
                }
                state.prediction = null;
                refreshPredictButtons();
            }

            // Update result display
            coinLastResult.textContent = `Last: ${result}`;
            coinMessage.textContent = (isHeads ? "☀ Heads!" : "☽ Tails!") + predMsg;

            // Update stats
            state.total++;
            if (isHeads) state.heads++; else state.tails++;
            if (state.lastSide === result) {
                state.streak++;
            } else {
                state.streak = 1;
            }
            state.bestStreak = Math.max(state.bestStreak, state.streak);
            state.lastSide = result;

            state.history.push({ side: result, time: formatTime() });
            if (state.history.length > 100) state.history.shift();

            updateStats();
            renderHistory();

            flipLocked = false;
            flipBtn.disabled = false;
            resetBtn.disabled = false;
            modeSelect.disabled = false;
            document.getElementById('predict-heads').disabled = challenge() && state.total >= 10;
            document.getElementById('predict-tails').disabled = challenge() && state.total >= 10;
            flipBtn.textContent = challenge() && state.total >= 10 ? 'Play again' : 'Flip Coin';
            if (challenge() && state.total >= 10) {
                coinMessage.textContent = `${state.predictCorrect} out of 10 correct. Every flip was a fresh chance.`;
                window.ArcadeFeedback?.play('win');
            } else window.ArcadeFeedback?.play('score');
        };
        pendingFinish = finish;
        animateCoin(targetRotY, duration, finish);
    }

    // ── Stats & history ───────────────────────────────────────────────────────
    function updateStats() {
        if (challengeLabel) challengeLabel.textContent = challenge() ? state.total >= 10 ? 'Ten rounds complete' : `Round ${state.total + 1} of 10` : 'Free play · no round limit';
        if (challengeProgress) { challengeProgress.hidden = !challenge(); challengeProgress.value = Math.min(state.total, 10); }
        totalEl.textContent = state.total;
        headsEl.textContent = state.heads;
        tailsEl.textContent = state.tails;
        streakEl.textContent = state.streak;
        bestStreakEl.textContent = state.bestStreak;
        predictCorrect.textContent = state.predictCorrect;
        if (state.predictTotal > 0) {
            predictAcc.textContent = Math.round(state.predictCorrect / state.predictTotal * 100) + "%";
        } else {
            predictAcc.textContent = "—";
        }

        // Ratio bar
        if (state.total > 0 && ratioHeads && ratioTails) {
            const hPct = (state.heads / state.total * 100).toFixed(1);
            const tPct = (state.tails / state.total * 100).toFixed(1);
            ratioHeads.style.width = hPct + "%";
            ratioTails.style.width = tPct + "%";
        }
    }

    function renderHistory() {
        historyEl.innerHTML = "";
        state.history.slice(-8).reverse().forEach((entry) => {
            const li       = document.createElement("li");
            const sideSpan = document.createElement("span");
            const timeSpan = document.createElement("span");
            sideSpan.textContent = entry.side;
            sideSpan.classList.add(entry.side === "Heads" ? "side-heads" : "side-tails");
            timeSpan.textContent = entry.time;
            timeSpan.classList.add("muted");
            li.appendChild(sideSpan);
            li.appendChild(timeSpan);
            historyEl.appendChild(li);
        });
    }

    function formatTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    // ── Reset ─────────────────────────────────────────────────────────────────
    function resetGame() {
        if (flipLocked) return;
        state.total = 0;
        state.heads = 0;
        state.tails = 0;
        state.streak = 0;
        state.bestStreak = 0;
        state.lastSide = null;
        state.history = [];
        state.prediction = null;
        state.predictCorrect = 0;
        state.predictTotal = 0;
        currentRotY = 0;
        flipBtn.textContent = 'Flip Coin';
        document.getElementById('predict-heads').disabled = false;
        document.getElementById('predict-tails').disabled = false;
        coin3d.style.transform = "rotateY(0deg)";
        coin3d.classList.remove("land-heads", "land-tails");
        if (shadowEl) { shadowEl.style.opacity = "1"; shadowEl.style.width = "120px"; }
        if (ratioHeads) ratioHeads.style.width = "50%";
        if (ratioTails) ratioTails.style.width = "50%";
        coinMessage.textContent = "Make your prediction and flip!";
        coinLastResult.textContent = "Waiting…";
        refreshPredictButtons();
        updateStats();
        renderHistory();
    }

    // ── Key handler ───────────────────────────────────────────────────────────
    function handleKeydown(e) {
        if (!document.getElementById("coin-screen")?.classList.contains("active")) return;
        if (e.target instanceof Element && e.target.closest("input, textarea, select, button, a, [role=\"button\"], [contenteditable=\"true\"]")) return;
        if (e.code === "Space" && !e.repeat) { e.preventDefault(); flipCoin(); }
    }

    flipBtn?.addEventListener("click", flipCoin);
    modeSelect?.addEventListener('change', resetGame);
    const settleHiddenFlip = () => {
        if (document.body.dataset.game === 'coin' && !document.hidden && document.body.dataset.gameHelp !== 'open') return;
        if (animationFrame !== null) cancelAnimationFrame(animationFrame);
        animationFrame = null;
        pendingFinish?.();
    };
    document.addEventListener('arcade:screenchange', settleHiddenFlip);
    document.addEventListener('visibilitychange', settleHiddenFlip);
    document.addEventListener('arcade:pause', settleHiddenFlip);
    resetBtn?.addEventListener("click", resetGame);
    document.addEventListener("keydown", handleKeydown);

    resetGame();
    const previous = window.render_game_to_text;
    window.render_game_to_text = () => document.body.dataset.game === 'coin' ? JSON.stringify({ game: 'coin', mode: modeSelect.value, flipping: flipLocked, total: state.total, heads: state.heads, tails: state.tails, prediction: state.prediction, correct: state.predictCorrect, lastSide: state.lastSide, rotation: currentRotY % 360, complete: challenge() && state.total >= 10 }) : previous?.() || '{}';
}

window.initCoinGame = initCoinGame;
