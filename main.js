// main.js 负责：
// 1. 统一切换三个 screen（menu / snake / 2048）
// 2. 首次进入某个游戏时调用 initSnakeGame / init2048Game
// 3. 加一点过渡动画（配合 CSS 的 .screen /.screen.active）

function showScreen(idToShow) {
    const screens = document.querySelectorAll(".screen");
    screens.forEach((el) => {
        if (el.id === idToShow) {
            el.classList.add("active");
        } else {
            el.classList.remove("active");
        }
    });

    const gameMap = {
        "menu-screen": "menu",
        "snake-screen": "snake",
        "game2048-screen": "2048",
        "coin-screen": "coin",
        "tetris-screen": "tetris",
        "sudoku-screen": "sudoku",
    };
    document.body.dataset.game = gameMap[idToShow] || "menu";
}

const THEME_KEY = "arcade_theme";
const AMBIENT_KEY = "arcade_ambient";

function applyTheme(theme) {
    const themeName = theme || "nebula";
    document.body.dataset.theme = themeName;
    localStorage.setItem(THEME_KEY, themeName);
}

function applyAmbient(isOn) {
    const state = isOn ? "on" : "off";
    document.body.dataset.ambient = state;
    localStorage.setItem(AMBIENT_KEY, state);
}

function showSudokuLoadError() {
    const overlay = document.getElementById("sudoku-overlay");
    const titleEl = document.getElementById("sudoku-overlay-title");
    const descEl = document.getElementById("sudoku-overlay-desc");
    if (titleEl) titleEl.textContent = "Sudoku Failed to Load";
    if (descEl) {
        descEl.textContent =
            "Sudoku script was not loaded. Check GitHub Pages source path and ensure sudoku.js is published.";
    }
    if (overlay) {
        overlay.classList.add("visible");
    }
}

function switchToSnake() {
    console.log("[main.js] Play Snake clicked");
    showScreen("snake-screen");

    if (!window.__snakeGameInitialized) {
        if (typeof initSnakeGame === "function") {
            initSnakeGame();              // 在 snake.js 里定义
            window.__snakeGameInitialized = true;
        } else {
            console.error("initSnakeGame is not defined. Check snake.js.");
        }
    }
}

function switchTo2048() {
    console.log("[main.js] Play 2048 clicked");
    showScreen("game2048-screen");

    if (!window.__game2048Initialized) {
        if (typeof init2048Game === "function") {
            init2048Game();              // 在 2048.js 里定义
            window.__game2048Initialized = true;
        } else {
            console.error("init2048Game is not defined. Check 2048.js.");
        }
    }
}

function switchToCoin() {
    console.log("[main.js] Play Coin Toss clicked");
    showScreen("coin-screen");

    if (!window.__coinGameInitialized) {
        if (typeof initCoinGame === "function") {
            initCoinGame();
            window.__coinGameInitialized = true;
        } else {
            console.error("initCoinGame is not defined. Check coin.js.");
        }
    }
}

function switchToTetris() {
    console.log("[main.js] Play Tetris clicked");
    showScreen("tetris-screen");

    if (!window.__tetrisGameInitialized) {
        if (typeof initTetrisGame === "function") {
            initTetrisGame();
            window.__tetrisGameInitialized = true;
        } else {
            console.error("initTetrisGame is not defined. Check tetris.js.");
        }
    }
}

function switchToSudoku() {
    console.log("[main.js] Play Sudoku clicked");
    showScreen("sudoku-screen");

    if (!window.__sudokuGameInitialized) {
        if (typeof initSudokuGame === "function") {
            try {
                initSudokuGame();
            } catch (err) {
                console.error("[main.js] initSudokuGame failed", err);
                showSudokuLoadError();
                return;
            }
            window.__sudokuGameInitialized = true;
        } else {
            console.error("initSudokuGame is not defined. Check sudoku.js.");
            showSudokuLoadError();
        }
    }
}

function switchToMenu() {
    console.log("[main.js] Back to menu");
    showScreen("menu-screen");
}

