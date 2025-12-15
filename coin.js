function initCoinGame() {
    console.log("[coin.js] initCoinGame");

    const coinFace = document.getElementById("coin-face");
    const coinMessage = document.getElementById("coin-message");
    const coinLastResult = document.getElementById("coin-last-result");
    const flipBtn = document.getElementById("flip-coin-btn");
    const resetBtn = document.getElementById("reset-coin-btn");
    const totalEl = document.getElementById("coin-total");
    const headsEl = document.getElementById("coin-heads");
    const tailsEl = document.getElementById("coin-tails");
    const streakEl = document.getElementById("coin-streak");
    const bestStreakEl = document.getElementById("coin-best-streak");
    const historyEl = document.getElementById("coin-history");

    const state = {
        total: 0,
        heads: 0,
        tails: 0,
        streak: 0,
        bestStreak: 0,
        lastSide: null,
        history: [],
    };

    function updateStats(side) {
        if (side) {
            state.total += 1;
            if (side === "Heads") {
                state.heads += 1;
            } else {
                state.tails += 1;
            }

            if (state.lastSide === side) {
                state.streak += 1;
            } else {
                state.streak = 1;
            }
            state.bestStreak = Math.max(state.bestStreak, state.streak);
            state.lastSide = side;
        }

        totalEl.textContent = state.total;
        headsEl.textContent = state.heads;
        tailsEl.textContent = state.tails;
        streakEl.textContent = state.streak;
        bestStreakEl.textContent = state.bestStreak;
    }

    function renderHistory() {
        historyEl.innerHTML = "";
        state.history.slice(-8).reverse().forEach((entry) => {
            const li = document.createElement("li");
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

    function flipCoin() {
        if (!coinFace) return;

        // reset any previous animation class so flip can replay
        coinFace.classList.remove("spin");
        void coinFace.offsetWidth; // force reflow for animation restart

        const isHeads = Math.random() < 0.5;
        const result = isHeads ? "Heads" : "Tails";

        coinFace.textContent = isHeads ? "H" : "T";
        coinFace.dataset.side = result.toLowerCase();
        coinFace.classList.add("spin");

        coinMessage.textContent = result === "Heads" ? "Heads! Shine of luck." : "Tails! Try again.";
        coinLastResult.textContent = `Last: ${result}`;

        state.history.push({ side: result, time: formatTime() });
        updateStats(result);
        renderHistory();
    }

    function resetStats() {
        state.total = 0;
        state.heads = 0;
        state.tails = 0;
        state.streak = 0;
        state.bestStreak = 0;
        state.lastSide = null;
        state.history = [];

        coinFace.textContent = "?";
        coinMessage.textContent = "Ready to try your luck?";
        coinLastResult.textContent = "Waiting...";
        updateStats();
        renderHistory();
    }

    function handleKeydown(event) {
        const isCoinScreenActive = document.getElementById("coin-screen")?.classList.contains("active");
        if (!isCoinScreenActive) return;

        if (event.code === "Space") {
            event.preventDefault();
            flipCoin();
        }
    }

    flipBtn?.addEventListener("click", flipCoin);
    resetBtn?.addEventListener("click", resetStats);
    document.addEventListener("keydown", handleKeydown);

    resetStats();
}

window.initCoinGame = initCoinGame;