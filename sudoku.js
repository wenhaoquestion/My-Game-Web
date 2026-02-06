// ================= Prism Sudoku =================

const SUDOKU_SIZE = 9;
const SUDOKU_BOX = 3;

const MODE_LABELS = {
    classic: "Classic",
    killer: "Killer",
};

const DIFFICULTY_LABELS = {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    expert: "Expert",
};

const DIFFICULTY_PRESETS = {
    easy: { classic: 45, killer: 32 },
    medium: { classic: 36, killer: 26 },
    hard: { classic: 30, killer: 20 },
    expert: { classic: 24, killer: 14 },
};

const SUDOKU_STATS_KEY = "sudoku_stats_v1";
const SUDOKU_SETTINGS_KEY = "sudoku_settings_v1";

function createEmptyGrid() {
    return Array.from({ length: SUDOKU_SIZE }, () =>
        Array.from({ length: SUDOKU_SIZE }, () => 0)
    );
}

function createNotesGrid() {
    return Array.from({ length: SUDOKU_SIZE }, () =>
        Array.from({ length: SUDOKU_SIZE }, () => Array(10).fill(false))
    );
}

function cloneGrid(grid) {
    return grid.map((row) => row.slice());
}

function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function isValidPlacement(grid, row, col, value) {
    for (let i = 0; i < SUDOKU_SIZE; i += 1) {
        if (grid[row][i] === value) return false;
        if (grid[i][col] === value) return false;
    }

    const startRow = Math.floor(row / SUDOKU_BOX) * SUDOKU_BOX;
    const startCol = Math.floor(col / SUDOKU_BOX) * SUDOKU_BOX;
    for (let r = 0; r < SUDOKU_BOX; r += 1) {
        for (let c = 0; c < SUDOKU_BOX; c += 1) {
            if (grid[startRow + r][startCol + c] === value) {
                return false;
            }
        }
    }
    return true;
}

function fillGrid(grid, row = 0, col = 0) {
    if (row === SUDOKU_SIZE) return true;

    const nextRow = col === SUDOKU_SIZE - 1 ? row + 1 : row;
    const nextCol = col === SUDOKU_SIZE - 1 ? 0 : col + 1;

    if (grid[row][col] !== 0) {
        return fillGrid(grid, nextRow, nextCol);
    }

    const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const num of numbers) {
        if (isValidPlacement(grid, row, col, num)) {
            grid[row][col] = num;
            if (fillGrid(grid, nextRow, nextCol)) return true;
            grid[row][col] = 0;
        }
    }

    return false;
}

function generateSolvedGrid() {
    const grid = createEmptyGrid();
    fillGrid(grid);
    return grid;
}

function findEmptyCell(grid) {
    for (let r = 0; r < SUDOKU_SIZE; r += 1) {
        for (let c = 0; c < SUDOKU_SIZE; c += 1) {
            if (grid[r][c] === 0) {
                return { r, c };
            }
        }
    }
    return null;
}

function countSolutions(grid, limit = 2) {
    const empty = findEmptyCell(grid);
    if (!empty) return 1;

    const { r, c } = empty;
    let count = 0;
    for (let num = 1; num <= 9; num += 1) {
        if (isValidPlacement(grid, r, c, num)) {
            grid[r][c] = num;
            count += countSolutions(grid, limit);
            grid[r][c] = 0;
            if (count >= limit) return count;
        }
    }
    return count;
}

function hasUniqueSolution(grid) {
    const clone = cloneGrid(grid);
    return countSolutions(clone, 2) === 1;
}

function makePuzzleFromSolution(solution, clues) {
    const puzzle = cloneGrid(solution);
    const positions = [];
    for (let r = 0; r < SUDOKU_SIZE; r += 1) {
        for (let c = 0; c < SUDOKU_SIZE; c += 1) {
            positions.push({ r, c });
        }
    }

    let remaining = SUDOKU_SIZE * SUDOKU_SIZE;
    for (const pos of shuffle(positions)) {
        if (remaining <= clues) break;
        const { r, c } = pos;
        const backup = puzzle[r][c];
        puzzle[r][c] = 0;

        if (!hasUniqueSolution(puzzle)) {
            puzzle[r][c] = backup;
        } else {
            remaining -= 1;
        }
    }

    return puzzle;
}

