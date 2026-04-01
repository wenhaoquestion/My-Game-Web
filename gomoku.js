// ================= Neon Gomoku =================
// Five-in-a-row (Standard Gomoku) — exactly 5 in a row wins

(function () {
    "use strict";

    // ─── Constants ────────────────────────────────────────────────────────────
    const BOARD_SIZE   = 15;
    const CANVAS_SIZE  = 600;
    const PADDING      = 30;                          // margin from canvas edge to first line
    const CELL         = (CANVAS_SIZE - PADDING * 2) / (BOARD_SIZE - 1); // px between lines
    const STONE_R      = CELL * 0.42;

    const BLACK = 1;
    const WHITE = 2;

    // Neon palette
    const COLOR = {
        bg:           "#0d0d1a",
        gridLine:     "#2a3a5c",
        gridGlow:     "#1a2a4a",
        starPoint:    "#3a5a8c",
        hoverBlack:   "rgba(60,80,120,0.55)",
        hoverWhite:   "rgba(220,220,255,0.45)",
        blackStone:   "#1a1a2e",
        blackGlow:    "#5577ff",
        whiteStone:   "#e8eaf6",
        whiteGlow:    "#ff88ff",
        winLine:      "#ffee44",
        winGlow:      "#ffbb00",
        coordText:    "#334466",
    };

    // Star points on 15×15 board (0-indexed)
    const STAR_POINTS = [
        [3,3],[3,7],[3,11],
        [7,3],[7,7],[7,11],
        [11,3],[11,7],[11,11],
    ];

    // ─── AI scoring tables ────────────────────────────────────────────────────
    // Pattern scores for sequences of same-color stones in a line of 6 cells
    // We use a simplified threat-based evaluator.

    const SCORE = {
        FIVE:        1_000_000,
        OPEN_FOUR:     50_000,
        HALF_FOUR:      5_000,
        OPEN_THREE:     3_000,
        HALF_THREE:       500,
        OPEN_TWO:         100,
        HALF_TWO:          20,
        ONE:                2,
    };

    // ─── State ────────────────────────────────────────────────────────────────
    let canvas, ctx;
    let board;          // BOARD_SIZE×BOARD_SIZE, 0=empty, 1=black, 2=white
    let currentPlayer;
    let gameOver;
    let winnerStones;   // array of {r,c} for the winning 5
    let moveHistory;    // [{r,c,player}]
    let blackWins, whiteWins;
    let mode;           // "pvp" | "pve"
    let difficulty;     // "easy" | "medium" | "hard"
    let hoverCell;      // {r,c} | null
    let aiThinking;

    // Move timer
    let moveStartTime;
    let timerInterval;

    // DOM refs
    let overlayEl, overlayTitleEl, overlayDescEl, overlayPrimaryEl;
    let statusEl, blackWinsEl, whiteWinsEl;
    let modeSelectEl, diffSelectEl, newGameBtnEl, undoBtnEl, moveCountEl;

    // ─── Init ─────────────────────────────────────────────────────────────────
    window.initGomokuGame = function () {
        canvas          = document.getElementById("gomoku-canvas");
        ctx             = canvas.getContext("2d");
        overlayEl       = document.getElementById("gomoku-overlay");
        overlayTitleEl  = document.getElementById("gomoku-overlay-title");
        overlayDescEl   = document.getElementById("gomoku-overlay-desc");
        overlayPrimaryEl= document.getElementById("gomoku-overlay-primary");
        statusEl        = document.getElementById("gomoku-status");
        blackWinsEl     = document.getElementById("gomoku-black-wins");
        whiteWinsEl     = document.getElementById("gomoku-white-wins");
        modeSelectEl    = document.getElementById("gomoku-mode-select");
        diffSelectEl    = document.getElementById("gomoku-difficulty-select");
        newGameBtnEl    = document.getElementById("gomoku-newgame-btn");
        undoBtnEl       = document.getElementById("gomoku-undo-btn");
        moveCountEl     = document.getElementById("gomoku-move-count");

        blackWins = 0;
        whiteWins = 0;
        updateWinsUI();

        // Events
        canvas.addEventListener("mousemove", onMouseMove);
        canvas.addEventListener("mouseleave", onMouseLeave);
        canvas.addEventListener("click", onCanvasClick);

        if (newGameBtnEl) newGameBtnEl.addEventListener("click", startNewGame);
        if (undoBtnEl)    undoBtnEl.addEventListener("click", undoMove);
        if (overlayPrimaryEl) overlayPrimaryEl.addEventListener("click", startNewGame);
        if (modeSelectEl) modeSelectEl.addEventListener("change", startNewGame);
        if (diffSelectEl) diffSelectEl.addEventListener("change", startNewGame);

        showWelcomeOverlay();
        startNewGame();
    };

    // ─── Game lifecycle ───────────────────────────────────────────────────────
    function startNewGame() {
        mode       = modeSelectEl ? modeSelectEl.value : "pvp";
        difficulty = diffSelectEl ? diffSelectEl.value : "hard";

        board         = Array.from({ length: BOARD_SIZE }, () => new Array(BOARD_SIZE).fill(0));
        currentPlayer = BLACK;
        gameOver      = false;
        winnerStones  = null;
        moveHistory   = [];
        hoverCell     = null;
        aiThinking    = false;

        hideOverlay();
        updateStatusUI();
        updateMoveCountUI();
        resetMoveTimer();
        startMoveTimer();
        renderBoard();
    }

    function showWelcomeOverlay() {
        showOverlay("Neon Gomoku", "Five in a row wins. Black goes first.", "Start Game");
    }

    function showOverlay(title, desc, btnText) {
        if (overlayTitleEl)   overlayTitleEl.textContent = title;
        if (overlayDescEl)    overlayDescEl.textContent  = desc;
        if (overlayPrimaryEl) overlayPrimaryEl.textContent = btnText;
        if (overlayEl)        overlayEl.classList.add("visible");
    }

    function hideOverlay() {
        if (overlayEl) overlayEl.classList.remove("visible");
    }

    // ─── Move handling ────────────────────────────────────────────────────────
    function onCanvasClick(e) {
        if (gameOver || aiThinking) return;
        if (mode === "pve" && currentPlayer === WHITE) return; // AI's turn

        const cell = eventToCell(e);
        if (!cell) return;
        placeStone(cell.r, cell.c);
    }

    function onMouseMove(e) {
        if (gameOver || aiThinking) return;
        if (mode === "pve" && currentPlayer === WHITE) {
            hoverCell = null;
            renderBoard();
            return;
        }
        const cell = eventToCell(e);
        if (!cell) {
            hoverCell = null;
        } else if (board[cell.r][cell.c] === 0) {
            hoverCell = cell;
        } else {
            hoverCell = null;
        }
        renderBoard();
    }

    function onMouseLeave() {
        hoverCell = null;
        renderBoard();
    }

    function eventToCell(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top)  * scaleY;
        const col = Math.round((x - PADDING) / CELL);
        const row = Math.round((y - PADDING) / CELL);
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
        // Only accept click if cursor is within half a cell of the intersection
        const cx = PADDING + col * CELL;
        const cy = PADDING + row * CELL;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > CELL * 0.5) return null;
        return { r: row, c: col };
    }

    function placeStone(r, c) {
        if (board[r][c] !== 0 || gameOver) return;

        board[r][c] = currentPlayer;
        moveHistory.push({ r, c, player: currentPlayer });
        hoverCell = null;

        const winner = checkWin(r, c, currentPlayer);
        if (winner) {
            winnerStones = winner;
            gameOver     = true;
            stopMoveTimer();
            const winnerName = currentPlayer === BLACK ? "Black" : "White";
            if (currentPlayer === BLACK) blackWins++;
            else whiteWins++;
            updateWinsUI();
            updateMoveCountUI();
            renderBoard();
            setTimeout(() => {
                showOverlay(
                    `${winnerName} Wins!`,
                    `Five in a row achieved in ${moveHistory.length} moves.`,
                    "Play Again"
                );
            }, 400);
            return;
        }

        if (isBoardFull()) {
            gameOver = true;
            stopMoveTimer();
            updateMoveCountUI();
            renderBoard();
            setTimeout(() => {
                showOverlay("Draw!", "The board is full. No winner.", "Play Again");
            }, 300);
            return;
        }

        currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
        updateStatusUI();
        updateMoveCountUI();
        resetMoveTimer();
        startMoveTimer();
        renderBoard();

        if (mode === "pve" && currentPlayer === WHITE && !gameOver) {
            scheduleAiMove();
        }
    }

    function isBoardFull() {
        for (let r = 0; r < BOARD_SIZE; r++)
            for (let c = 0; c < BOARD_SIZE; c++)
                if (board[r][c] === 0) return false;
        return true;
    }

    function undoMove() {
        if (gameOver || moveHistory.length === 0) return;

        // In PvP: undo one move. In PvE: undo two (player + AI).
        const undoCount = (mode === "pve" && moveHistory.length >= 2) ? 2 : 1;
        for (let i = 0; i < undoCount; i++) {
            if (moveHistory.length === 0) break;
            const last = moveHistory.pop();
            board[last.r][last.c] = 0;
        }

        // Restore current player
        currentPlayer = moveHistory.length === 0 ? BLACK
            : (moveHistory[moveHistory.length - 1].player === BLACK ? WHITE : BLACK);

        hoverCell = null;
        updateStatusUI();
        updateMoveCountUI();
        resetMoveTimer();
        startMoveTimer();
        renderBoard();
    }

    // ─── Win detection ────────────────────────────────────────────────────────
    const DIRS = [[0,1],[1,0],[1,1],[1,-1]]; // right, down, down-right, down-left

    function checkWin(r, c, player) {
        for (const [dr, dc] of DIRS) {
            const line = getLine(r, c, dr, dc, player);
            // Standard Gomoku: exactly 5 (or more) — we highlight exactly the first 5 found
            if (line.length >= 5) return line.slice(0, 5);
        }
        return null;
    }

    function getLine(r, c, dr, dc, player) {
        const cells = [{ r, c }];
        // Forward
        for (let i = 1; i < 5; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (inBounds(nr, nc) && board[nr][nc] === player) cells.push({ r: nr, c: nc });
            else break;
        }
        // Backward
        for (let i = 1; i < 5; i++) {
            const nr = r - dr * i, nc = c - dc * i;
            if (inBounds(nr, nc) && board[nr][nc] === player) cells.unshift({ r: nr, c: nc });
            else break;
        }
        return cells;
    }

    function inBounds(r, c) {
        return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
    }

    // ─── AI ───────────────────────────────────────────────────────────────────
    function scheduleAiMove() {
        aiThinking = true;
        updateStatusUI();
        // Small delay so the UI repaints first
        setTimeout(() => {
            const move = getAiMove();
            aiThinking = false;
            if (move) placeStone(move.r, move.c);
        }, 60);
    }

    function getAiMove() {
        if (difficulty === "easy") return randomMove();
        const depth = difficulty === "medium" ? 2 : 4;
        return minimaxBestMove(depth);
    }

    function randomMove() {
        const empty = [];
        for (let r = 0; r < BOARD_SIZE; r++)
            for (let c = 0; c < BOARD_SIZE; c++)
                if (board[r][c] === 0) empty.push({ r, c });
        if (empty.length === 0) return null;
        return empty[Math.floor(Math.random() * empty.length)];
    }

    // ── Minimax with alpha-beta ──────────────────────────────────────────────
    function minimaxBestMove(depth) {
        const candidates = getCandidates();
        if (candidates.length === 0) {
            // First move: play center
            return { r: 7, c: 7 };
        }

        let bestScore = -Infinity;
        let bestMove  = candidates[0];

        // AI is WHITE (maximizing). Place WHITE, then let BLACK (minimizer) respond.
        for (const { r, c } of candidates) {
            board[r][c] = WHITE;
            const score = minimax(depth - 1, -Infinity, Infinity, false, r, c, WHITE);
            board[r][c] = 0;
            if (score > bestScore) {
                bestScore = score;
                bestMove  = { r, c };
            }
        }
        return bestMove;
    }

    // isMaximizing: true = WHITE's turn next, false = BLACK's turn next
    // lastR/lastC/lastPlayer: the move just made
    function minimax(depth, alpha, beta, isMaximizing, lastR, lastC, lastPlayer) {
        // Check if the previous move was a win
        if (checkWinFast(lastR, lastC, lastPlayer)) {
            return lastPlayer === WHITE ? SCORE.FIVE : -SCORE.FIVE;
        }
        if (depth === 0 || isBoardFull()) {
            return evaluateBoard();
        }

        const candidates = getCandidates();
        if (candidates.length === 0) return 0;

        if (isMaximizing) {
            // WHITE's turn
            let maxScore = -Infinity;
            for (const { r, c } of candidates) {
                board[r][c] = WHITE;
                const score = minimax(depth - 1, alpha, beta, false, r, c, WHITE);
                board[r][c] = 0;
                if (score > maxScore) maxScore = score;
                if (maxScore > alpha) alpha = maxScore;
                if (beta <= alpha) break;
            }
            return maxScore;
        } else {
            // BLACK's turn
            let minScore = Infinity;
            for (const { r, c } of candidates) {
                board[r][c] = BLACK;
                const score = minimax(depth - 1, alpha, beta, true, r, c, BLACK);
                board[r][c] = 0;
                if (score < minScore) minScore = score;
                if (minScore < beta) beta = minScore;
                if (beta <= alpha) break;
            }
            return minScore;
        }
    }

    // Fast win check (no cell list construction)
    function checkWinFast(r, c, player) {
        for (const [dr, dc] of DIRS) {
            let count = 1;
            for (let i = 1; i < 5; i++) {
                const nr = r + dr * i, nc = c + dc * i;
                if (inBounds(nr, nc) && board[nr][nc] === player) count++; else break;
            }
            for (let i = 1; i < 5; i++) {
                const nr = r - dr * i, nc = c - dc * i;
                if (inBounds(nr, nc) && board[nr][nc] === player) count++; else break;
            }
            if (count >= 5) return true;
        }
        return false;
    }

    // Candidate cells: all empty cells adjacent (within 2) to any existing stone
    function getCandidates() {
        const visited = new Set();
        const result  = [];
        let hasStone  = false;

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] !== 0) {
                    hasStone = true;
                    for (let dr = -2; dr <= 2; dr++) {
                        for (let dc = -2; dc <= 2; dc++) {
                            const nr = r + dr, nc = c + dc;
                            if (inBounds(nr, nc) && board[nr][nc] === 0) {
                                const key = nr * BOARD_SIZE + nc;
                                if (!visited.has(key)) {
                                    visited.add(key);
                                    result.push({ r: nr, c: nc });
                                }
                            }
                        }
                    }
                }
            }
        }

        if (!hasStone) result.push({ r: 7, c: 7 });

        // Sort candidates by proximity to center (heuristic ordering)
        result.sort((a, b) => {
            const da = Math.abs(a.r - 7) + Math.abs(a.c - 7);
            const db = Math.abs(b.r - 7) + Math.abs(b.c - 7);
            return da - db;
        });

        return result.slice(0, 20); // limit for performance
    }

    // ── Board evaluation ──────────────────────────────────────────────────────
    function evaluateBoard() {
        return scoreAllLines(WHITE) - scoreAllLines(BLACK) * 1.1;
    }

    function scoreAllLines(player) {
        let total = 0;
        const dirs = [[0,1],[1,0],[1,1],[1,-1]];

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                for (const [dr, dc] of dirs) {
                    // Only score from "start" of each line to avoid double counting
                    const pr = r - dr, pc = c - dc;
                    if (inBounds(pr, pc) && board[pr][pc] === player) continue;
                    // Count consecutive
                    let count = 0, openEnds = 0;
                    let rr = r, cc = c;
                    while (inBounds(rr, cc) && board[rr][cc] === player) {
                        count++;
                        rr += dr;
                        cc += dc;
                    }
                    if (count === 0) continue;
                    // Check open ends
                    const beforeR = r - dr, beforeC = c - dc;
                    if (!inBounds(beforeR, beforeC) || board[beforeR][beforeC] === 0) openEnds++;
                    if (!inBounds(rr, cc) || board[rr][cc] === 0) openEnds++;

                    total += lineScore(count, openEnds);
                }
            }
        }
        return total;
    }

    function lineScore(count, openEnds) {
        if (count >= 5)  return SCORE.FIVE;
        if (openEnds === 0) return 0;
        if (count === 4) return openEnds === 2 ? SCORE.OPEN_FOUR  : SCORE.HALF_FOUR;
        if (count === 3) return openEnds === 2 ? SCORE.OPEN_THREE : SCORE.HALF_THREE;
        if (count === 2) return openEnds === 2 ? SCORE.OPEN_TWO   : SCORE.HALF_TWO;
        return SCORE.ONE;
    }

    // ─── Timer ────────────────────────────────────────────────────────────────
    function resetMoveTimer() {
        moveStartTime = Date.now();
    }

    function startMoveTimer() {
        stopMoveTimer();
        timerInterval = setInterval(() => {
            if (!gameOver && !aiThinking) {
                updateStatusUI();
            }
        }, 1000);
    }

    function stopMoveTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function elapsedSeconds() {
        return Math.floor((Date.now() - moveStartTime) / 1000);
    }

    // ─── UI helpers ───────────────────────────────────────────────────────────
    function updateStatusUI() {
        if (!statusEl) return;
        if (gameOver) {
            statusEl.textContent = "Game Over";
            return;
        }
        if (aiThinking) {
            statusEl.textContent = "AI is thinking…";
            return;
        }
        const name = currentPlayer === BLACK ? "Black" : "White";
        const elapsed = elapsedSeconds();
        statusEl.textContent = `${name}'s Turn  ⏱ ${elapsed}s`;
    }

    function updateWinsUI() {
        if (blackWinsEl) blackWinsEl.textContent = blackWins;
        if (whiteWinsEl) whiteWinsEl.textContent = whiteWins;
    }

    function updateMoveCountUI() {
        if (moveCountEl) moveCountEl.textContent = moveHistory.length;
    }

    // ─── Rendering ────────────────────────────────────────────────────────────
    function renderBoard() {
        const W = canvas.width;
        const H = canvas.height;

        // Background
        const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.72);
        grad.addColorStop(0, "#141428");
        grad.addColorStop(1, "#080812");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        drawGrid();
        drawStarPoints();
        drawCoords();
        drawHover();
        drawStones();
        drawWinLine();
    }

    function cellToXY(r, c) {
        return { x: PADDING + c * CELL, y: PADDING + r * CELL };
    }

    function drawGrid() {
        ctx.save();
        ctx.strokeStyle = COLOR.gridLine;
        ctx.lineWidth   = 1;
        ctx.shadowColor  = COLOR.gridGlow;
        ctx.shadowBlur   = 4;

        for (let i = 0; i < BOARD_SIZE; i++) {
            const x = PADDING + i * CELL;
            const y = PADDING + i * CELL;

            // Vertical
            ctx.beginPath();
            ctx.moveTo(x, PADDING);
            ctx.lineTo(x, PADDING + (BOARD_SIZE - 1) * CELL);
            ctx.stroke();

            // Horizontal
            ctx.beginPath();
            ctx.moveTo(PADDING, y);
            ctx.lineTo(PADDING + (BOARD_SIZE - 1) * CELL, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawStarPoints() {
        ctx.save();
        ctx.fillStyle  = COLOR.starPoint;
        ctx.shadowColor = "#5588cc";
        ctx.shadowBlur  = 8;
        for (const [r, c] of STAR_POINTS) {
            const { x, y } = cellToXY(r, c);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawCoords() {
        ctx.save();
        ctx.fillStyle  = COLOR.coordText;
        ctx.font       = "11px monospace";
        ctx.textAlign  = "center";
        ctx.textBaseline = "middle";
        const letters = "ABCDEFGHJKLMNOP"; // skip I like in Go
        for (let i = 0; i < BOARD_SIZE; i++) {
            const x = PADDING + i * CELL;
            const y = PADDING + i * CELL;
            ctx.fillText(letters[i],  x, PADDING - 16);
            ctx.fillText(String(i+1), PADDING - 16, y);
        }
        ctx.restore();
    }

    function drawHover() {
        if (!hoverCell) return;
        const { x, y } = cellToXY(hoverCell.r, hoverCell.c);
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(x, y, STONE_R, 0, Math.PI * 2);

        if (currentPlayer === BLACK) {
            ctx.fillStyle   = COLOR.hoverBlack;
            ctx.shadowColor = COLOR.blackGlow;
        } else {
            ctx.fillStyle   = COLOR.hoverWhite;
            ctx.shadowColor = COLOR.whiteGlow;
        }
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.restore();
    }

    function drawStones() {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] !== 0) {
                    drawStone(r, c, board[r][c]);
                }
            }
        }
    }

    function drawStone(r, c, player) {
        const { x, y } = cellToXY(r, c);

        ctx.save();

        if (player === BLACK) {
            // Glow pass
            ctx.shadowColor = COLOR.blackGlow;
            ctx.shadowBlur  = 18;
            // Radial gradient for 3D look
            const g = ctx.createRadialGradient(x - STONE_R * 0.3, y - STONE_R * 0.3, STONE_R * 0.05,
                                               x, y, STONE_R);
            g.addColorStop(0, "#3a3a60");
            g.addColorStop(0.6, "#111122");
            g.addColorStop(1, "#050508");
            ctx.fillStyle = g;
        } else {
            ctx.shadowColor = COLOR.whiteGlow;
            ctx.shadowBlur  = 18;
            const g = ctx.createRadialGradient(x - STONE_R * 0.3, y - STONE_R * 0.3, STONE_R * 0.05,
                                               x, y, STONE_R);
            g.addColorStop(0, "#ffffff");
            g.addColorStop(0.5, "#d0d8f8");
            g.addColorStop(1, "#9090c0");
            ctx.fillStyle = g;
        }

        ctx.beginPath();
        ctx.arc(x, y, STONE_R, 0, Math.PI * 2);
        ctx.fill();

        // Highlight the last placed stone
        const last = moveHistory[moveHistory.length - 1];
        if (last && last.r === r && last.c === c) {
            ctx.beginPath();
            ctx.arc(x, y, STONE_R * 0.28, 0, Math.PI * 2);
            ctx.fillStyle = player === BLACK ? "rgba(120,180,255,0.7)" : "rgba(80,80,160,0.5)";
            ctx.shadowBlur = 0;
            ctx.fill();
        }

        ctx.restore();
    }

    function drawWinLine() {
        if (!winnerStones || winnerStones.length === 0) return;

        // Glow the winning stones
        for (const { r, c } of winnerStones) {
            const { x, y } = cellToXY(r, c);
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, STONE_R * 1.18, 0, Math.PI * 2);
            ctx.strokeStyle = COLOR.winLine;
            ctx.lineWidth   = 2.5;
            ctx.shadowColor = COLOR.winGlow;
            ctx.shadowBlur  = 24;
            ctx.stroke();
            ctx.restore();
        }

        // Draw a line through all 5
        const first = winnerStones[0];
        const last  = winnerStones[winnerStones.length - 1];
        const p1    = cellToXY(first.r, first.c);
        const p2    = cellToXY(last.r,  last.c);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = COLOR.winLine;
        ctx.lineWidth   = 3;
        ctx.shadowColor = COLOR.winGlow;
        ctx.shadowBlur  = 20;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.restore();
    }

})(); // end IIFE