window.switchToSnake = switchToSnake;
window.switchTo2048 = switchTo2048;
window.switchToCoin = switchToCoin;
window.switchToTetris = switchToTetris;
window.switchToSudoku = switchToSudoku;
window.switchToMenu = switchToMenu;

document.addEventListener("DOMContentLoaded", () => {
    console.log("[main.js] DOM ready");

    const themeSelect = document.getElementById("theme-select");
    const ambientToggleBtn = document.getElementById("ambient-toggle-btn");

    const playSnakeBtn = document.getElementById("play-snake-btn");
    const backSnakeBtn = document.getElementById("back-to-menu-btn");

    const play2048Btn = document.getElementById("play-2048-btn");
    const back2048Btn = document.getElementById("back-to-menu-2048-btn");

    const playCoinBtn = document.getElementById("play-coin-btn");
    const backCoinBtn = document.getElementById("back-to-menu-coin-btn");

    const playSudokuBtn = document.getElementById("play-sudoku-btn");
    const backSudokuBtn = document.getElementById("back-to-menu-sudoku-btn");

    const playTetrisBtn = document.getElementById("play-tetris-btn");
    const backTetrisBtn = document.getElementById("back-to-menu-tetris-btn");

    // 按钮按下小压感效果
    document.querySelectorAll(".game-card .btn").forEach((btn) => {
        btn.addEventListener("mousedown", () => {
            btn.classList.add("pressed");
        });
        btn.addEventListener("mouseup", () => {
            btn.classList.remove("pressed");
        });
        btn.addEventListener("mouseleave", () => {
            btn.classList.remove("pressed");
        });
    });

    // ====== 进入 Snake ======
    if (playSnakeBtn) {
        playSnakeBtn.addEventListener("click", switchToSnake);
    }

    // Snake 返回大厅
    if (backSnakeBtn) {
        backSnakeBtn.addEventListener("click", switchToMenu);
    }

    // ====== 进入 2048 ======
    if (play2048Btn) {
        play2048Btn.addEventListener("click", switchTo2048);
    }

    // 2048 返回大厅
    if (back2048Btn) {
        back2048Btn.addEventListener("click", switchToMenu);
    }

    // ====== 进入 Coin Toss ======
    if (playCoinBtn) {
        playCoinBtn.addEventListener("click", switchToCoin);
    }

    // Coin Toss 返回大厅
    if (backCoinBtn) {
        backCoinBtn.addEventListener("click", switchToMenu);
    }

    // ====== 进入 Sudoku ======
    if (playSudokuBtn) {
        playSudokuBtn.addEventListener("click", switchToSudoku);
    }

    // Sudoku 返回大厅
    if (backSudokuBtn) {
        backSudokuBtn.addEventListener("click", switchToMenu);
    }

    // ====== 进入 Tetris ======
    if (playTetrisBtn) {
        playTetrisBtn.addEventListener("click", switchToTetris);
    }

    // Tetris 返回大厅
    if (backTetrisBtn) {
        backTetrisBtn.addEventListener("click", switchToMenu);
    }

    const storedTheme = localStorage.getItem(THEME_KEY);
    const themeOptions = ["nebula", "solaris", "aqua", "ember", "verdant"];
    const initialTheme = themeOptions.includes(storedTheme) ? storedTheme : "nebula";
    applyTheme(initialTheme);
    if (themeSelect) {
        themeSelect.value = initialTheme;
        themeSelect.addEventListener("change", (e) => {
            applyTheme(e.target.value);
        });
    }

    const storedAmbient = localStorage.getItem(AMBIENT_KEY);
    const ambientOn = storedAmbient !== "off";
    applyAmbient(ambientOn);
    if (ambientToggleBtn) {
        ambientToggleBtn.textContent = `Aura: ${ambientOn ? "On" : "Off"}`;
        ambientToggleBtn.addEventListener("click", () => {
            const isOn = document.body.dataset.ambient !== "on";
            applyAmbient(isOn);
            ambientToggleBtn.textContent = `Aura: ${isOn ? "On" : "Off"}`;
        });
    }

    // 默认显示大厅
    showScreen("menu-screen");
});