function randomChoice(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function generateCages(solution) {
    const remaining = new Set();
    for (let r = 0; r < SUDOKU_SIZE; r += 1) {
        for (let c = 0; c < SUDOKU_SIZE; c += 1) {
            remaining.add(r * SUDOKU_SIZE + c);
        }
    }

    const cages = [];
    const sizePool = [1, 2, 2, 3, 3, 4];

    while (remaining.size > 0) {
        const startId = randomChoice(Array.from(remaining));
        const start = { r: Math.floor(startId / SUDOKU_SIZE), c: startId % SUDOKU_SIZE };
        const targetSize = randomChoice(sizePool);

        const cageCells = [start];
        remaining.delete(startId);

        while (cageCells.length < targetSize) {
            const neighbors = [];
            for (const cell of cageCells) {
                const candidates = [
                    { r: cell.r - 1, c: cell.c },
                    { r: cell.r + 1, c: cell.c },
                    { r: cell.r, c: cell.c - 1 },
                    { r: cell.r, c: cell.c + 1 },
                ];
                for (const cand of candidates) {
                    if (
                        cand.r >= 0 &&
                        cand.r < SUDOKU_SIZE &&
                        cand.c >= 0 &&
                        cand.c < SUDOKU_SIZE
                    ) {
                        const id = cand.r * SUDOKU_SIZE + cand.c;
                        if (remaining.has(id)) {
                            neighbors.push(cand);
                        }
                    }
                }
            }

            if (neighbors.length === 0) break;
            const next = randomChoice(neighbors);
            const nextId = next.r * SUDOKU_SIZE + next.c;
            remaining.delete(nextId);
            cageCells.push(next);
        }

        const sum = cageCells.reduce((acc, cell) => acc + solution[cell.r][cell.c], 0);
        cages.push({ cells: cageCells, sum });
    }

    return cages;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function defaultSudokuStats() {
    return {
        totalSolved: 0,
        perfectSolved: 0,
        currentStreak: 0,
        bestStreak: 0,
        totalTime: 0,
        bestTime: null,
        bestMode: "",
        bestDifficulty: "",
        hardestMode: "",
        hardestDifficulty: "",
        modeStats: {
            classic: {
                solved: 0,
                currentStreak: 0,
                bestStreak: 0,
                totalTime: 0,
                hardestDifficulty: "",
            },
            killer: {
                solved: 0,
                currentStreak: 0,
                bestStreak: 0,
                totalTime: 0,
                hardestDifficulty: "",
            },
        },
        bestByMode: {
            classic: { easy: null, medium: null, hard: null, expert: null },
            killer: { easy: null, medium: null, hard: null, expert: null },
        },
    };
}

function normalizeSudokuStats(raw) {
    const stats = defaultSudokuStats();
    if (!raw || typeof raw !== "object") return stats;
    stats.totalSolved = Number.isFinite(raw.totalSolved) ? raw.totalSolved : 0;
    stats.perfectSolved = Number.isFinite(raw.perfectSolved) ? raw.perfectSolved : 0;
    stats.currentStreak = Number.isFinite(raw.currentStreak) ? raw.currentStreak : 0;
    stats.bestStreak = Number.isFinite(raw.bestStreak) ? raw.bestStreak : 0;
    stats.totalTime = Number.isFinite(raw.totalTime) ? raw.totalTime : 0;
    stats.bestTime = Number.isFinite(raw.bestTime) ? raw.bestTime : null;
    stats.bestMode = typeof raw.bestMode === "string" ? raw.bestMode : "";
    stats.bestDifficulty = typeof raw.bestDifficulty === "string" ? raw.bestDifficulty : "";
    stats.hardestMode = typeof raw.hardestMode === "string" ? raw.hardestMode : "";
    stats.hardestDifficulty = typeof raw.hardestDifficulty === "string" ? raw.hardestDifficulty : "";

    const modeStats = raw.modeStats || {};
    ["classic", "killer"].forEach((mode) => {
        const modeRaw = modeStats[mode] || {};
        stats.modeStats[mode] = {
            solved: Number.isFinite(modeRaw.solved) ? modeRaw.solved : 0,
            currentStreak: Number.isFinite(modeRaw.currentStreak) ? modeRaw.currentStreak : 0,
            bestStreak: Number.isFinite(modeRaw.bestStreak) ? modeRaw.bestStreak : 0,
            totalTime: Number.isFinite(modeRaw.totalTime) ? modeRaw.totalTime : 0,
            hardestDifficulty:
                typeof modeRaw.hardestDifficulty === "string" ? modeRaw.hardestDifficulty : "",
        };
    });

    const bestByMode = raw.bestByMode || {};
    ["classic", "killer"].forEach((mode) => {
        const modeData = bestByMode[mode] || {};
        ["easy", "medium", "hard", "expert"].forEach((diff) => {
            const value = modeData[diff];
            stats.bestByMode[mode][diff] = Number.isFinite(value) ? value : null;
        });
    });

    return stats;
}

function loadSudokuStats() {
    try {
        const raw = localStorage.getItem(SUDOKU_STATS_KEY);
        return normalizeSudokuStats(raw ? JSON.parse(raw) : null);
    } catch (err) {
        return defaultSudokuStats();
    }
}

function saveSudokuStats(stats) {
    localStorage.setItem(SUDOKU_STATS_KEY, JSON.stringify(stats));
}

function defaultSudokuSettings() {
    return {
        autoCheck: true,
        mistakeLimit: 0,
    };
}

function loadSudokuSettings() {
    try {
        const raw = localStorage.getItem(SUDOKU_SETTINGS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return defaultSudokuSettings();
        return {
            autoCheck: typeof parsed.autoCheck === "boolean" ? parsed.autoCheck : true,
            mistakeLimit: Number.isFinite(parsed.mistakeLimit) ? parsed.mistakeLimit : 0,
        };
    } catch (err) {
        return defaultSudokuSettings();
    }
}

function saveSudokuSettings(settings) {
    localStorage.setItem(SUDOKU_SETTINGS_KEY, JSON.stringify(settings));
}

class SudokuGame {
    constructor() {
        this.boardEl = document.getElementById("sudoku-board");
        this.modeLabelEl = document.getElementById("sudoku-mode-label");
        this.difficultyLabelEl = document.getElementById("sudoku-difficulty-label");
        this.timerEl = document.getElementById("sudoku-timer");
        this.mistakesEl = document.getElementById("sudoku-mistakes");
        this.hintsEl = document.getElementById("sudoku-hints");
        this.stateEl = document.getElementById("sudoku-state");
        this.overlayEl = document.getElementById("sudoku-overlay");
        this.overlayTitleEl = document.getElementById("sudoku-overlay-title");
        this.overlayDescEl = document.getElementById("sudoku-overlay-desc");
        this.playAgainBtn = document.getElementById("sudoku-play-again-btn");
        this.continueBtn = document.getElementById("sudoku-continue-btn");

        this.modeButtons = Array.from(document.querySelectorAll(".sudoku-mode-btn"));
        this.difficultyButtons = Array.from(document.querySelectorAll(".sudoku-difficulty-btn"));
        this.padButtons = Array.from(document.querySelectorAll("#sudoku-pad .btn"));

        this.noteToggleBtn = document.getElementById("sudoku-note-toggle");
        this.autoToggleBtn = document.getElementById("sudoku-auto-toggle");
        this.limitButtons = Array.from(document.querySelectorAll(".sudoku-limit-btn"));

        this.newGameBtn = document.getElementById("sudoku-newgame-btn");
        this.hintBtn = document.getElementById("sudoku-hint-btn");
        this.clearBtn = document.getElementById("sudoku-clear-btn");

        this.totalSolvesEl = document.getElementById("sudoku-total-solves");
        this.perfectSolvesEl = document.getElementById("sudoku-perfect-solves");
        this.classicStreakEl = document.getElementById("sudoku-classic-streak");
        this.classicBestStreakEl = document.getElementById("sudoku-classic-best-streak");
        this.killerStreakEl = document.getElementById("sudoku-killer-streak");
        this.killerBestStreakEl = document.getElementById("sudoku-killer-best-streak");
        this.classicAvgEl = document.getElementById("sudoku-classic-avg");
        this.killerAvgEl = document.getElementById("sudoku-killer-avg");
        this.bestTimeEl = document.getElementById("sudoku-best-time");
        this.classicHardestEl = document.getElementById("sudoku-classic-hardest");
        this.killerHardestEl = document.getElementById("sudoku-killer-hardest");
        this.bestDetailEl = document.getElementById("sudoku-best-detail");
        this.hardestDetailEl = document.getElementById("sudoku-hardest-detail");

        this.mode = "classic";
        this.difficulty = "easy";
        this.selected = null;
        this.solution = createEmptyGrid();
        this.puzzle = createEmptyGrid();
        this.userGrid = createEmptyGrid();
        this.given = createEmptyGrid();
        this.hinted = createEmptyGrid();
        this.notes = createNotesGrid();
        this.cages = [];
        this.cageMap = createEmptyGrid();
        this.cageEdges = createEmptyGrid();
        this.cageLabels = createEmptyGrid();

        this.timerInterval = null;
        this.startTime = 0;
        this.mistakes = 0;
        this.hintsUsed = 0;

        const settings = loadSudokuSettings();
        this.noteMode = false;
        this.autoCheck = settings.autoCheck;
        this.mistakeLimit = settings.mistakeLimit;
        this.gameOver = false;
        this.isSolved = false;

        this.stats = loadSudokuStats();

        this.cells = [];
        this.valueEls = [];
        this.noteSpans = [];
        this.buildBoard();
        this.bindEvents();
        this.updateModeUI();
        this.updateDifficultyUI();
        this.updateNoteModeUI();
        this.updateAutoCheckUI();
        this.updateLimitUI();
        this.updateAchievementsUI();
        this.startNewGame();
    }

    isActiveScreen() {
        const screen = document.getElementById("sudoku-screen");
        return !!(screen && screen.classList.contains("active"));
    }

    buildBoard() {
        this.boardEl.innerHTML = "";
        this.cells = [];
        this.valueEls = [];
        this.noteSpans = [];
        for (let r = 0; r < SUDOKU_SIZE; r += 1) {
            const row = [];
            const valueRow = [];
            const notesRow = [];
            for (let c = 0; c < SUDOKU_SIZE; c += 1) {
                const cell = document.createElement("div");
                cell.className = "sudoku-cell";
                cell.dataset.r = String(r);
                cell.dataset.c = String(c);
                if (c % SUDOKU_BOX === SUDOKU_BOX - 1 && c !== SUDOKU_SIZE - 1) {
                    cell.classList.add("sudoku-block-right");
                }
                if (r % SUDOKU_BOX === SUDOKU_BOX - 1 && r !== SUDOKU_SIZE - 1) {
                    cell.classList.add("sudoku-block-bottom");
                }
                const notesEl = document.createElement("div");
                notesEl.className = "sudoku-notes";
                const noteSpanRow = [];
                for (let n = 1; n <= 9; n += 1) {
                    const span = document.createElement("span");
                    span.textContent = String(n);
                    notesEl.appendChild(span);
                    noteSpanRow.push(span);
                }

                const valueEl = document.createElement("div");
                valueEl.className = "sudoku-value";

                cell.appendChild(notesEl);
                cell.appendChild(valueEl);
                cell.addEventListener("click", () => this.selectCell(r, c));
                this.boardEl.appendChild(cell);
                row.push(cell);
                valueRow.push(valueEl);
                notesRow.push(noteSpanRow);
            }
            this.cells.push(row);
            this.valueEls.push(valueRow);
            this.noteSpans.push(notesRow);
        }
    }

    bindEvents() {
        window.addEventListener("keydown", (e) => {
            if (!this.isActiveScreen()) return;

            if (e.key === "n" || e.key === "N") {
                this.toggleNoteMode();
                e.preventDefault();
                return;
            }

            if (e.key >= "1" && e.key <= "9") {
                this.inputNumber(parseInt(e.key, 10));
                e.preventDefault();
                return;
            }

            if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
                this.clearSelected();
                e.preventDefault();
                return;
            }

            if (e.key.startsWith("Arrow")) {
                const delta = {
                    ArrowUp: [-1, 0],
                    ArrowDown: [1, 0],
                    ArrowLeft: [0, -1],
                    ArrowRight: [0, 1],
                }[e.key];
                if (delta) {
                    this.moveSelection(delta[0], delta[1]);
                    e.preventDefault();
                }
            }
        });

        this.padButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const value = parseInt(btn.dataset.value || "0", 10);
                if (value === 0) {
                    this.clearSelected();
                } else {
                    this.inputNumber(value);
                }
            });
        });

        this.modeButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const mode = btn.dataset.mode;
                if (!mode || mode === this.mode) return;
                const previousMode = this.mode;
                this.mode = mode;
                this.updateModeUI();
                this.startNewGame(previousMode);
            });
        });

        this.difficultyButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const difficulty = btn.dataset.difficulty;
                if (!difficulty || difficulty === this.difficulty) return;
                this.difficulty = difficulty;
                this.updateDifficultyUI();
                this.startNewGame(this.mode);
            });
        });

        if (this.newGameBtn) {
            this.newGameBtn.addEventListener("click", () => this.startNewGame());
        }
        if (this.hintBtn) {
            this.hintBtn.addEventListener("click", () => this.giveHint());
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener("click", () => this.clearSelected());
        }
        if (this.noteToggleBtn) {
            this.noteToggleBtn.addEventListener("click", () => this.toggleNoteMode());
        }
        if (this.autoToggleBtn) {
            this.autoToggleBtn.addEventListener("click", () => this.toggleAutoCheck());
        }
        this.limitButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const limit = parseInt(btn.dataset.limit || "0", 10);
                this.setMistakeLimit(Number.isFinite(limit) ? limit : 0);
            });
        });
        if (this.playAgainBtn) {
            this.playAgainBtn.addEventListener("click", () => this.startNewGame());
        }
        if (this.continueBtn) {
            this.continueBtn.addEventListener("click", () => {
                this.overlayEl.classList.remove("visible");
            });
        }
    }

    updateModeUI() {
        this.modeButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.mode === this.mode);
        });
        if (this.modeLabelEl) {
            this.modeLabelEl.textContent = MODE_LABELS[this.mode] || "Classic";
        }
    }

    updateDifficultyUI() {
        this.difficultyButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.difficulty === this.difficulty);
        });
        if (this.difficultyLabelEl) {
            this.difficultyLabelEl.textContent = DIFFICULTY_LABELS[this.difficulty] || "Easy";
        }
    }

    updateNoteModeUI() {
        if (this.noteToggleBtn) {
            this.noteToggleBtn.classList.toggle("active", this.noteMode);
            this.noteToggleBtn.textContent = `Notes: ${this.noteMode ? "On" : "Off"}`;
        }
        this.boardEl.classList.toggle("note-mode", this.noteMode);
    }

    updateAutoCheckUI() {
        if (this.autoToggleBtn) {
            this.autoToggleBtn.classList.toggle("active", this.autoCheck);
            this.autoToggleBtn.textContent = `Auto-check: ${this.autoCheck ? "On" : "Off"}`;
        }
    }

    updateLimitUI() {
        this.limitButtons.forEach((btn) => {
            const limit = parseInt(btn.dataset.limit || "0", 10);
            btn.classList.toggle("active", Number.isFinite(limit) ? limit === this.mistakeLimit : false);
        });
    }

    updateAchievementsUI() {
        if (this.totalSolvesEl) {
            this.totalSolvesEl.textContent = String(this.stats.totalSolved);
        }
        if (this.perfectSolvesEl) {
            this.perfectSolvesEl.textContent = String(this.stats.perfectSolved);
        }
        const classic = this.stats.modeStats.classic;
        const killer = this.stats.modeStats.killer;
        if (this.classicStreakEl) {
            this.classicStreakEl.textContent = String(classic.currentStreak);
        }
        if (this.classicBestStreakEl) {
            this.classicBestStreakEl.textContent = String(classic.bestStreak);
        }
        if (this.killerStreakEl) {
            this.killerStreakEl.textContent = String(killer.currentStreak);
        }
        if (this.killerBestStreakEl) {
            this.killerBestStreakEl.textContent = String(killer.bestStreak);
        }
        if (this.classicAvgEl) {
            if (classic.solved > 0 && Number.isFinite(classic.totalTime)) {
                const avg = Math.round(classic.totalTime / classic.solved);
                this.classicAvgEl.textContent = formatTime(avg);
            } else {
                this.classicAvgEl.textContent = "--";
            }
        }
        if (this.killerAvgEl) {
            if (killer.solved > 0 && Number.isFinite(killer.totalTime)) {
                const avg = Math.round(killer.totalTime / killer.solved);
                this.killerAvgEl.textContent = formatTime(avg);
            } else {
                this.killerAvgEl.textContent = "--";
            }
        }
        if (this.bestTimeEl) {
            this.bestTimeEl.textContent = Number.isFinite(this.stats.bestTime)
                ? formatTime(this.stats.bestTime)
                : "--";
        }
        if (this.classicHardestEl) {
            this.classicHardestEl.textContent = classic.hardestDifficulty
                ? DIFFICULTY_LABELS[classic.hardestDifficulty] || classic.hardestDifficulty
                : "--";
        }
        if (this.killerHardestEl) {
            this.killerHardestEl.textContent = killer.hardestDifficulty
                ? DIFFICULTY_LABELS[killer.hardestDifficulty] || killer.hardestDifficulty
                : "--";
        }
        if (this.bestDetailEl) {
            if (this.stats.bestMode && this.stats.bestDifficulty) {
                const mode = MODE_LABELS[this.stats.bestMode] || this.stats.bestMode;
                const diff = DIFFICULTY_LABELS[this.stats.bestDifficulty] || this.stats.bestDifficulty;
                this.bestDetailEl.textContent = `Best time on ${mode} · ${diff}`;
            } else {
                this.bestDetailEl.textContent = "No record yet";
            }
        }
        if (this.hardestDetailEl) {
            if (this.stats.hardestMode && this.stats.hardestDifficulty) {
                const mode = MODE_LABELS[this.stats.hardestMode] || this.stats.hardestMode;
                const diff = DIFFICULTY_LABELS[this.stats.hardestDifficulty] || this.stats.hardestDifficulty;
                this.hardestDetailEl.textContent = `Highest clear: ${mode} · ${diff}`;
            } else {
                this.hardestDetailEl.textContent = "";
            }
        }
    }

    toggleNoteMode() {
        this.noteMode = !this.noteMode;
        this.updateNoteModeUI();
    }

    toggleAutoCheck() {
        this.autoCheck = !this.autoCheck;
        this.updateAutoCheckUI();
        this.updateHighlights();
        saveSudokuSettings({
            autoCheck: this.autoCheck,
            mistakeLimit: this.mistakeLimit,
        });
    }

    setMistakeLimit(limit) {
        this.mistakeLimit = limit;
        this.updateLimitUI();
        saveSudokuSettings({
            autoCheck: this.autoCheck,
            mistakeLimit: this.mistakeLimit,
        });
    }

    setState(text) {
        if (this.stateEl) {
            this.stateEl.textContent = text;
        }
    }

    startTimer() {
        this.stopTimer();
        this.startTime = Date.now();
        this.timerInterval = window.setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            if (this.timerEl) {
                this.timerEl.textContent = formatTime(elapsed);
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            window.clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    startNewGame(abandonMode = this.mode) {
        if (!this.isSolved && !this.gameOver && this.hasUserProgress()) {
            this.stats.currentStreak = 0;
            const modeStats = this.stats.modeStats[abandonMode] || this.stats.modeStats[this.mode];
            modeStats.currentStreak = 0;
            saveSudokuStats(this.stats);
            this.updateAchievementsUI();
        }
        this.setState("Generating...");
        this.overlayEl.classList.remove("visible");
        this.selected = null;
        this.gameOver = false;
        this.isSolved = false;
        this.mistakes = 0;
        this.hintsUsed = 0;
        if (this.mistakesEl) this.mistakesEl.textContent = "0";
        if (this.hintsEl) this.hintsEl.textContent = "0";
        if (this.timerEl) this.timerEl.textContent = "0:00";
        this.stopTimer();
        this.setOverlayContent("Puzzle Solved", "Need another challenge? Spin up a fresh grid.", "Keep Playing");

        this.boardEl.classList.add("loading");
        window.setTimeout(() => {
            this.generatePuzzle();
            this.boardEl.classList.remove("loading");
            this.setState("Solving");
            this.startTimer();
        }, 30);
    }

    hasUserProgress() {
        for (let r = 0; r < SUDOKU_SIZE; r += 1) {
            for (let c = 0; c < SUDOKU_SIZE; c += 1) {
                if (this.given[r][c]) continue;
                if (this.userGrid[r][c] !== 0) return true;
                const notes = this.notes[r][c];
                if (notes.some((value, index) => index > 0 && value)) return true;
            }
        }
        return false;
    }

    generatePuzzle() {
        const preset = DIFFICULTY_PRESETS[this.difficulty] || DIFFICULTY_PRESETS.easy;
        const clues = preset[this.mode] || preset.classic;

        this.solution = generateSolvedGrid();
        this.puzzle = makePuzzleFromSolution(this.solution, clues);
        this.userGrid = cloneGrid(this.puzzle);
        this.given = createEmptyGrid();
        this.hinted = createEmptyGrid();
        this.notes = createNotesGrid();

        for (let r = 0; r < SUDOKU_SIZE; r += 1) {
            for (let c = 0; c < SUDOKU_SIZE; c += 1) {
                this.given[r][c] = this.puzzle[r][c] !== 0 ? 1 : 0;
                this.hinted[r][c] = 0;
            }
        }

        if (this.mode === "killer") {
            this.cages = generateCages(this.solution);
            this.buildCageMaps();
        } else {
            this.cages = [];
            this.cageMap = createEmptyGrid();
            this.cageEdges = createEmptyGrid();
            this.cageLabels = createEmptyGrid();
        }

        this.applyCages();
        this.renderValues();
        this.updateHighlights();
    }

    buildCageMaps() {
        this.cageMap = createEmptyGrid();
        this.cageLabels = createEmptyGrid();

        this.cages.forEach((cage, index) => {
            let topCell = cage.cells[0];
            cage.cells.forEach((cell) => {
                this.cageMap[cell.r][cell.c] = index + 1;
                if (cell.r < topCell.r || (cell.r === topCell.r && cell.c < topCell.c)) {
                    topCell = cell;
                }
            });
            this.cageLabels[topCell.r][topCell.c] = cage.sum;
        });

        this.cageEdges = createEmptyGrid();
        for (let r = 0; r < SUDOKU_SIZE; r += 1) {
            for (let c = 0; c < SUDOKU_SIZE; c += 1) {
                const id = this.cageMap[r][c];
                this.cageEdges[r][c] = {
                    top: r === 0 || this.cageMap[r - 1][c] !== id,
                    right: c === SUDOKU_SIZE - 1 || this.cageMap[r][c + 1] !== id,
                    bottom: r === SUDOKU_SIZE - 1 || this.cageMap[r + 1][c] !== id,
                    left: c === 0 || this.cageMap[r][c - 1] !== id,
                };
            }
        }
    }

    applyCages() {
        const isKiller = this.mode === "killer";
        this.boardEl.classList.toggle("killer", isKiller);
        for (let r = 0; r < SUDOKU_SIZE; r += 1) {
            for (let c = 0; c < SUDOKU_SIZE; c += 1) {
                const cell = this.cells[r][c];
                cell.classList.remove(
                    "cage-top",
                    "cage-right",
                    "cage-bottom",
                    "cage-left",
                    "has-cage-sum"
                );
                cell.removeAttribute("data-sum");
                if (!isKiller) continue;

                const edges = this.cageEdges[r][c];
                if (edges.top) cell.classList.add("cage-top");
                if (edges.right) cell.classList.add("cage-right");
                if (edges.bottom) cell.classList.add("cage-bottom");
                if (edges.left) cell.classList.add("cage-left");

                const label = this.cageLabels[r][c];
                if (label) {
                    cell.classList.add("has-cage-sum");
                    cell.dataset.sum = String(label);
                }
            }
        }
    }

    renderValues() {
        for (let r = 0; r < SUDOKU_SIZE; r += 1) {
            for (let c = 0; c < SUDOKU_SIZE; c += 1) {
                const cell = this.cells[r][c];
                const value = this.userGrid[r][c];
                const valueEl = this.valueEls[r][c];
                valueEl.textContent = value ? String(value) : "";
                cell.classList.toggle("has-value", value !== 0);
                cell.classList.toggle("given", !!this.given[r][c]);
                cell.classList.toggle("hinted", !!this.hinted[r][c]);

                const notes = this.notes[r][c];
                const noteSpans = this.noteSpans[r][c];
                for (let n = 1; n <= 9; n += 1) {
                    const span = noteSpans[n - 1];
                    const active = value === 0 && !!notes[n];
                    span.classList.toggle("active", active);
                }
            }
        }
    }

    selectCell(r, c) {
        this.selected = { r, c };
        this.updateHighlights();
    }

    moveSelection(dr, dc) {
        if (!this.selected) {
            this.selectCell(0, 0);
            return;
        }
        const nextR = (this.selected.r + dr + SUDOKU_SIZE) % SUDOKU_SIZE;
        const nextC = (this.selected.c + dc + SUDOKU_SIZE) % SUDOKU_SIZE;
        this.selectCell(nextR, nextC);
    }

    clearNotesForCell(r, c) {
        const notes = this.notes[r][c];
        for (let n = 1; n <= 9; n += 1) {
            notes[n] = false;
        }
    }

    clearNotesInPeers(r, c, value) {
        if (!value) return;
        for (let i = 0; i < SUDOKU_SIZE; i += 1) {
            if (i !== c) {
                this.notes[r][i][value] = false;
            }
            if (i !== r) {
                this.notes[i][c][value] = false;
            }
        }

        const startRow = Math.floor(r / SUDOKU_BOX) * SUDOKU_BOX;
        const startCol = Math.floor(c / SUDOKU_BOX) * SUDOKU_BOX;
        for (let rr = 0; rr < SUDOKU_BOX; rr += 1) {
            for (let cc = 0; cc < SUDOKU_BOX; cc += 1) {
                const row = startRow + rr;
                const col = startCol + cc;
                if (row === r && col === c) continue;
                this.notes[row][col][value] = false;
            }
        }
    }

    toggleNote(value) {
        if (!this.selected) return;
        const { r, c } = this.selected;
        if (this.given[r][c]) return;
        if (this.userGrid[r][c] !== 0) return;

        const notes = this.notes[r][c];
        notes[value] = !notes[value];
        this.renderValues();
        this.flashCell(r, c);
        this.updateHighlights();
    }

    inputNumber(value) {
        if (this.gameOver) return;
        if (!this.selected) return;
        const { r, c } = this.selected;
        if (this.given[r][c]) return;

        if (this.noteMode) {
            this.toggleNote(value);
            return;
        }

        const prev = this.userGrid[r][c];
        if (prev === value) return;

        this.userGrid[r][c] = value;
        if (value !== 0) {
            this.clearNotesForCell(r, c);
            this.clearNotesInPeers(r, c, value);
        }
        if (value !== 0 && value !== this.solution[r][c] && this.autoCheck) {
            this.registerMistake();
        }

        this.renderValues();
        this.flashCell(r, c);
        this.updateHighlights();
        this.checkSolved();
    }

    clearSelected() {
        if (this.gameOver) return;
        if (!this.selected) return;
        const { r, c } = this.selected;
        if (this.given[r][c]) return;
        const notes = this.notes[r][c];
        const hasNotes = notes.some((value, index) => index > 0 && value);
        if (this.userGrid[r][c] === 0 && !hasNotes) return;
        this.userGrid[r][c] = 0;
        this.clearNotesForCell(r, c);
        this.renderValues();
        this.updateHighlights();
    }

    giveHint() {
        if (this.gameOver) return;
        const empties = [];
        for (let r = 0; r < SUDOKU_SIZE; r += 1) {
            for (let c = 0; c < SUDOKU_SIZE; c += 1) {
                if (this.userGrid[r][c] === 0) {
                    empties.push({ r, c });
                }
            }
        }
        if (empties.length === 0) return;
        const choice = randomChoice(empties);
        this.userGrid[choice.r][choice.c] = this.solution[choice.r][choice.c];
        this.given[choice.r][choice.c] = 1;
        this.hinted[choice.r][choice.c] = 1;
        this.clearNotesForCell(choice.r, choice.c);
        this.clearNotesInPeers(choice.r, choice.c, this.userGrid[choice.r][choice.c]);
        this.hintsUsed += 1;
        if (this.hintsEl) this.hintsEl.textContent = String(this.hintsUsed);
        this.renderValues();
        this.flashCell(choice.r, choice.c);
        this.updateHighlights();
        this.checkSolved();
    }

    flashCell(r, c) {
        const cell = this.cells[r][c];
        cell.classList.add("pop");
        window.setTimeout(() => cell.classList.remove("pop"), 240);
    }

    setOverlayContent(title, desc, continueLabel) {
        if (this.overlayTitleEl) this.overlayTitleEl.textContent = title;
        if (this.overlayDescEl) this.overlayDescEl.textContent = desc;
        if (this.continueBtn && continueLabel) {
            this.continueBtn.textContent = continueLabel;
        }
    }

    registerMistake() {
        this.mistakes += 1;
        if (this.mistakesEl) this.mistakesEl.textContent = String(this.mistakes);
        if (this.mistakeLimit > 0 && this.mistakes >= this.mistakeLimit) {
            this.gameOver = true;
            this.setState("Out of Mistakes");
            this.stopTimer();
            this.setOverlayContent(
                "Out of Mistakes",
                "Mistake limit reached. Start a new puzzle to try again.",
                "Close"
            );
            this.overlayEl.classList.add("visible");
            this.stats.currentStreak = 0;
            this.stats.modeStats[this.mode].currentStreak = 0;
            saveSudokuStats(this.stats);
            this.updateAchievementsUI();
        }
    }

    recordSolve(elapsedSeconds) {
        this.stats.totalSolved += 1;
        if (this.mistakes === 0) {
            this.stats.perfectSolved += 1;
        }
        this.stats.currentStreak += 1;
        if (this.stats.currentStreak > this.stats.bestStreak) {
            this.stats.bestStreak = this.stats.currentStreak;
        }
        this.stats.totalTime += elapsedSeconds;

        const modeStats = this.stats.modeStats[this.mode];
        modeStats.solved += 1;
        modeStats.currentStreak += 1;
        if (modeStats.currentStreak > modeStats.bestStreak) {
            modeStats.bestStreak = modeStats.currentStreak;
        }
        modeStats.totalTime += elapsedSeconds;

        const bestByMode = this.stats.bestByMode[this.mode];
        if (bestByMode) {
            const currentBest = bestByMode[this.difficulty];
            if (!Number.isFinite(currentBest) || elapsedSeconds < currentBest) {
                bestByMode[this.difficulty] = elapsedSeconds;
            }
        }

        if (!Number.isFinite(this.stats.bestTime) || elapsedSeconds < this.stats.bestTime) {
            this.stats.bestTime = elapsedSeconds;
            this.stats.bestMode = this.mode;
            this.stats.bestDifficulty = this.difficulty;
        }

        const difficultyOrder = ["easy", "medium", "hard", "expert"];
        const currentIndex = difficultyOrder.indexOf(this.difficulty);
        const hardestIndex = difficultyOrder.indexOf(this.stats.hardestDifficulty);
        if (currentIndex > hardestIndex) {
            this.stats.hardestDifficulty = this.difficulty;
            this.stats.hardestMode = this.mode;
        } else if (currentIndex === hardestIndex && currentIndex !== -1) {
            if (this.stats.hardestMode !== "killer" && this.mode === "killer") {
                this.stats.hardestMode = this.mode;
            }
        }

        const modeHardestIndex = difficultyOrder.indexOf(modeStats.hardestDifficulty);
        if (currentIndex > modeHardestIndex) {
            modeStats.hardestDifficulty = this.difficulty;
        }

        saveSudokuStats(this.stats);
        this.updateAchievementsUI();
    }

    computeCageIssues() {
        const issues = new Set();
        if (this.mode !== "killer") return issues;

        this.cages.forEach((cage, index) => {
            let sum = 0;
            let empty = 0;
            const seen = new Set();
            let hasDup = false;

            cage.cells.forEach((cell) => {
                const value = this.userGrid[cell.r][cell.c];
                if (value === 0) {
                    empty += 1;
                    return;
                }
                sum += value;
                if (seen.has(value)) {
                    hasDup = true;
                }
                seen.add(value);
            });

            if (sum > cage.sum) {
                issues.add(index + 1);
            } else if (empty === 0 && sum !== cage.sum) {
                issues.add(index + 1);
            } else if (hasDup) {
                issues.add(index + 1);
            }
        });

        return issues;
    }

    updateHighlights() {
        const selected = this.selected;
        const selectedValue = selected ? this.userGrid[selected.r][selected.c] : 0;
        const showErrors = this.autoCheck;
        const cageIssues = showErrors ? this.computeCageIssues() : new Set();

        for (let r = 0; r < SUDOKU_SIZE; r += 1) {
            for (let c = 0; c < SUDOKU_SIZE; c += 1) {
                const cell = this.cells[r][c];
                const value = this.userGrid[r][c];
                const isSelected = !!selected && r === selected.r && c === selected.c;
                const isPeer =
                    !!selected &&
                    !isSelected &&
                    (r === selected.r ||
                        c === selected.c ||
                        (Math.floor(r / SUDOKU_BOX) === Math.floor(selected.r / SUDOKU_BOX) &&
                            Math.floor(c / SUDOKU_BOX) === Math.floor(selected.c / SUDOKU_BOX)));

                const sameValue =
                    !!selected && !isSelected && selectedValue !== 0 && value === selectedValue;

                cell.classList.toggle("selected", isSelected);
                cell.classList.toggle("peer", isPeer);
                cell.classList.toggle("same-value", sameValue);

                const isWrong = showErrors && value !== 0 && value !== this.solution[r][c];
                cell.classList.toggle("error", isWrong);

                if (this.mode === "killer" && selected) {
                    const sameCage =
                        this.cageMap[r][c] === this.cageMap[selected.r][selected.c] &&
                        !isSelected;
                    cell.classList.toggle("cage-peer", sameCage);
                } else {
                    cell.classList.remove("cage-peer");
                }

                if (this.mode === "killer") {
                    const cageId = this.cageMap[r][c];
                    cell.classList.toggle("cage-error", showErrors && cageIssues.has(cageId));
                } else {
                    cell.classList.remove("cage-error");
                }
            }
        }
    }

    checkSolved() {
        if (this.isSolved) return;
        for (let r = 0; r < SUDOKU_SIZE; r += 1) {
            for (let c = 0; c < SUDOKU_SIZE; c += 1) {
                if (this.userGrid[r][c] !== this.solution[r][c]) {
                    return;
                }
            }
        }
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        this.isSolved = true;
        this.setState("Solved");
        this.setOverlayContent(
            "Puzzle Solved",
            `Solved in ${formatTime(elapsed)}.`,
            "Keep Playing"
        );
        this.overlayEl.classList.add("visible");
        this.stopTimer();
        this.recordSolve(elapsed);
    }
}

function initSudokuGame() {
    const board = document.getElementById("sudoku-board");
    if (!board) return;
    if (window.__sudokuGameInstance) return;
    window.__sudokuGameInstance = new SudokuGame();
}
