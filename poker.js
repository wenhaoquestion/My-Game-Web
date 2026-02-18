function initPokerGame() {
    console.log("[poker.js] initPokerGame");

    const statusEl = document.getElementById("poker-status-label");
    const selectionHintEl = document.getElementById("poker-selection-hint");
    const calcBtn = document.getElementById("poker-calc-btn");
    const clearBtn = document.getElementById("poker-clear-btn");
    const resetBtn = document.getElementById("poker-reset-btn");
    const opponentsSelect = document.getElementById("poker-opponents");
    const iterationsRange = document.getElementById("poker-iterations");
    const iterationsValue = document.getElementById("poker-iterations-value");
    const randomHeroBtn = document.getElementById("poker-random-hero-btn");
    const randomBoardBtn = document.getElementById("poker-random-board-btn");
    const deckContainer = document.getElementById("poker-deck");

    const winEl = document.getElementById("poker-win");
    const tieEl = document.getElementById("poker-tie");
    const loseEl = document.getElementById("poker-lose");
    const equityValueEl = document.getElementById("poker-equity-value");
    const equityRingEl = document.getElementById("poker-equity-ring");
    const runSummaryEl = document.getElementById("poker-run-summary");
    const winBar = document.getElementById("poker-win-bar");
    const tieBar = document.getElementById("poker-tie-bar");
    const loseBar = document.getElementById("poker-lose-bar");
    const progressFill = document.getElementById("poker-progress-fill");

    const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    const SUITS = ["S", "H", "D", "C"];
    const SUIT_CLASS = {
        S: "suit-spade",
        H: "suit-heart",
        D: "suit-diamond",
        C: "suit-club",
    };
    const SUIT_INDEX = {
        S: 0,
        H: 1,
        D: 2,
        C: 3,
    };
    const RANK_VALUE = {
        "2": 2,
        "3": 3,
        "4": 4,
        "5": 5,
        "6": 6,
        "7": 7,
        "8": 8,
        "9": 9,
        "10": 10,
        J: 11,
        Q: 12,
        K: 13,
        A: 14,
    };

    const state = {
        hero: [null, null],
        board: [null, null, null, null, null],
        selected: { type: "hero", index: 0 },
        running: false,
    };

    const slotMap = { hero: [], board: [] };
    const deck = [];
    const deckButtons = {};

    function createCard(rank, suit) {
        return {
            rank,
            suit,
            rankValue: RANK_VALUE[rank],
            suitIndex: SUIT_INDEX[suit],
            code: `${rank}${suit}`,
        };
    }

    function buildDeck() {
        if (!deckContainer) return;
        deckContainer.innerHTML = "";
        SUITS.forEach((suit) => {
            const row = document.createElement("div");
            row.className = "poker-deck-row";

            const label = document.createElement("div");
            label.className = `poker-deck-label ${SUIT_CLASS[suit]}`;
            label.textContent = suit;
            row.appendChild(label);

            RANKS.forEach((rank) => {
                const card = createCard(rank, suit);
                deck.push(card);

                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = `poker-card-btn ${SUIT_CLASS[suit]}`;
                btn.textContent = `${rank}${suit}`;
                btn.dataset.code = card.code;
                btn.addEventListener("click", () => handleDeckClick(card));

                deckButtons[card.code] = btn;
                row.appendChild(btn);
            });

            deckContainer.appendChild(row);
        });
    }

    function initSlots() {
        document.querySelectorAll(".poker-card-slot").forEach((slot) => {
            const type = slot.dataset.slotType;
            const index = Number(slot.dataset.slotIndex);
            if (type && Number.isFinite(index)) {
                slotMap[type][index] = slot;
                slot.addEventListener("click", () => {
                    setSelectedSlot(type, index);
                });
            }
        });
    }

    function setSelectedSlot(type, index) {
        state.selected = { type, index };
        updateSelectionUI();
    }

    function getSlotCard(type, index) {
        return type === "hero" ? state.hero[index] : state.board[index];
    }

    function clearSlot(type, index) {
        if (type === "hero") {
            state.hero[index] = null;
        } else {
            state.board[index] = null;
        }
    }

    function assignCard(type, index, card) {
        if (type === "hero") {
            state.hero[index] = card;
        } else {
            state.board[index] = card;
        }
    }

    function getUsedCodes() {
        const used = new Set();
        [...state.hero, ...state.board].forEach((card) => {
            if (card) used.add(card.code);
        });
        return used;
    }

    function findNextEmptySlot() {
        for (let i = 0; i < state.hero.length; i += 1) {
            if (!state.hero[i]) return { type: "hero", index: i };
        }
        for (let i = 0; i < state.board.length; i += 1) {
            if (!state.board[i]) return { type: "board", index: i };
        }
        return null;
    }

    function autoAdvanceSelection() {
        const next = findNextEmptySlot();
        if (next) {
            setSelectedSlot(next.type, next.index);
        }
    }

    function slotLabel(type, index) {
        if (type === "hero") return `Hand ${index + 1}`;
        if (index <= 2) return `Flop ${index + 1}`;
        if (index === 3) return "Turn";
        return "River";
    }

    function updateSelectionUI() {
        const { type, index } = state.selected || {};
        if (selectionHintEl) {
            if (type) {
                selectionHintEl.textContent = `Selected: ${slotLabel(type, index)}`;
            } else {
                selectionHintEl.textContent = "Selected: None";
            }
        }

        ["hero", "board"].forEach((group) => {
            slotMap[group].forEach((slot, i) => {
                if (!slot) return;
                const isSelected = type === group && index === i;
                slot.classList.toggle("selected", isSelected);
            });
        });
    }

    function renderSlot(slot, card) {
        if (!slot) return;
        if (!card) {
            slot.classList.add("empty");
            slot.innerHTML = "<span class=\"poker-card-placeholder\">Pick</span>";
            return;
        }

        slot.classList.remove("empty");
        slot.innerHTML = `
            <span class="poker-card-rank">${card.rank}</span>
            <span class="poker-card-suit ${SUIT_CLASS[card.suit]}">${card.suit}</span>
        `;
    }

    function updateSlots() {
        state.hero.forEach((card, index) => {
            renderSlot(slotMap.hero[index], card);
        });
        state.board.forEach((card, index) => {
            renderSlot(slotMap.board[index], card);
        });
    }

    function updateDeckButtons() {
        const used = getUsedCodes();
        Object.keys(deckButtons).forEach((code) => {
            const btn = deckButtons[code];
            btn.classList.toggle("is-used", used.has(code));
        });
    }

    function updateAll() {
        updateSlots();
        updateDeckButtons();
        updateSelectionUI();
    }

    function handleDeckClick(card) {
        if (state.running) return;
        if (!state.selected) {
            setStatus("Select a slot first");
            return;
        }

        const used = getUsedCodes();
        const { type, index } = state.selected;
        const currentCard = getSlotCard(type, index);

        if (used.has(card.code)) {
            if (currentCard && currentCard.code === card.code) {
                clearSlot(type, index);
                updateAll();
                setStatus("Card cleared");
                return;
            }
            setStatus("Card already used");
            return;
        }

        assignCard(type, index, card);
        autoAdvanceSelection();
        updateAll();
        setStatus("Ready");
    }

    function clearSelectedSlot() {
        if (state.running || !state.selected) return;
        const { type, index } = state.selected;
        clearSlot(type, index);
        updateAll();
        setStatus("Card cleared");
    }

    function resetAll() {
        if (state.running) return;
        state.hero = [null, null];
        state.board = [null, null, null, null, null];
        setSelectedSlot("hero", 0);
        updateAll();
        resetResults();
        setStatus("Ready");
    }

    function randomPick(count, pool) {
        const copy = pool.slice();
        const picked = [];
        for (let i = 0; i < count; i += 1) {
            const idx = i + Math.floor(Math.random() * (copy.length - i));
            [copy[i], copy[idx]] = [copy[idx], copy[i]];
            picked.push(copy[i]);
        }
        return picked;
    }

    function randomHero() {
        if (state.running) return;
        state.hero = [null, null];
        const available = deck.filter((card) => {
            return !state.board.some((b) => b && b.code === card.code);
        });
        const picked = randomPick(2, available);
        state.hero = [picked[0], picked[1]];
        autoAdvanceSelection();
        updateAll();
        setStatus("Random hero hand");
    }

    function randomBoard() {
        if (state.running) return;
        state.board = [null, null, null, null, null];
        const used = getUsedCodes();
        const available = deck.filter((card) => !used.has(card.code));
        const picked = randomPick(5, available);
        state.board = picked;
        autoAdvanceSelection();
        updateAll();
        setStatus("Random board");
    }

    function resetResults() {
        if (winEl) winEl.textContent = "--%";
        if (tieEl) tieEl.textContent = "--%";
        if (loseEl) loseEl.textContent = "--%";
        if (equityValueEl) equityValueEl.textContent = "--%";
        if (equityRingEl) equityRingEl.style.setProperty("--equity", "0%");
        if (winBar) winBar.style.width = "0%";
        if (tieBar) tieBar.style.width = "0%";
        if (loseBar) loseBar.style.width = "0%";
        if (runSummaryEl) runSummaryEl.textContent = "No simulation yet";
        if (progressFill) progressFill.style.width = "0%";
    }

    function setStatus(text) {
        if (statusEl) statusEl.textContent = text;
    }

    function setRunningState(isRunning) {
        state.running = isRunning;
        if (calcBtn) calcBtn.disabled = isRunning;
        if (clearBtn) clearBtn.disabled = isRunning;
        if (resetBtn) resetBtn.disabled = isRunning;
        if (randomHeroBtn) randomHeroBtn.disabled = isRunning;
        if (randomBoardBtn) randomBoardBtn.disabled = isRunning;
        if (deckContainer) deckContainer.classList.toggle("disabled", isRunning);
    }

    function drawFromDeck(deckPool, count, cursor) {
        const drawn = [];
        for (let i = 0; i < count; i += 1) {
            const swapIndex = cursor.value + Math.floor(Math.random() * (deckPool.length - cursor.value));
            [deckPool[cursor.value], deckPool[swapIndex]] = [deckPool[swapIndex], deckPool[cursor.value]];
            drawn.push(deckPool[cursor.value]);
            cursor.value += 1;
        }
        return drawn;
    }

    function compareRanks(a, b) {
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i += 1) {
            const diff = (a[i] || 0) - (b[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    }

    function evaluateFive(cards) {
        const ranks = cards.map((c) => c.rankValue).sort((a, b) => b - a);
        const suits = cards.map((c) => c.suitIndex);
        const isFlush = suits.every((s) => s === suits[0]);

        const counts = new Map();
        ranks.forEach((rank) => {
            counts.set(rank, (counts.get(rank) || 0) + 1);
        });
        const entries = Array.from(counts.entries()).sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return b[0] - a[0];
        });

        const uniqueRanks = Array.from(counts.keys()).sort((a, b) => b - a);
        let straightHigh = null;
        if (uniqueRanks.length === 5) {
            if (uniqueRanks[0] - uniqueRanks[4] === 4) {
                straightHigh = uniqueRanks[0];
            } else if (
                uniqueRanks[0] === 14 &&
                uniqueRanks[1] === 5 &&
                uniqueRanks[2] === 4 &&
                uniqueRanks[3] === 3 &&
                uniqueRanks[4] === 2
            ) {
                straightHigh = 5;
            }
        }

        if (straightHigh && isFlush) {
            return [8, straightHigh];
        }

        if (entries[0][1] === 4) {
            return [7, entries[0][0], entries[1][0]];
        }

        if (entries[0][1] === 3 && entries[1][1] === 2) {
            return [6, entries[0][0], entries[1][0]];
        }

        if (isFlush) {
            return [5, ...ranks];
        }

        if (straightHigh) {
            return [4, straightHigh];
        }

        if (entries[0][1] === 3) {
            const kickers = entries.slice(1).map((entry) => entry[0]).sort((a, b) => b - a);
            return [3, entries[0][0], ...kickers];
        }

        if (entries[0][1] === 2 && entries[1][1] === 2) {
            const highPair = Math.max(entries[0][0], entries[1][0]);
            const lowPair = Math.min(entries[0][0], entries[1][0]);
            return [2, highPair, lowPair, entries[2][0]];
        }

        if (entries[0][1] === 2) {
            const kickers = entries.slice(1).map((entry) => entry[0]).sort((a, b) => b - a);
            return [1, entries[0][0], ...kickers];
        }

        return [0, ...ranks];
    }

    function evaluateSeven(cards) {
        let best = null;
        for (let i = 0; i < 3; i += 1) {
            for (let j = i + 1; j < 4; j += 1) {
                for (let k = j + 1; k < 5; k += 1) {
                    for (let l = k + 1; l < 6; l += 1) {
                        for (let m = l + 1; m < 7; m += 1) {
                            const rank = evaluateFive([cards[i], cards[j], cards[k], cards[l], cards[m]]);
                            if (!best || compareRanks(rank, best) > 0) {
                                best = rank;
                            }
                        }
                    }
                }
            }
        }
        return best;
    }

    function formatPercent(value) {
        return `${value.toFixed(1)}%`;
    }

    function updateResults(winPct, tiePct, losePct, equityPct, iterations, durationMs) {
        if (winEl) winEl.textContent = formatPercent(winPct);
        if (tieEl) tieEl.textContent = formatPercent(tiePct);
        if (loseEl) loseEl.textContent = formatPercent(losePct);
        if (equityValueEl) equityValueEl.textContent = formatPercent(equityPct);
        if (equityRingEl) equityRingEl.style.setProperty("--equity", `${equityPct}%`);
        if (winBar) winBar.style.width = `${Math.min(winPct, 100)}%`;
        if (tieBar) tieBar.style.width = `${Math.min(tiePct, 100)}%`;
        if (loseBar) loseBar.style.width = `${Math.min(losePct, 100)}%`;
        if (runSummaryEl) {
            const duration = (durationMs / 1000).toFixed(2);
            runSummaryEl.textContent = `Simulated ${iterations.toLocaleString()} hands in ${duration}s`;
        }
    }

    function calculateOdds() {
        if (state.running) return;

        const heroCards = state.hero.filter(Boolean);
        if (heroCards.length < 2) {
            setStatus("Pick 2 hero cards");
            return;
        }

        const knownBoard = state.board.filter(Boolean);
        const opponents = Number(opponentsSelect?.value) || 1;
        const iterations = Number(iterationsRange?.value) || 6000;

        const used = getUsedCodes();
        const availableDeck = deck.filter((card) => !used.has(card.code));
        const missingBoard = 5 - knownBoard.length;
        const neededCards = missingBoard + opponents * 2;

        if (availableDeck.length < neededCards) {
            setStatus("Not enough cards in deck");
            return;
        }

        setRunningState(true);
        setStatus("Running 0%");
        if (progressFill) progressFill.style.width = "0%";
        if (runSummaryEl) runSummaryEl.textContent = `Simulating ${iterations.toLocaleString()} hands...`;

        let wins = 0;
        let ties = 0;
        let losses = 0;
        let equity = 0;
        let done = 0;
        const startTime = performance.now();
        const batchSize = 300;

        function step() {
            const end = Math.min(iterations, done + batchSize);
            for (; done < end; done += 1) {
                const deckPool = availableDeck.slice();
                const cursor = { value: 0 };

                const boardDraw = drawFromDeck(deckPool, missingBoard, cursor);
                const board = knownBoard.concat(boardDraw);

                const heroRank = evaluateSeven(heroCards.concat(board));
                const ranks = [heroRank];

                for (let p = 0; p < opponents; p += 1) {
                    const oppCards = drawFromDeck(deckPool, 2, cursor);
                    ranks.push(evaluateSeven(oppCards.concat(board)));
                }

                let best = ranks[0];
                for (let i = 1; i < ranks.length; i += 1) {
                    if (compareRanks(ranks[i], best) > 0) {
                        best = ranks[i];
                    }
                }

                let winners = 0;
                ranks.forEach((rank) => {
                    if (compareRanks(rank, best) === 0) winners += 1;
                });

                const heroBest = compareRanks(heroRank, best) === 0;
                if (heroBest) {
                    if (winners === 1) {
                        wins += 1;
                    } else {
                        ties += 1;
                    }
                    equity += 1 / winners;
                } else {
                    losses += 1;
                }
            }

            const progress = done / iterations;
            if (progressFill) progressFill.style.width = `${Math.round(progress * 100)}%`;
            setStatus(`Running ${Math.round(progress * 100)}%`);
            if (runSummaryEl) runSummaryEl.textContent = `Simulating ${done.toLocaleString()} / ${iterations.toLocaleString()}`;

            if (done < iterations) {
                requestAnimationFrame(step);
            } else {
                const durationMs = performance.now() - startTime;
                const winPct = (wins / iterations) * 100;
                const tiePct = (ties / iterations) * 100;
                const losePct = (losses / iterations) * 100;
                const equityPct = (equity / iterations) * 100;
                updateResults(winPct, tiePct, losePct, equityPct, iterations, durationMs);
                setRunningState(false);
                setStatus("Done");
                if (progressFill) progressFill.style.width = "100%";
            }
        }

        requestAnimationFrame(step);
    }

    iterationsRange?.addEventListener("input", () => {
        if (iterationsValue) {
            iterationsValue.textContent = Number(iterationsRange.value).toLocaleString();
        }
    });

    calcBtn?.addEventListener("click", calculateOdds);
    clearBtn?.addEventListener("click", clearSelectedSlot);
    resetBtn?.addEventListener("click", resetAll);
    randomHeroBtn?.addEventListener("click", randomHero);
    randomBoardBtn?.addEventListener("click", randomBoard);

    buildDeck();
    initSlots();
    updateAll();
    resetResults();
    setStatus("Ready");
}

window.initPokerGame = initPokerGame;
