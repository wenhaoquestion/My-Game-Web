// ====== main.js：全局切换函数 + 初始化 ======

function showScreen(idToShow) {
    const screens = document.querySelectorAll(".screen");
    screens.forEach((el) => {
        if (el.id === idToShow) {
            el.classList.add("active");
        } else {
            el.classList.remove("active");
        }
    });
}

// 这三个函数会被 HTML 的 onclick 直接调用
function switchToMenu() {
    console.log("[main.js] switchToMenu");
    showScreen("menu-screen");
}

function switchToSnake() {
    console.log("[main.js] switchToSnake");
    showScreen("snake-screen");

    // 首次进入再初始化 Snake，避免重复 new
    if (typeof initSnakeGame === "function" && !window.__snakeGameInitialized) {
        initSnakeGame();
        window.__snakeGameInitialized = true;
    }
}

function switchTo2048() {
    console.log("[main.js] switchTo2048");
    showScreen("game2048-screen");

    if (typeof init2048Game === "function" && !window.__game2048Initialized) {
        init2048Game();
        window.__game2048Initialized = true;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("[main.js] DOM ready");
    // 默认显示大厅
    showScreen("menu-screen");
});
