// xiangqi.js — Chinese Chess (象棋) with Cyberpunk Neon Aesthetic
// Red (bottom) vs Black (top). Red always moves first.
// PvE: Player=Red, AI=Black. PvP: both human.

(function () {
    "use strict";

    // ===================== CONSTANTS =====================
    const COLS = 9;
    const ROWS = 10;
    // Board intersection grid: 9 columns x 10 rows
    // Red side: rows 5-9 (bottom), Black side: rows 0-4 (top)
    // Palace Red: cols 3-5, rows 7-9
    // Palace Black: cols 3-5, rows 0-2

    // Piece types
    const GENERAL  = "G";
    const ADVISOR  = "A";
    const ELEPHANT = "E";
    const HORSE    = "H";
    const CHARIOT  = "R";
    const CANNON   = "C";
    const SOLDIER  = "S";

    const RED   = "red";
    const BLACK = "black";

    // Piece display characters
    const PIECE_CHARS = {
        red: {
            [GENERAL]:  "帅",
            [ADVISOR]:  "仕",
            [ELEPHANT]: "相",
            [HORSE]:    "马",
            [CHARIOT]:  "车",
            [CANNON]:   "炮",
            [SOLDIER]:  "兵",
        },
        black: {
            [GENERAL]:  "将",
            [ADVISOR]:  "士",
            [ELEPHANT]: "象",
            [HORSE]:    "馬",
            [CHARIOT]:  "車",
            [CANNON]:   "砲",
            [SOLDIER]:  "卒",
        },
    };

    // Piece base values for AI evaluation
    const PIECE_VALUES = {
        [GENERAL]:  100000,
        [ADVISOR]:  200,
        [ELEPHANT]: 200,
        [HORSE]:    450,
        [CHARIOT]:  900,
        [CANNON]:   450,
        [SOLDIER]:  100,
    };

    // Position bonus tables (red perspective, rows 0=top black, 9=bottom red)
    // Values are small adjustments to encourage good positioning
    const POS_BONUS = {
        [SOLDIER]: [
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [20, 0, 20,  0, 20,  0, 20,  0, 20],
            [30,30, 30, 30, 30, 30, 30, 30, 30],
            [50,50, 50, 50, 50, 50, 50, 50, 50],
            [70,70, 70, 70, 70, 70, 70, 70, 70],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
        ],
        [HORSE]: [
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 0, 5, 5, 5, 5, 5, 5, 5, 0],
            [ 0, 5,10,10,10,10,10, 5, 0],
            [ 0, 5,10,20,20,20,10, 5, 0],
            [ 0, 5,10,20,20,20,10, 5, 0],
            [ 0, 5,10,20,20,20,10, 5, 0],
            [ 0, 5,10,10,10,10,10, 5, 0],
            [ 0, 5, 5, 5, 5, 5, 5, 5, 0],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
        [CANNON]: [
            [ 0, 0, 5, 0, 5, 0, 5, 0, 0],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 5, 0, 5, 0, 5, 0, 5, 0, 5],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 5, 0, 5, 0, 5, 0, 5, 0, 5],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 5, 0, 5, 0, 5, 0, 5, 0, 5],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 5, 0, 5, 0, 5, 0, 5, 0, 5],
            [ 0, 0, 5, 0, 5, 0, 5, 0, 0],
        ],
        [CHARIOT]: [
            [20,20,20,20,20,20,20,20,20],
            [20,20,20,20,20,20,20,20,20],
            [15,15,15,15,15,15,15,15,15],
            [15,15,15,15,15,15,15,15,15],
            [10,10,10,10,10,10,10,10,10],
            [10,10,10,10,10,10,10,10,10],
            [10,10,10,10,10,10,10,10,10],
            [15,15,15,15,15,15,15,15,15],
            [20,20,20,20,20,20,20,20,20],
            [20,20,20,20,20,20,20,20,20],
        ],
    };

    // Canvas layout
    const CANVAS_W = 720;
    const CANVAS_H = 800;
    const MARGIN_X = 60;
    const MARGIN_Y = 55;
    const CELL_SIZE = Math.floor((CANVAS_W - 2 * MARGIN_X) / (COLS - 1)); // ~75
    const BOARD_W = CELL_SIZE * (COLS - 1);
    const BOARD_H = CELL_SIZE * (ROWS - 1);
    const PIECE_R = Math.floor(CELL_SIZE * 0.42);

    // ===================== GAME STATE =====================
    let board = [];           // board[row][col] = {side, type} or null
    let currentTurn = RED;
    let selected = null;      // {row, col}
    let legalMoves = [];      // [{row, col}]
    let gameMode = "pve";     // "pve" or "pvp"
    let aiDifficulty = "medium"; // "easy", "medium", "hard"
    let gameOver = false;
    let winner = null;
    let capturedRed = [];     // black-captured red pieces
    let capturedBlack = [];   // red-captured black pieces
    let aiThinking = false;
    let lastMove = null;      // {fromRow, fromCol, toRow, toCol}
    let checkFlash = false;
    let checkFlashTimer = 0;
    let animFrame = null;

    // ===================== BOARD INIT =====================
    function createInitialBoard() {
        const b = Array.from({length: ROWS}, () => Array(COLS).fill(null));

        // Black pieces (top, rows 0-4)
        b[0][0] = {side: BLACK, type: CHARIOT};
        b[0][1] = {side: BLACK, type: HORSE};
        b[0][2] = {side: BLACK, type: ELEPHANT};
        b[0][3] = {side: BLACK, type: ADVISOR};
        b[0][4] = {side: BLACK, type: GENERAL};
        b[0][5] = {side: BLACK, type: ADVISOR};
        b[0][6] = {side: BLACK, type: ELEPHANT};
        b[0][7] = {side: BLACK, type: HORSE};
        b[0][8] = {side: BLACK, type: CHARIOT};
        b[2][1] = {side: BLACK, type: CANNON};
        b[2][7] = {side: BLACK, type: CANNON};
        for (let c = 0; c < 9; c += 2) b[3][c] = {side: BLACK, type: SOLDIER};

        // Red pieces (bottom, rows 5-9)
        b[9][0] = {side: RED, type: CHARIOT};
        b[9][1] = {side: RED, type: HORSE};
        b[9][2] = {side: RED, type: ELEPHANT};
        b[9][3] = {side: RED, type: ADVISOR};
        b[9][4] = {side: RED, type: GENERAL};
        b[9][5] = {side: RED, type: ADVISOR};
        b[9][6] = {side: RED, type: ELEPHANT};
        b[9][7] = {side: RED, type: HORSE};
        b[9][8] = {side: RED, type: CHARIOT};
        b[7][1] = {side: RED, type: CANNON};
        b[7][7] = {side: RED, type: CANNON};
        for (let c = 0; c < 9; c += 2) b[6][c] = {side: RED, type: SOLDIER};

        return b;
    }

    // Deep copy board
    function cloneBoard(b) {
        return b.map(row => row.map(cell => cell ? {...cell} : null));
    }

    // ===================== COORDINATE HELPERS =====================
    function inBounds(r, c) {
        return r >= 0 && r < ROWS && c >= 0 && c < COLS;
    }

    function inPalace(r, c, side) {
        if (side === RED)   return r >= 7 && r <= 9 && c >= 3 && c <= 5;
        if (side === BLACK) return r >= 0 && r <= 2 && c >= 3 && c <= 5;
        return false;
    }

    function onRedSide(r) { return r >= 5; }
    function onBlackSide(r) { return r <= 4; }

    // ===================== MOVE GENERATION =====================
    function getRawMoves(b, row, col) {
        const piece = b[row][col];
        if (!piece) return [];
        const moves = [];
        const {side, type} = piece;
        const opp = side === RED ? BLACK : RED;

        function addIfFree(r, c) {
            if (!inBounds(r, c)) return;
            if (!b[r][c] || b[r][c].side === opp) moves.push({row: r, col: c});
        }

        switch (type) {
            case GENERAL: {
                const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
                for (const [dr, dc] of dirs) {
                    const nr = row + dr, nc = col + dc;
                    if (inBounds(nr, nc) && inPalace(nr, nc, side)) {
                        if (!b[nr][nc] || b[nr][nc].side === opp) {
                            moves.push({row: nr, col: nc});
                        }
                    }
                }
                break;
            }
            case ADVISOR: {
                const dirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
                for (const [dr, dc] of dirs) {
                    const nr = row + dr, nc = col + dc;
                    if (inBounds(nr, nc) && inPalace(nr, nc, side)) {
                        if (!b[nr][nc] || b[nr][nc].side === opp) {
                            moves.push({row: nr, col: nc});
                        }
                    }
                }
                break;
            }
            case ELEPHANT: {
                // Moves exactly 2 diagonals, can't cross river, blocking at midpoint
                const dirs = [[2,2],[2,-2],[-2,2],[-2,-2]];
                for (const [dr, dc] of dirs) {
                    const nr = row + dr, nc = col + dc;
                    if (!inBounds(nr, nc)) continue;
                    // Can't cross river
                    if (side === RED && !onRedSide(nr)) continue;
                    if (side === BLACK && !onBlackSide(nr)) continue;
                    // Check blocking at midpoint (elephant eye)
                    const mr = row + dr/2, mc = col + dc/2;
                    if (b[mr][mc]) continue; // blocked
                    if (!b[nr][nc] || b[nr][nc].side === opp) {
                        moves.push({row: nr, col: nc});
                    }
                }
                break;
            }
            case HORSE: {
                // Moves 1 orthogonal then 1 diagonal; leg blocking
                const steps = [
                    {leg:[0,1],  ends:[[-1,2],[1,2]]},
                    {leg:[0,-1], ends:[[-1,-2],[1,-2]]},
                    {leg:[1,0],  ends:[[2,-1],[2,1]]},
                    {leg:[-1,0], ends:[[-2,-1],[-2,1]]},
                ];
                for (const {leg, ends} of steps) {
                    const lr = row + leg[0], lc = col + leg[1];
                    if (!inBounds(lr, lc)) continue;
                    if (b[lr][lc]) continue; // leg blocked
                    for (const [dr, dc] of ends) {
                        const nr = row + dr, nc = col + dc;
                        if (!inBounds(nr, nc)) continue;
                        if (!b[nr][nc] || b[nr][nc].side === opp) {
                            moves.push({row: nr, col: nc});
                        }
                    }
                }
                break;
            }
            case CHARIOT: {
                // Slides in 4 directions, stops at first piece (captures if enemy)
                for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                    let r = row + dr, c = col + dc;
                    while (inBounds(r, c)) {
                        if (b[r][c]) {
                            if (b[r][c].side === opp) moves.push({row: r, col: c});
                            break;
                        }
                        moves.push({row: r, col: c});
                        r += dr; c += dc;
                    }
                }
                break;
            }
            case CANNON: {
                // Moves like chariot but captures by jumping exactly one piece
                for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                    let r = row + dr, c = col + dc;
                    let jumped = false;
                    while (inBounds(r, c)) {
                        if (!jumped) {
                            if (b[r][c]) {
                                jumped = true;
                            } else {
                                moves.push({row: r, col: c});
                            }
                        } else {
                            if (b[r][c]) {
                                if (b[r][c].side === opp) moves.push({row: r, col: c});
                                break;
                            }
                        }
                        r += dr; c += dc;
                    }
                }
                break;
            }
            case SOLDIER: {
                // Before crossing river: only forward. After: forward + sideways.
                const fwd = side === RED ? -1 : 1; // red moves up (row decreases), black moves down
                // Forward
                const fr = row + fwd;
                if (inBounds(fr, col)) {
                    if (!b[fr][col] || b[fr][col].side === opp) moves.push({row: fr, col});
                }
                // Sideways only after crossing river
                const crossed = side === RED ? onBlackSide(row) : onRedSide(row);
                if (crossed) {
                    for (const dc of [-1, 1]) {
                        const nc = col + dc;
                        if (inBounds(row, nc)) {
                            if (!b[row][nc] || b[row][nc].side === opp) moves.push({row, col: nc});
                        }
                    }
                }
                break;
            }
        }
        return moves;
    }

    // Find general position for a side
    function findGeneral(b, side) {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (b[r][c] && b[r][c].side === side && b[r][c].type === GENERAL) {
                    return {row: r, col: c};
                }
            }
        }
        return null;
    }

    // Check if a side is in check
    function isInCheck(b, side) {
        const gen = findGeneral(b, side);
        if (!gen) return false;
        const opp = side === RED ? BLACK : RED;

        // Check flying general rule: generals face each other with no pieces in between
        const oppGen = findGeneral(b, opp);
        if (oppGen && oppGen.col === gen.col) {
            const minR = Math.min(gen.row, oppGen.row);
            const maxR = Math.max(gen.row, oppGen.row);
            let clear = true;
            for (let r = minR + 1; r < maxR; r++) {
                if (b[r][gen.col]) { clear = false; break; }
            }
            if (clear) return true;
        }

        // Check if any opponent piece attacks the general
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (b[r][c] && b[r][c].side === opp) {
                    const moves = getRawMoves(b, r, c);
                    if (moves.some(m => m.row === gen.row && m.col === gen.col)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Apply a move to a board copy, return new board
    function applyMove(b, fromRow, fromCol, toRow, toCol) {
        const nb = cloneBoard(b);
        nb[toRow][toCol] = nb[fromRow][fromCol];
        nb[fromRow][fromCol] = null;
        return nb;
    }

    // Get legal moves (filtered for self-check)
    function getLegalMoves(b, row, col) {
        const piece = b[row][col];
        if (!piece) return [];
        const raw = getRawMoves(b, row, col);
        return raw.filter(({row: tr, col: tc}) => {
            const nb = applyMove(b, row, col, tr, tc);
            return !isInCheck(nb, piece.side);
        });
    }

    // Get all legal moves for a side
    function getAllLegalMoves(b, side) {
        const moves = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (b[r][c] && b[r][c].side === side) {
                    const lm = getLegalMoves(b, r, c);
                    for (const m of lm) {
                        moves.push({fromRow: r, fromCol: c, toRow: m.row, toCol: m.col});
                    }
                }
            }
        }
        return moves;
    }

    // Check if side is in checkmate or stalemate
    function hasNoMoves(b, side) {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (b[r][c] && b[r][c].side === side) {
                    if (getLegalMoves(b, r, c).length > 0) return false;
                }
            }
        }
        return true;
    }

    // ===================== AI EVALUATION =====================
    function evaluateBoard(b) {
        // Positive = good for red
        let score = 0;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = b[r][c];
                if (!p) continue;
                const base = PIECE_VALUES[p.type] || 0;
                let pos = 0;
                if (POS_BONUS[p.type]) {
                    // For red, use row as-is (red is bottom). For black, mirror rows.
                    const pr = p.side === RED ? r : (ROWS - 1 - r);
                    pos = POS_BONUS[p.type][pr]?.[c] || 0;
                }
                const val = base + pos;
                score += p.side === RED ? val : -val;
            }
        }
        return score;
    }

    // Quiescence search: resolves captures at leaf nodes to avoid horizon effect
    function quiesce(b, alpha, beta, maximizing) {
        const stand = evaluateBoard(b);
        if (maximizing) {
            if (stand >= beta) return beta;
            if (stand > alpha) alpha = stand;
        } else {
            if (stand <= alpha) return alpha;
            if (stand < beta) beta = stand;
        }

        const side = maximizing ? RED : BLACK;
        // Only captures
        const moves = getAllLegalMoves(b, side).filter(m => b[m.toRow][m.toCol]);

        // MVV-LVA ordering
        moves.sort((a, b2) => {
            const vA = PIECE_VALUES[b[a.toRow][a.toCol]?.type] || 0;
            const vB = PIECE_VALUES[b[b2.toRow][b2.toCol]?.type] || 0;
            return vB - vA;
        });

        if (maximizing) {
            for (const m of moves) {
                const nb = applyMove(b, m.fromRow, m.fromCol, m.toRow, m.toCol);
                const score = quiesce(nb, alpha, beta, false);
                if (score >= beta) return beta;
                if (score > alpha) alpha = score;
            }
            return alpha;
        } else {
            for (const m of moves) {
                const nb = applyMove(b, m.fromRow, m.fromCol, m.toRow, m.toCol);
                const score = quiesce(nb, alpha, beta, true);
                if (score <= alpha) return alpha;
                if (score < beta) beta = score;
            }
            return beta;
        }
    }

    // Minimax with alpha-beta pruning
    // maximizing = RED's turn
    function minimax(b, depth, alpha, beta, maximizing) {
        const side = maximizing ? RED : BLACK;

        if (depth === 0) return quiesce(b, alpha, beta, maximizing);

        // Check terminal states
        if (!findGeneral(b, RED))   return -Infinity;
        if (!findGeneral(b, BLACK)) return  Infinity;

        const moves = getAllLegalMoves(b, side);
        if (moves.length === 0) {
            if (isInCheck(b, side)) {
                return maximizing ? -90000 : 90000;
            }
            return 0; // stalemate
        }

        // MVV-LVA move ordering
        moves.sort((a, b2) => {
            const tA = b[a.toRow][a.toCol];
            const tB = b[b2.toRow][b2.toCol];
            const vA = tA ? (PIECE_VALUES[tA.type] || 0) * 10 - (PIECE_VALUES[b[a.fromRow][a.fromCol]?.type] || 0) : -1;
            const vB = tB ? (PIECE_VALUES[tB.type] || 0) * 10 - (PIECE_VALUES[b[b2.fromRow][b2.fromCol]?.type] || 0) : -1;
            return vB - vA;
        });

        if (maximizing) {
            let best = -Infinity;
            for (const m of moves) {
                const nb = applyMove(b, m.fromRow, m.fromCol, m.toRow, m.toCol);
                const val = minimax(nb, depth - 1, alpha, beta, false);
                best = Math.max(best, val);
                alpha = Math.max(alpha, best);
                if (beta <= alpha) break;
            }
            return best;
        } else {
            let best = Infinity;
            for (const m of moves) {
                const nb = applyMove(b, m.fromRow, m.fromCol, m.toRow, m.toCol);
                const val = minimax(nb, depth - 1, alpha, beta, true);
                best = Math.min(best, val);
                beta = Math.min(beta, best);
                if (beta <= alpha) break;
            }
            return best;
        }
    }

    function getAIDepth() {
        if (aiDifficulty === "easy")   return 1;
        if (aiDifficulty === "medium") return 3;
        return 4; // hard
    }

    function getBestMove(b, side) {
        const depth = getAIDepth();
        const moves = getAllLegalMoves(b, side);
        if (moves.length === 0) return null;

        const maximizing = side === RED; // AI is black, so minimizing
        let bestVal = maximizing ? -Infinity : Infinity;
        let bestMove = moves[0];

        // Shuffle for variety at same score
        for (let i = moves.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [moves[i], moves[j]] = [moves[j], moves[i]];
        }

        for (const m of moves) {
            const nb = applyMove(b, m.fromRow, m.fromCol, m.toRow, m.toCol);
            const val = minimax(nb, depth - 1, -Infinity, Infinity, !maximizing);
            if (maximizing ? val > bestVal : val < bestVal) {
                bestVal = val;
                bestMove = m;
            }
        }
        return bestMove;
    }

    // ===================== DRAWING =====================
    let canvas, ctx;
    let pulseT = 0; // for glow animation

    function canvasXY(row, col) {
        return {
            x: MARGIN_X + col * CELL_SIZE,
            y: MARGIN_Y + row * CELL_SIZE,
        };
    }

    function drawBoard() {
        // Background
        ctx.fillStyle = "#0a0a14";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Board area background
        const bx = MARGIN_X, by = MARGIN_Y;
        const bw = BOARD_W, bh = BOARD_H;

        // Wood-like dark background for board
        ctx.fillStyle = "#0d1526";
        ctx.fillRect(bx - 10, by - 10, bw + 20, bh + 20);

        // Outer border glow
        ctx.save();
        ctx.shadowColor = "#1a4a8a";
        ctx.shadowBlur = 20;
        ctx.strokeStyle = "#1e5aaa";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 8, by - 8, bw + 16, bh + 16);
        ctx.restore();

        // Grid lines
        ctx.strokeStyle = "#1e3a5f";
        ctx.lineWidth = 1;

        // Horizontal lines
        for (let r = 0; r < ROWS; r++) {
            const y = by + r * CELL_SIZE;
            ctx.beginPath();
            ctx.moveTo(bx, y);
            ctx.lineTo(bx + bw, y);
            ctx.stroke();
        }

        // Vertical lines: columns 0 and 8 span full height;
        // others are broken at the river (rows 4-5)
        for (let c = 0; c < COLS; c++) {
            const x = bx + c * CELL_SIZE;
            if (c === 0 || c === 8) {
                ctx.beginPath();
                ctx.moveTo(x, by);
                ctx.lineTo(x, by + bh);
                ctx.stroke();
            } else {
                // Top half (rows 0-4)
                ctx.beginPath();
                ctx.moveTo(x, by);
                ctx.lineTo(x, by + 4 * CELL_SIZE);
                ctx.stroke();
                // Bottom half (rows 5-9)
                ctx.beginPath();
                ctx.moveTo(x, by + 5 * CELL_SIZE);
                ctx.lineTo(x, by + 9 * CELL_SIZE);
                ctx.stroke();
            }
        }

        // River label
        const riverY = by + 4.5 * CELL_SIZE;
        ctx.save();
        ctx.fillStyle = "#1e4a7a";
        ctx.font = "bold 18px 'Arial', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("楚 河", bx + bw * 0.28, riverY);
        ctx.fillText("汉 界", bx + bw * 0.72, riverY);
        ctx.restore();

        // Palace diagonal lines - Black
        drawPalaceDiagonals(0, 3);
        // Palace diagonal lines - Red
        drawPalaceDiagonals(7, 3);

        // Troop position marks (dots at soldier positions and cannon positions)
        const markPositions = [
            // Black soldiers
            [3,0],[3,2],[3,4],[3,6],[3,8],
            // Black cannons
            [2,1],[2,7],
            // Red soldiers
            [6,0],[6,2],[6,4],[6,6],[6,8],
            // Red cannons
            [7,1],[7,7],
        ];
        for (const [r, c] of markPositions) {
            drawPositionMark(r, c);
        }
    }

    function drawPalaceDiagonals(startRow, startCol) {
        const bx = MARGIN_X, by = MARGIN_Y;
        ctx.save();
        ctx.strokeStyle = "#1e3a5f";
        ctx.lineWidth = 1;
        const x1 = bx + startCol * CELL_SIZE;
        const y1 = by + startRow * CELL_SIZE;
        const x2 = bx + (startCol + 2) * CELL_SIZE;
        const y2 = by + (startRow + 2) * CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y1);
        ctx.lineTo(x1, y2);
        ctx.stroke();
        ctx.restore();
    }

    function drawPositionMark(row, col) {
        const {x, y} = canvasXY(row, col);
        const s = 6;  // arm length
        const g = 3;  // gap from center
        ctx.strokeStyle = "#2a5a8a";
        ctx.lineWidth = 1;

        // Draw corner tick marks in each of the four quadrants around (x,y)
        const signs = [[-1,-1],[1,-1],[-1,1],[1,1]];
        for (const [sx, sy] of signs) {
            // Skip horizontal arm on left/right board edges
            const drawH = !(col === 0 && sx === -1) && !(col === 8 && sx === 1);
            // Skip vertical arm on top/bottom board edges
            const drawV = !(row === 0 && sy === -1) && !(row === 9 && sy === 1);
            if (drawH) {
                ctx.beginPath();
                ctx.moveTo(x + sx * g, y);
                ctx.lineTo(x + sx * (g + s), y);
                ctx.stroke();
            }
            if (drawV) {
                ctx.beginPath();
                ctx.moveTo(x, y + sy * g);
                ctx.lineTo(x, y + sy * (g + s));
                ctx.stroke();
            }
        }
    }

    function drawLastMove() {
        if (!lastMove) return;
        const positions = [
            {row: lastMove.fromRow, col: lastMove.fromCol},
            {row: lastMove.toRow, col: lastMove.toCol},
        ];
        for (const {row, col} of positions) {
            const {x, y} = canvasXY(row, col);
            ctx.save();
            ctx.fillStyle = "rgba(255, 200, 0, 0.15)";
            ctx.beginPath();
            ctx.arc(x, y, PIECE_R + 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawLegalMoves() {
        for (const {row, col} of legalMoves) {
            const {x, y} = canvasXY(row, col);
            const hasCapture = board[row][col] !== null;
            ctx.save();
            if (hasCapture) {
                // Capture indicator: ring
                ctx.strokeStyle = "rgba(255, 80, 80, 0.8)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x, y, PIECE_R, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // Empty square indicator: dot
                ctx.fillStyle = "rgba(100, 220, 255, 0.6)";
                ctx.shadowColor = "#00cfff";
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    function drawPiece(row, col, piece, isSelected) {
        const {x, y} = canvasXY(row, col);
        const pulse = 0.5 + 0.5 * Math.sin(pulseT * 2);

        const isRed = piece.side === RED;
        const glowColor = isRed ? "#ff4400" : "#00aaff";
        const innerColor = isRed ? "#1a0800" : "#000d1a";
        const rimColor   = isRed ? (isSelected ? "#ffaa00" : "#ff6622") : (isSelected ? "#00ffee" : "#0088dd");
        const textColor  = isRed ? (isSelected ? "#ffee88" : "#ffbb66") : (isSelected ? "#aaffff" : "#66ddff");
        const bgColor    = isRed ? "#200800" : "#00111f";

        ctx.save();

        // Glow effect
        const glowIntensity = isSelected ? 25 + pulse * 15 : (checkFlash && isRed === (currentTurn === RED) ? 20 + pulse * 10 : 8);
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = glowIntensity;

        // Outer ring (bright rim)
        ctx.beginPath();
        ctx.arc(x, y, PIECE_R, 0, Math.PI * 2);
        ctx.fillStyle = rimColor;
        ctx.fill();

        // Middle ring
        ctx.beginPath();
        ctx.arc(x, y, PIECE_R - 3, 0, Math.PI * 2);
        ctx.fillStyle = bgColor;
        ctx.fill();

        // Inner decorative ring
        ctx.beginPath();
        ctx.arc(x, y, PIECE_R - 6, 0, Math.PI * 2);
        ctx.strokeStyle = rimColor;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Character
        ctx.shadowBlur = isSelected ? 12 : 4;
        ctx.shadowColor = glowColor;
        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.floor(PIECE_R * 1.0)}px 'STKaiti','KaiTi','SimSun','serif'`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(PIECE_CHARS[piece.side][piece.type], x, y + 1);

        ctx.restore();
    }

    function drawCheck() {
        if (!checkFlash) return;
        // Highlight the general in check
        const side = currentTurn;
        const gen = findGeneral(board, side);
        if (!gen) return;
        const {x, y} = canvasXY(gen.row, gen.col);
        ctx.save();
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 30 + 20 * Math.sin(pulseT * 5);
        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, PIECE_R + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function render() {
        drawBoard();
        drawLastMove();
        drawLegalMoves();

        // Draw all pieces
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c]) {
                    const isSel = selected && selected.row === r && selected.col === c;
                    drawPiece(r, c, board[r][c], isSel);
                }
            }
        }

        drawCheck();
    }

    // ===================== GAME LOOP =====================
    let lastTimestamp = 0;

    function gameLoop(timestamp) {
        const dt = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;
        pulseT += dt;
        if (checkFlashTimer > 0) {
            checkFlashTimer -= dt;
            if (checkFlashTimer <= 0) checkFlash = false;
        }
        render();
        animFrame = requestAnimationFrame(gameLoop);
    }

    // ===================== INPUT HANDLING =====================
    function screenToCell(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        const px = (clientX - rect.left) * scaleX;
        const py = (clientY - rect.top) * scaleY;

        // Find nearest intersection
        const col = Math.round((px - MARGIN_X) / CELL_SIZE);
        const row = Math.round((py - MARGIN_Y) / CELL_SIZE);
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;

        // Check distance from intersection
        const {x, y} = canvasXY(row, col);
        const dist = Math.hypot(px - x, py - y);
        if (dist > CELL_SIZE * 0.55) return null;

        return {row, col};
    }

    function handleClick(clientX, clientY) {
        if (gameOver || aiThinking) return;
        if (gameMode === "pve" && currentTurn === BLACK) return;

        const cell = screenToCell(clientX, clientY);
        if (!cell) return;

        const {row, col} = cell;
        const piece = board[row][col];

        if (selected) {
            // Try to move
            const isLegal = legalMoves.some(m => m.row === row && m.col === col);
            if (isLegal) {
                makeMove(selected.row, selected.col, row, col);
                return;
            }
            // Reselect own piece
            if (piece && piece.side === currentTurn) {
                selectPiece(row, col);
                return;
            }
            // Deselect
            selected = null;
            legalMoves = [];
        } else {
            if (piece && piece.side === currentTurn) {
                selectPiece(row, col);
            }
        }
    }

    function selectPiece(row, col) {
        selected = {row, col};
        legalMoves = getLegalMoves(board, row, col);
    }

    function makeMove(fromRow, fromCol, toRow, toCol) {
        const captured = board[toRow][toCol];
        if (captured) {
            if (captured.side === RED) capturedRed.push(captured);
            else capturedBlack.push(captured);
        }

        board = applyMove(board, fromRow, fromCol, toRow, toCol);
        lastMove = {fromRow, fromCol, toRow, toCol};
        selected = null;
        legalMoves = [];

        // Switch turn
        currentTurn = currentTurn === RED ? BLACK : RED;

        // Check for check/checkmate/stalemate
        postMoveCheck();
    }

    function postMoveCheck() {
        // Safety: if a general was somehow captured, end game immediately
        if (!findGeneral(board, RED)) {
            winner = BLACK;
            gameOver = true;
            showOverlay("黑方胜利！", "Black wins — Red General captured!");
            return;
        }
        if (!findGeneral(board, BLACK)) {
            winner = RED;
            gameOver = true;
            showOverlay("红方胜利！", "Red wins — Black General captured!");
            return;
        }

        const inCheck = isInCheck(board, currentTurn);
        const noMoves = hasNoMoves(board, currentTurn);

        if (noMoves) {
            if (inCheck) {
                // Checkmate: opposite side wins
                winner = currentTurn === RED ? BLACK : RED;
                gameOver = true;
                showOverlay(
                    winner === RED ? "红方胜利！" : "黑方胜利！",
                    winner === RED ? "Red wins by checkmate!" : "Black wins by checkmate!",
                );
            } else {
                // Stalemate
                gameOver = true;
                winner = null;
                showOverlay("平局！", "Stalemate — no legal moves.");
            }
            return;
        }

        if (inCheck) {
            checkFlash = true;
            checkFlashTimer = 2.5;
            updateStatus(currentTurn === RED ? "红方被将军！" : "黑方被将军！");
        } else {
            updateStatus(currentTurn === RED ? "红方走棋" : "黑方走棋");
        }

        updateCapturedDisplay();

        // Trigger AI if PvE and it's black's turn
        if (gameMode === "pve" && currentTurn === BLACK && !gameOver) {
            scheduleAI();
        }
    }

    function scheduleAI() {
        aiThinking = true;
        updateStatus("黑方思考中...");
        setTimeout(() => {
            const move = getBestMove(board, BLACK);
            aiThinking = false;
            if (move) {
                makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
            } else {
                // AI has no moves
                postMoveCheck();
            }
        }, 80);
    }

    // ===================== UI UPDATES =====================
    function updateStatus(text) {
        const el = document.getElementById("xiangqi-status");
        if (el) el.textContent = text;
    }

    function updateCapturedDisplay() {
        const redEl = document.getElementById("xiangqi-captured-red");
        const blackEl = document.getElementById("xiangqi-captured-black");
        if (redEl) {
            redEl.textContent = capturedRed.map(p => PIECE_CHARS.red[p.type]).join(" ") || "—";
        }
        if (blackEl) {
            blackEl.textContent = capturedBlack.map(p => PIECE_CHARS.black[p.type]).join(" ") || "—";
        }
    }

    function showOverlay(title, desc) {
        const overlay = document.getElementById("xiangqi-overlay");
        const titleEl = document.getElementById("xiangqi-overlay-title");
        const descEl  = document.getElementById("xiangqi-overlay-desc");
        if (titleEl) titleEl.textContent = title;
        if (descEl)  descEl.textContent  = desc;
        if (overlay) overlay.classList.add("visible");
    }

    function hideOverlay() {
        const overlay = document.getElementById("xiangqi-overlay");
        if (overlay) overlay.classList.remove("visible");
    }

    // ===================== NEW GAME =====================
    function newGame() {
        board = createInitialBoard();
        currentTurn = RED;
        selected = null;
        legalMoves = [];
        gameOver = false;
        winner = null;
        capturedRed = [];
        capturedBlack = [];
        aiThinking = false;
        lastMove = null;
        checkFlash = false;
        checkFlashTimer = 0;
        pulseT = 0;

        hideOverlay();
        updateCapturedDisplay();

        const modeEl = document.getElementById("xiangqi-mode-select");
        if (modeEl) gameMode = modeEl.value;

        const diffEl = document.getElementById("xiangqi-difficulty-select");
        if (diffEl) aiDifficulty = diffEl.value;

        updateStatus("红方走棋");
    }

    // ===================== INIT =====================
    function initXiangqiGame() {
        canvas = document.getElementById("xiangqi-canvas");
        if (!canvas) {
            console.error("[xiangqi.js] Canvas #xiangqi-canvas not found.");
            return;
        }
        canvas.width  = CANVAS_W;
        canvas.height = CANVAS_H;
        ctx = canvas.getContext("2d");

        // Canvas click
        canvas.addEventListener("click", (e) => {
            handleClick(e.clientX, e.clientY);
        });

        // Touch support
        canvas.addEventListener("touchstart", (e) => {
            e.preventDefault();
            const t = e.touches[0];
            handleClick(t.clientX, t.clientY);
        }, {passive: false});

        // New game button
        const ngBtn = document.getElementById("xiangqi-newgame-btn");
        if (ngBtn) ngBtn.addEventListener("click", newGame);

        // Overlay primary button (play again)
        const primBtn = document.getElementById("xiangqi-overlay-primary");
        if (primBtn) primBtn.addEventListener("click", newGame);

        // Mode change
        const modeEl = document.getElementById("xiangqi-mode-select");
        if (modeEl) modeEl.addEventListener("change", newGame);

        // Difficulty change
        const diffEl = document.getElementById("xiangqi-difficulty-select");
        if (diffEl) diffEl.addEventListener("change", () => {
            aiDifficulty = diffEl.value;
        });

        newGame();

        if (animFrame) cancelAnimationFrame(animFrame);
        lastTimestamp = performance.now();
        animFrame = requestAnimationFrame(gameLoop);
    }

    window.initXiangqiGame = initXiangqiGame;

})();
