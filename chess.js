/**
 * chess.js — International Chess
 * Full chess rules: castling, en passant, promotion, check/checkmate/stalemate
 * AI: minimax + alpha-beta (Easy/Medium/Hard)
 * Visual: dark neon cyberpunk on canvas
 * Export: window.initChessGame()
 */

(function () {
    "use strict";

    // ─── Constants ────────────────────────────────────────────────────────────
    const BOARD_SIZE = 8;
    const SQUARE_SIZE = 80; // 640 / 8
    const CANVAS_SIZE = 640;

    const WHITE = "w";
    const BLACK = "b";

    const KING   = "K";
    const QUEEN  = "Q";
    const ROOK   = "R";
    const BISHOP = "B";
    const KNIGHT = "N";
    const PAWN   = "P";

    // Piece values for evaluation
    const PIECE_VALUE = {
        [PAWN]:   100,
        [KNIGHT]: 320,
        [BISHOP]: 330,
        [ROOK]:   500,
        [QUEEN]:  900,
        [KING]:   20000,
    };

    // Piece-square tables (from white's perspective, rank 0 = rank 8 = black back rank)
    const PST = {
        [PAWN]: [
            [  0,  0,  0,  0,  0,  0,  0,  0],
            [ 50, 50, 50, 50, 50, 50, 50, 50],
            [ 10, 10, 20, 30, 30, 20, 10, 10],
            [  5,  5, 10, 25, 25, 10,  5,  5],
            [  0,  0,  0, 20, 20,  0,  0,  0],
            [  5, -5,-10,  0,  0,-10, -5,  5],
            [  5, 10, 10,-20,-20, 10, 10,  5],
            [  0,  0,  0,  0,  0,  0,  0,  0],
        ],
        [KNIGHT]: [
            [-50,-40,-30,-30,-30,-30,-40,-50],
            [-40,-20,  0,  0,  0,  0,-20,-40],
            [-30,  0, 10, 15, 15, 10,  0,-30],
            [-30,  5, 15, 20, 20, 15,  5,-30],
            [-30,  0, 15, 20, 20, 15,  0,-30],
            [-30,  5, 10, 15, 15, 10,  5,-30],
            [-40,-20,  0,  5,  5,  0,-20,-40],
            [-50,-40,-30,-30,-30,-30,-40,-50],
        ],
        [BISHOP]: [
            [-20,-10,-10,-10,-10,-10,-10,-20],
            [-10,  0,  0,  0,  0,  0,  0,-10],
            [-10,  0,  5, 10, 10,  5,  0,-10],
            [-10,  5,  5, 10, 10,  5,  5,-10],
            [-10,  0, 10, 10, 10, 10,  0,-10],
            [-10, 10, 10, 10, 10, 10, 10,-10],
            [-10,  5,  0,  0,  0,  0,  5,-10],
            [-20,-10,-10,-10,-10,-10,-10,-20],
        ],
        [ROOK]: [
            [  0,  0,  0,  0,  0,  0,  0,  0],
            [  5, 10, 10, 10, 10, 10, 10,  5],
            [ -5,  0,  0,  0,  0,  0,  0, -5],
            [ -5,  0,  0,  0,  0,  0,  0, -5],
            [ -5,  0,  0,  0,  0,  0,  0, -5],
            [ -5,  0,  0,  0,  0,  0,  0, -5],
            [ -5,  0,  0,  0,  0,  0,  0, -5],
            [  0,  0,  0,  5,  5,  0,  0,  0],
        ],
        [QUEEN]: [
            [-20,-10,-10, -5, -5,-10,-10,-20],
            [-10,  0,  0,  0,  0,  0,  0,-10],
            [-10,  0,  5,  5,  5,  5,  0,-10],
            [ -5,  0,  5,  5,  5,  5,  0, -5],
            [  0,  0,  5,  5,  5,  5,  0, -5],
            [-10,  5,  5,  5,  5,  5,  0,-10],
            [-10,  0,  5,  0,  0,  0,  0,-10],
            [-20,-10,-10, -5, -5,-10,-10,-20],
        ],
        [KING]: [
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-20,-30,-30,-40,-40,-30,-30,-20],
            [-10,-20,-20,-20,-20,-20,-20,-10],
            [ 20, 20,  0,  0,  0,  0, 20, 20],
            [ 20, 30, 10,  0,  0, 10, 30, 20],
        ],
    };

    // Unicode chess symbols
    const UNICODE = {
        w: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
        b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
    };

    // ─── Stockfish Worker ─────────────────────────────────────────────────────
    let sfWorker = null;
    let sfReady = false;
    let sfCallback = null; // called with UCI bestmove string when Stockfish responds

    function initStockfish() {
        try {
            // Load stockfish.js via importScripts inside a blob worker (avoids CORS same-origin restriction)
            const blob = new Blob(
                ['importScripts("https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js");'],
                { type: "text/javascript" }
            );
            sfWorker = new Worker(URL.createObjectURL(blob));
            sfWorker.onmessage = function (e) {
                const line = typeof e.data === "string" ? e.data : "";
                if (line === "uciok") {
                    sfWorker.postMessage("setoption name Hash value 32");
                    sfWorker.postMessage("isready");
                } else if (line === "readyok") {
                    sfReady = true;
                } else if (line.startsWith("bestmove") && sfCallback) {
                    const parts = line.split(" ");
                    const uci = parts[1];
                    if (uci && uci !== "(none)") {
                        const cb = sfCallback;
                        sfCallback = null;
                        cb(uci);
                    } else if (sfCallback) {
                        // No move found (stalemate/checkmate already handled)
                        sfCallback = null;
                        aiThinking = false;
                    }
                }
            };
            sfWorker.onerror = function () { sfWorker = null; sfReady = false; };
            sfWorker.postMessage("uci");
        } catch (err) {
            sfWorker = null;
        }
    }

    // Convert UCI square notation (e.g. "e2") to {row, col} on our 0-indexed board
    function uciSquare(sq) {
        return { row: 8 - parseInt(sq[1]), col: sq.charCodeAt(0) - 97 };
    }

    // Convert a UCI move string ("e2e4", "e7e8q") to an internal move object,
    // then match against legal moves to pick up flags (castling, enPassant, etc.)
    function uciToLegalMove(uci) {
        const from = uciSquare(uci.slice(0, 2));
        const to   = uciSquare(uci.slice(2, 4));
        const promoChar = uci[4];
        const promoMap  = { q: QUEEN, r: ROOK, b: BISHOP, n: KNIGHT };
        const promo     = promoChar ? (promoMap[promoChar] || QUEEN) : null;

        const legalMoves = allLegalMoves(board, BLACK, enPassantTarget, castlingRights);
        return legalMoves.find(m =>
            m.from.row === from.row && m.from.col === from.col &&
            m.to.row   === to.row   && m.to.col   === to.col &&
            (!promo || m.promotion === promo)
        ) || null;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    let canvas, ctx;
    let board;          // 8×8 array of {color, type} or null
    let currentTurn;
    let selectedSq;     // {row, col} or null
    let legalMovesCache; // array of move objects for selectedSq
    let enPassantTarget; // {row, col} or null — square where en passant capture lands
    let castlingRights;  // { w: {K:bool, Q:bool}, b: {K:bool, Q:bool} }
    let gameMode;        // "pve" | "pvp"
    let aiDifficulty;    // "easy" | "medium" | "hard"
    let gameOver;
    let lastMove;        // {from, to} for highlighting
    let moveHistory;     // array of algebraic notation strings
    let capturedByWhite; // pieces captured by white (black pieces)
    let capturedByBlack; // pieces captured by black (white pieces)
    let positionHistory; // array of FEN-like strings for threefold rep
    let halfMoveClock;   // for 50-move rule
    let fullMoveNumber;
    let promotionPending; // {row, col, color} or null
    let aiThinking;

    // ─── Init / Reset ─────────────────────────────────────────────────────────
    function initBoard() {
        board = [];
        for (let r = 0; r < 8; r++) {
            board.push(new Array(8).fill(null));
        }

        const backRank = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];
        for (let c = 0; c < 8; c++) {
            board[0][c] = { color: BLACK, type: backRank[c] };
            board[1][c] = { color: BLACK, type: PAWN };
            board[6][c] = { color: WHITE, type: PAWN };
            board[7][c] = { color: WHITE, type: backRank[c] };
        }

        currentTurn = WHITE;
        selectedSq = null;
        legalMovesCache = [];
        enPassantTarget = null;
        castlingRights = {
            w: { K: true, Q: true },
            b: { K: true, Q: true },
        };
        gameOver = false;
        lastMove = null;
        moveHistory = [];
        capturedByWhite = [];
        capturedByBlack = [];
        positionHistory = [];
        halfMoveClock = 0;
        fullMoveNumber = 1;
        promotionPending = null;
        aiThinking = false;

        recordPosition();
        updateUI();
        render();
    }

    // ─── Position Hash (for threefold repetition) ─────────────────────────────
    function boardToFEN() {
        let fen = "";
        for (let r = 0; r < 8; r++) {
            let empty = 0;
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (!p) {
                    empty++;
                } else {
                    if (empty) { fen += empty; empty = 0; }
                    const ch = p.color === WHITE ? p.type : p.type.toLowerCase();
                    fen += ch;
                }
            }
            if (empty) fen += empty;
            if (r < 7) fen += "/";
        }
        fen += " " + currentTurn;
        fen += " " + (castlingRights.w.K ? "K" : "") + (castlingRights.w.Q ? "Q" : "")
                   + (castlingRights.b.K ? "k" : "") + (castlingRights.b.Q ? "q" : "");
        fen += " " + (enPassantTarget ? String.fromCharCode(97 + enPassantTarget.col) + (8 - enPassantTarget.row) : "-");
        return fen;
    }

    // Full FEN including halfmove clock and fullmove number (required by Stockfish)
    function boardToFullFEN() {
        return boardToFEN() + " " + halfMoveClock + " " + fullMoveNumber;
    }

    function recordPosition() {
        positionHistory.push(boardToFEN());
    }

    function isThreefoldRepetition() {
        const cur = positionHistory[positionHistory.length - 1];
        let count = 0;
        for (const p of positionHistory) { if (p === cur) count++; }
        return count >= 3;
    }

    // ─── Move Generation ──────────────────────────────────────────────────────
    // Returns raw (pseudo-legal) moves for a piece at (r,c)
    function pseudoLegalMoves(b, r, c, ep, cr) {
        const piece = b[r][c];
        if (!piece) return [];
        const moves = [];
        const { color, type } = piece;
        const opp = color === WHITE ? BLACK : WHITE;
        const dir = color === WHITE ? -1 : 1; // pawn advance direction

        const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
        const isEmpty = (r, c) => inBounds(r, c) && !b[r][c];
        const isOpp   = (r, c) => inBounds(r, c) && b[r][c] && b[r][c].color === opp;
        const isFree  = (r, c) => isEmpty(r, c) || isOpp(r, c);

        const push = (tr, tc, flags = {}) => {
            if (inBounds(tr, tc)) moves.push({ from: {row:r,col:c}, to: {row:tr,col:tc}, ...flags });
        };

        const slide = (dr, dc) => {
            let nr = r + dr, nc = c + dc;
            while (inBounds(nr, nc)) {
                if (b[nr][nc]) {
                    if (b[nr][nc].color === opp) push(nr, nc);
                    break;
                }
                push(nr, nc);
                nr += dr; nc += dc;
            }
        };

        switch (type) {
            case PAWN: {
                const startRow = color === WHITE ? 6 : 1;
                const promRow  = color === WHITE ? 0 : 7;
                // Single advance
                if (isEmpty(r + dir, c)) {
                    const isPromo = (r + dir) === promRow;
                    if (isPromo) {
                        for (const pt of [QUEEN, ROOK, BISHOP, KNIGHT])
                            push(r + dir, c, { promotion: pt });
                    } else {
                        push(r + dir, c);
                        // Double advance from start
                        if (r === startRow && isEmpty(r + 2*dir, c))
                            push(r + 2*dir, c, { doublePush: true });
                    }
                }
                // Captures
                for (const dc of [-1, 1]) {
                    const tc = c + dc;
                    const tr = r + dir;
                    if (!inBounds(tr, tc)) continue;
                    const isPromo = tr === promRow;
                    if (isOpp(tr, tc)) {
                        if (isPromo) {
                            for (const pt of [QUEEN, ROOK, BISHOP, KNIGHT])
                                push(tr, tc, { promotion: pt });
                        } else {
                            push(tr, tc);
                        }
                    }
                    // En passant
                    if (ep && tr === ep.row && tc === ep.col)
                        push(tr, tc, { enPassant: true });
                }
                break;
            }
            case KNIGHT: {
                for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
                    if (isFree(r+dr, c+dc)) push(r+dr, c+dc);
                break;
            }
            case BISHOP: {
                for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr, dc);
                break;
            }
            case ROOK: {
                for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
                break;
            }
            case QUEEN: {
                for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
                break;
            }
            case KING: {
                for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
                    if (isFree(r+dr, c+dc)) push(r+dr, c+dc);
                // Castling
                const kingRow = color === WHITE ? 7 : 0;
                if (r === kingRow && c === 4) {
                    // Kingside
                    if (cr[color].K && !b[kingRow][5] && !b[kingRow][6])
                        push(kingRow, 6, { castling: "K" });
                    // Queenside
                    if (cr[color].Q && !b[kingRow][3] && !b[kingRow][2] && !b[kingRow][1])
                        push(kingRow, 2, { castling: "Q" });
                }
                break;
            }
        }
        return moves;
    }

    // Apply a move to a board copy, returns new board state
    function applyMove(b, move, cr, ep) {
        const nb = b.map(row => row.map(p => p ? {...p} : null));
        const ncr = { w: {...cr.w}, b: {...cr.b} };
        let nep = null;

        const piece = nb[move.from.row][move.from.col];
        const { color } = piece;

        // Move piece
        nb[move.to.row][move.to.col] = piece;
        nb[move.from.row][move.from.col] = null;

        // Promotion
        if (move.promotion) {
            nb[move.to.row][move.to.col] = { color, type: move.promotion };
        }

        // En passant capture
        if (move.enPassant) {
            const captureRow = move.from.row; // same row as moving pawn, different col
            nb[captureRow][move.to.col] = null;
        }

        // Double pawn push — set en passant target
        if (move.doublePush) {
            const epRow = (move.from.row + move.to.row) / 2;
            nep = { row: epRow, col: move.to.col };
        }

        // Castling — move rook
        if (move.castling) {
            const kingRow = move.to.row;
            if (move.castling === "K") {
                nb[kingRow][5] = nb[kingRow][7];
                nb[kingRow][7] = null;
            } else {
                nb[kingRow][3] = nb[kingRow][0];
                nb[kingRow][0] = null;
            }
        }

        // Update castling rights
        if (piece.type === KING) {
            ncr[color].K = false;
            ncr[color].Q = false;
        }
        if (piece.type === ROOK) {
            const homeRow = color === WHITE ? 7 : 0;
            if (move.from.row === homeRow) {
                if (move.from.col === 7) ncr[color].K = false;
                if (move.from.col === 0) ncr[color].Q = false;
            }
        }
        // If rook is captured
        if (move.to.row === 0 && move.to.col === 0) ncr.b.Q = false;
        if (move.to.row === 0 && move.to.col === 7) ncr.b.K = false;
        if (move.to.row === 7 && move.to.col === 0) ncr.w.Q = false;
        if (move.to.row === 7 && move.to.col === 7) ncr.w.K = false;

        return { board: nb, castlingRights: ncr, enPassantTarget: nep };
    }

    function findKing(b, color) {
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++)
                if (b[r][c] && b[r][c].color === color && b[r][c].type === KING)
                    return { row: r, col: c };
        return null;
    }

    function isSquareAttacked(b, row, col, byColor) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = b[r][c];
                if (!p || p.color !== byColor) continue;
                const moves = pseudoLegalMoves(b, r, c, null, { w:{K:false,Q:false}, b:{K:false,Q:false} });
                for (const m of moves) {
                    if (m.to.row === row && m.to.col === col) return true;
                }
            }
        }
        return false;
    }

    function isInCheck(b, color) {
        const king = findKing(b, color);
        if (!king) return false;
        const opp = color === WHITE ? BLACK : WHITE;
        return isSquareAttacked(b, king.row, king.col, opp);
    }

    // Get fully legal moves for a piece (filters moves that leave king in check)
    function legalMovesFor(r, c, b, ep, cr) {
        const piece = b[r][c];
        if (!piece) return [];
        const pseudo = pseudoLegalMoves(b, r, c, ep, cr);
        const legal = [];

        for (const move of pseudo) {
            // For castling, check intermediate squares not under attack
            if (move.castling) {
                const kingRow = move.to.row;
                const opp = piece.color === WHITE ? BLACK : WHITE;
                // King must not be in check before castling
                if (isInCheck(b, piece.color)) continue;
                // King must not pass through attacked square
                const passCol = move.castling === "K" ? 5 : 3;
                if (isSquareAttacked(b, kingRow, passCol, opp)) continue;
                // Rook must be present at expected position
                const rookCol = move.castling === "K" ? 7 : 0;
                if (!b[kingRow][rookCol] || b[kingRow][rookCol].type !== ROOK || b[kingRow][rookCol].color !== piece.color) continue;
            }

            const res = applyMove(b, move, cr, ep);
            if (!isInCheck(res.board, piece.color)) {
                legal.push(move);
            }
        }
        return legal;
    }

    // All legal moves for a color
    function allLegalMoves(b, color, ep, cr) {
        const moves = [];
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++)
                if (b[r][c] && b[r][c].color === color)
                    moves.push(...legalMovesFor(r, c, b, ep, cr));
        return moves;
    }

    function isCheckmate(b, color, ep, cr) {
        return isInCheck(b, color) && allLegalMoves(b, color, ep, cr).length === 0;
    }

    function isStalemate(b, color, ep, cr) {
        return !isInCheck(b, color) && allLegalMoves(b, color, ep, cr).length === 0;
    }

    // ─── Algebraic Notation ───────────────────────────────────────────────────
    const FILES = "abcdefgh";
    const RANKS = "87654321";

    function sqToAlg(row, col) {
        return FILES[col] + RANKS[row];
    }

    function moveToAlg(move, b, ep, cr) {
        const piece = b[move.from.row][move.from.col];
        const target = b[move.to.row][move.to.col];
        let notation = "";

        if (move.castling === "K") return "O-O";
        if (move.castling === "Q") return "O-O-O";

        if (piece.type !== PAWN) {
            notation += piece.type;
            // Disambiguation
            const sameType = [];
            for (let r = 0; r < 8; r++)
                for (let c = 0; c < 8; c++)
                    if (b[r][c] && b[r][c].type === piece.type && b[r][c].color === piece.color
                        && !(r === move.from.row && c === move.from.col)) {
                        const ms = legalMovesFor(r, c, b, ep, cr);
                        if (ms.some(m => m.to.row === move.to.row && m.to.col === move.to.col))
                            sameType.push({row:r,col:c});
                    }
            if (sameType.length > 0) {
                const sameFile = sameType.some(s => s.col === move.from.col);
                const sameRank = sameType.some(s => s.row === move.from.row);
                if (!sameFile) notation += FILES[move.from.col];
                else if (!sameRank) notation += RANKS[move.from.row];
                else notation += FILES[move.from.col] + RANKS[move.from.row];
            }
        }

        if (target || move.enPassant) {
            if (piece.type === PAWN) notation += FILES[move.from.col];
            notation += "x";
        }

        notation += sqToAlg(move.to.row, move.to.col);

        if (move.promotion) notation += "=" + move.promotion;

        // Check/checkmate indicator
        const res = applyMove(b, move, cr, ep);
        const opp = piece.color === WHITE ? BLACK : WHITE;
        if (isCheckmate(res.board, opp, res.enPassantTarget, res.castlingRights)) notation += "#";
        else if (isInCheck(res.board, opp)) notation += "+";

        return notation;
    }

    // ─── Execute Move ─────────────────────────────────────────────────────────
    function executeMove(move, autoPromo) {
        const piece = board[move.from.row][move.from.col];
        const captured = board[move.to.row][move.to.col];
        const isCapture = !!captured || move.enPassant;

        // Record notation before board changes
        const notation = moveToAlg(move, board, enPassantTarget, castlingRights);

        // If promotion without choice yet (human), show chooser
        if (move.promotion && !autoPromo) {
            promotionPending = {
                move,
                color: piece.color,
                notation,
                isCapture,
                piece,
            };
            render(); // show promotion overlay
            return;
        }

        // Actually apply
        const res = applyMove(board, move, castlingRights, enPassantTarget);
        board = res.board;
        castlingRights = res.castlingRights;
        enPassantTarget = res.enPassantTarget;

        // Track captures
        if (captured) {
            if (piece.color === WHITE) capturedByWhite.push(captured);
            else capturedByBlack.push(captured);
        }
        if (move.enPassant) {
            // The captured pawn is at (move.from.row, move.to.col)
            const epPawn = { color: piece.color === WHITE ? BLACK : WHITE, type: PAWN };
            if (piece.color === WHITE) capturedByWhite.push(epPawn);
            else capturedByBlack.push(epPawn);
        }

        // Half-move clock
        if (isCapture || piece.type === PAWN) halfMoveClock = 0;
        else halfMoveClock++;

        if (currentTurn === BLACK) fullMoveNumber++;

        lastMove = { from: move.from, to: move.to };
        selectedSq = null;
        legalMovesCache = [];

        // Record move
        const moveNum = Math.ceil(fullMoveNumber / 1);
        if (currentTurn === WHITE) {
            moveHistory.push(fullMoveNumber + ". " + notation);
        } else {
            // Append to last entry if white just went
            if (moveHistory.length > 0 && !moveHistory[moveHistory.length - 1].includes("...")) {
                moveHistory[moveHistory.length - 1] += " " + notation;
            } else {
                moveHistory.push(fullMoveNumber + "... " + notation);
            }
        }

        currentTurn = currentTurn === WHITE ? BLACK : WHITE;
        recordPosition();

        promotionPending = null;

        // Check game-over conditions
        const opp = currentTurn;
        if (isCheckmate(board, opp, enPassantTarget, castlingRights)) {
            gameOver = true;
            const winner = opp === WHITE ? "Black" : "White";
            showOverlay("Checkmate!", winner + " wins by checkmate.", "New Game");
        } else if (isStalemate(board, opp, enPassantTarget, castlingRights)) {
            gameOver = true;
            showOverlay("Stalemate!", "The game is a draw.", "New Game");
        } else if (isThreefoldRepetition()) {
            gameOver = true;
            showOverlay("Draw!", "Threefold repetition.", "New Game");
        } else if (halfMoveClock >= 100) {
            gameOver = true;
            showOverlay("Draw!", "Fifty-move rule.", "New Game");
        }

        updateUI();
        render();

        // AI turn
        if (!gameOver && gameMode === "pve" && currentTurn === BLACK) {
            scheduleAI();
        }
    }

    // ─── Promotion UI ─────────────────────────────────────────────────────────
    function handlePromotionChoice(pieceType) {
        if (!promotionPending) return;
        const move = { ...promotionPending.move, promotion: pieceType };
        promotionPending = null;
        executeMove(move, true);
    }

    // ─── AI ───────────────────────────────────────────────────────────────────
    function evaluateBoard(b) {
        let score = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = b[r][c];
                if (!p) continue;
                const val = PIECE_VALUE[p.type];
                // PST: white uses table as-is (row 0=rank8 = opponent back rank)
                // black uses mirrored (row 7 = black's back rank)
                const pstRow = p.color === WHITE ? r : 7 - r;
                const pst = PST[p.type][pstRow][c];
                if (p.color === WHITE) score += val + pst;
                else score -= val + pst;
            }
        }
        return score;
    }

    // Quiescence search: resolves tactical sequences (captures/promotions) at leaf nodes
    function quiesce(b, alpha, beta, maximizing, ep, cr) {
        const stand = evaluateBoard(b);
        if (maximizing) {
            if (stand >= beta) return beta;
            if (stand > alpha) alpha = stand;
        } else {
            if (stand <= alpha) return alpha;
            if (stand < beta) beta = stand;
        }

        const color = maximizing ? WHITE : BLACK;
        const moves = allLegalMoves(b, color, ep, cr).filter(m =>
            b[m.to.row][m.to.col] || m.enPassant || m.promotion
        );

        // MVV-LVA: most valuable victim, least valuable attacker
        moves.sort((a, b2) => {
            const tA = b[a.to.row][a.to.col];
            const tB = b[b2.to.row][b2.to.col];
            const vA = tA ? PIECE_VALUE[tA.type] * 10 - PIECE_VALUE[b[a.from.row][a.from.col].type] : 0;
            const vB = tB ? PIECE_VALUE[tB.type] * 10 - PIECE_VALUE[b[b2.from.row][b2.from.col].type] : 0;
            return vB - vA;
        });

        if (maximizing) {
            for (const move of moves) {
                const res = applyMove(b, move, cr, ep);
                const score = quiesce(res.board, alpha, beta, false, res.enPassantTarget, res.castlingRights);
                if (score >= beta) return beta;
                if (score > alpha) alpha = score;
            }
            return alpha;
        } else {
            for (const move of moves) {
                const res = applyMove(b, move, cr, ep);
                const score = quiesce(res.board, alpha, beta, true, res.enPassantTarget, res.castlingRights);
                if (score <= alpha) return alpha;
                if (score < beta) beta = score;
            }
            return beta;
        }
    }

    function minimax(b, depth, alpha, beta, maximizing, ep, cr) {
        const color = maximizing ? WHITE : BLACK;
        const moves = allLegalMoves(b, color, ep, cr);

        if (moves.length === 0) {
            if (isInCheck(b, color)) return maximizing ? -100000 : 100000;
            return 0; // stalemate
        }
        if (depth === 0) return quiesce(b, alpha, beta, maximizing, ep, cr);

        // MVV-LVA move ordering
        moves.sort((a, b2) => {
            const tA = b[a.to.row][a.to.col];
            const tB = b[b2.to.row][b2.to.col];
            const vA = tA ? PIECE_VALUE[tA.type] * 10 - PIECE_VALUE[b[a.from.row][a.from.col].type] : -1;
            const vB = tB ? PIECE_VALUE[tB.type] * 10 - PIECE_VALUE[b[b2.from.row][b2.from.col].type] : -1;
            return vB - vA;
        });

        if (maximizing) {
            let maxScore = -Infinity;
            for (const move of moves) {
                const res = applyMove(b, move, cr, ep);
                const score = minimax(res.board, depth - 1, alpha, beta, false, res.enPassantTarget, res.castlingRights);
                maxScore = Math.max(maxScore, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
            return maxScore;
        } else {
            let minScore = Infinity;
            for (const move of moves) {
                const res = applyMove(b, move, cr, ep);
                const score = minimax(res.board, depth - 1, alpha, beta, true, res.enPassantTarget, res.castlingRights);
                minScore = Math.min(minScore, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
            return minScore;
        }
    }

    function getBestMove() {
        const moves = allLegalMoves(board, BLACK, enPassantTarget, castlingRights);
        if (moves.length === 0) return null;

        if (aiDifficulty === "easy") {
            return moves[Math.floor(Math.random() * moves.length)];
        }

        // Medium=3 plies + quiescence, Hard=4 plies + quiescence
        const depth = aiDifficulty === "medium" ? 3 : 4;
        let bestMove = null;
        let bestScore = Infinity;

        // Root move ordering: MVV-LVA captures first
        moves.sort((a, b2) => {
            const capA = board[a.to.row][a.to.col] ? PIECE_VALUE[board[a.to.row][a.to.col].type] : 0;
            const capB = board[b2.to.row][b2.to.col] ? PIECE_VALUE[board[b2.to.row][b2.to.col].type] : 0;
            return capB - capA;
        });

        for (const move of moves) {
            const m = move.promotion ? { ...move, promotion: QUEEN } : move;
            const res = applyMove(board, m, castlingRights, enPassantTarget);
            const score = minimax(res.board, depth - 1, -Infinity, Infinity, true, res.enPassantTarget, res.castlingRights);
            if (score < bestScore) {
                bestScore = score;
                bestMove = m;
            }
        }

        return bestMove;
    }

    function scheduleAI() {
        if (aiThinking) return;
        aiThinking = true;
        updateStatus("AI is thinking...");

        // Hard mode: use Stockfish engine when available
        if (aiDifficulty === "hard" && sfWorker && sfReady) {
            const fen = boardToFullFEN();
            sfCallback = function (uci) {
                aiThinking = false;
                const move = uciToLegalMove(uci);
                if (move) {
                    executeMove(move, true);
                } else {
                    // Fallback to local minimax if UCI move can't be matched
                    const fallback = getBestMove();
                    if (fallback) executeMove(fallback, true);
                }
            };
            sfWorker.postMessage("position fen " + fen);
            sfWorker.postMessage("go movetime 1500");
            return;
        }

        // Easy / Medium: use local minimax
        setTimeout(() => {
            const move = getBestMove();
            aiThinking = false;
            if (move) executeMove(move, true);
        }, 80);
    }

    // ─── Canvas Rendering ─────────────────────────────────────────────────────
    const COLORS = {
        darkSq:     "#0d1b2e",
        lightSq:    "#162840",
        selectedSq: "#00ffe760",
        lastMoveSq: "#7b61ff40",
        legalDot:   "#00ffe7aa",
        legalCapture:"#ff4d6d99",
        checkSq:    "#ff003380",
        boardBorder:"#00ffe7",
        coordText:  "#4a8fa8",
        pieceWhite: "#e0f4ff",
        pieceBlack: "#a0cfff",
        pieceShadow:"#00ffe755",
        promoOverlay:"#0a111eee",
    };

    function render() {
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        drawBoard();
        drawHighlights();
        drawPieces();
        drawCoordinates();
        if (promotionPending) drawPromotionOverlay();
    }

    function drawBoard() {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const x = c * SQUARE_SIZE;
                const y = r * SQUARE_SIZE;
                ctx.fillStyle = (r + c) % 2 === 0 ? COLORS.lightSq : COLORS.darkSq;
                ctx.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE);
            }
        }
    }

    function drawHighlights() {
        const kingPos = isInCheck(board, currentTurn) ? findKing(board, currentTurn) : null;

        // Last move highlight
        if (lastMove) {
            highlightSquare(lastMove.from.row, lastMove.from.col, COLORS.lastMoveSq);
            highlightSquare(lastMove.to.row, lastMove.to.col, COLORS.lastMoveSq);
        }

        // King in check
        if (kingPos) {
            drawCheckGlow(kingPos.row, kingPos.col);
        }

        // Selected square
        if (selectedSq) {
            highlightSquare(selectedSq.row, selectedSq.col, COLORS.selectedSq);
            drawSelectionGlow(selectedSq.row, selectedSq.col);

            // Legal move indicators
            for (const move of legalMovesCache) {
                // Deduplicate by to-square (promotions generate 4 moves to same square)
                const target = board[move.to.row][move.to.col];
                const isCapture = !!target || move.enPassant;
                if (isCapture) {
                    drawCaptureRing(move.to.row, move.to.col);
                } else {
                    drawLegalDot(move.to.row, move.to.col);
                }
            }
        }
    }

    function highlightSquare(r, c, color) {
        ctx.fillStyle = color;
        ctx.fillRect(c * SQUARE_SIZE, r * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
    }

    function drawSelectionGlow(r, c) {
        const x = c * SQUARE_SIZE + SQUARE_SIZE / 2;
        const y = r * SQUARE_SIZE + SQUARE_SIZE / 2;
        const grad = ctx.createRadialGradient(x, y, 5, x, y, SQUARE_SIZE * 0.7);
        grad.addColorStop(0, "#00ffe755");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(c * SQUARE_SIZE, r * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
    }

    function drawCheckGlow(r, c) {
        const x = c * SQUARE_SIZE + SQUARE_SIZE / 2;
        const y = r * SQUARE_SIZE + SQUARE_SIZE / 2;
        const grad = ctx.createRadialGradient(x, y, 5, x, y, SQUARE_SIZE * 0.75);
        grad.addColorStop(0, "#ff0033cc");
        grad.addColorStop(0.5, "#ff003360");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(c * SQUARE_SIZE, r * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
    }

    function drawLegalDot(r, c) {
        const x = c * SQUARE_SIZE + SQUARE_SIZE / 2;
        const y = r * SQUARE_SIZE + SQUARE_SIZE / 2;
        ctx.beginPath();
        ctx.arc(x, y, SQUARE_SIZE * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.legalDot;
        ctx.fill();
        // Inner glow
        ctx.beginPath();
        ctx.arc(x, y, SQUARE_SIZE * 0.10, 0, Math.PI * 2);
        ctx.fillStyle = "#00ffe7ff";
        ctx.fill();
    }

    function drawCaptureRing(r, c) {
        const x = c * SQUARE_SIZE + SQUARE_SIZE / 2;
        const y = r * SQUARE_SIZE + SQUARE_SIZE / 2;
        ctx.beginPath();
        ctx.arc(x, y, SQUARE_SIZE * 0.44, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.legalCapture;
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    function drawPieces() {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (!p) continue;
                drawPiece(p, r, c);
            }
        }
    }

    function drawPiece(piece, r, c) {
        const x = c * SQUARE_SIZE + SQUARE_SIZE / 2;
        const y = r * SQUARE_SIZE + SQUARE_SIZE / 2 + 2; // slight vertical center

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const symbol = UNICODE[piece.color][piece.type];

        // Shadow / glow
        ctx.shadowColor = piece.color === WHITE ? "#00ffe7" : "#7b61ff";
        ctx.shadowBlur = 12;
        ctx.font = "bold 52px serif";

        // Draw shadow text
        ctx.fillStyle = piece.color === WHITE ? "#001a2b88" : "#00000088";
        ctx.fillText(symbol, x + 2, y + 3);

        // Main piece
        ctx.shadowBlur = 8;
        ctx.fillStyle = piece.color === WHITE ? COLORS.pieceWhite : COLORS.pieceBlack;
        ctx.fillText(symbol, x, y);

        ctx.restore();
    }

    function drawCoordinates() {
        ctx.save();
        ctx.font = "bold 11px monospace";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = COLORS.coordText;

        for (let i = 0; i < 8; i++) {
            // Ranks on left
            ctx.fillText(8 - i, 3, i * SQUARE_SIZE + SQUARE_SIZE / 2);
            // Files on bottom
            ctx.textAlign = "center";
            ctx.fillText(FILES[i], i * SQUARE_SIZE + SQUARE_SIZE / 2, CANVAS_SIZE - 6);
            ctx.textAlign = "left";
        }
        ctx.restore();
    }

    function drawPromotionOverlay() {
        if (!promotionPending) return;
        const { color } = promotionPending;
        const choices = [QUEEN, ROOK, BISHOP, KNIGHT];

        // Dimmed background
        ctx.fillStyle = COLORS.promoOverlay;
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Panel
        const panelW = 340;
        const panelH = 120;
        const panelX = (CANVAS_SIZE - panelW) / 2;
        const panelY = (CANVAS_SIZE - panelH) / 2;

        ctx.fillStyle = "#0d1b2e";
        ctx.strokeStyle = "#00ffe7";
        ctx.lineWidth = 2;
        roundRect(ctx, panelX, panelY, panelW, panelH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#00ffe7";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("Promote Pawn — Choose Piece", CANVAS_SIZE / 2, panelY + 10);

        // Piece buttons
        const btnSize = 64;
        const totalW = choices.length * (btnSize + 10) - 10;
        const startX = (CANVAS_SIZE - totalW) / 2;
        const btnY = panelY + 36;

        for (let i = 0; i < choices.length; i++) {
            const bx = startX + i * (btnSize + 10);
            ctx.fillStyle = "#162840";
            ctx.strokeStyle = "#7b61ff";
            ctx.lineWidth = 1.5;
            roundRect(ctx, bx, btnY, btnSize, btnSize, 8);
            ctx.fill();
            ctx.stroke();

            ctx.font = "bold 40px serif";
            ctx.fillStyle = color === WHITE ? COLORS.pieceWhite : COLORS.pieceBlack;
            ctx.shadowColor = color === WHITE ? "#00ffe7" : "#7b61ff";
            ctx.shadowBlur = 10;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(UNICODE[color][choices[i]], bx + btnSize / 2, btnY + btnSize / 2);
            ctx.shadowBlur = 0;

            // Store click zones
            promotionPending._zones = promotionPending._zones || [];
            promotionPending._zones[i] = { x: bx, y: btnY, w: btnSize, h: btnSize, type: choices[i] };
        }
    }

    function roundRect(ctx2, x, y, w, h, r) {
        ctx2.beginPath();
        ctx2.moveTo(x + r, y);
        ctx2.lineTo(x + w - r, y);
        ctx2.arcTo(x + w, y, x + w, y + r, r);
        ctx2.lineTo(x + w, y + h - r);
        ctx2.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx2.lineTo(x + r, y + h);
        ctx2.arcTo(x, y + h, x, y + h - r, r);
        ctx2.lineTo(x, y + r);
        ctx2.arcTo(x, y, x + r, y, r);
        ctx2.closePath();
    }

    // ─── Input Handling ───────────────────────────────────────────────────────
    function onCanvasClick(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_SIZE / rect.width;
        const scaleY = CANVAS_SIZE / rect.height;
        const px = (e.clientX - rect.left) * scaleX;
        const py = (e.clientY - rect.top) * scaleY;

        // Handle promotion overlay clicks
        if (promotionPending && promotionPending._zones) {
            for (const zone of promotionPending._zones) {
                if (px >= zone.x && px <= zone.x + zone.w && py >= zone.y && py <= zone.y + zone.h) {
                    handlePromotionChoice(zone.type);
                    return;
                }
            }
            return; // click outside zones — do nothing
        }

        if (gameOver || aiThinking) return;
        if (gameMode === "pve" && currentTurn === BLACK) return;

        const col = Math.floor(px / SQUARE_SIZE);
        const row = Math.floor(py / SQUARE_SIZE);
        if (col < 0 || col > 7 || row < 0 || row > 7) return;

        handleSquareClick(row, col);
    }

    function handleSquareClick(row, col) {
        // If a piece is selected, try to move
        if (selectedSq) {
            // Find matching legal move
            // Prefer non-promotion moves for human (promotion overlay will show)
            const matching = legalMovesCache.filter(
                m => m.to.row === row && m.to.col === col
            );

            if (matching.length > 0) {
                // If promotions, pick one without a type to trigger overlay
                const promoMoves = matching.filter(m => m.promotion);
                const nonPromo = matching.find(m => !m.promotion);

                if (promoMoves.length > 0) {
                    // Show promotion overlay (use first promo move as template)
                    promotionPending = {
                        move: { ...promoMoves[0] },
                        color: board[promoMoves[0].from.row][promoMoves[0].from.col].color,
                        _zones: null,
                    };
                    render();
                    return;
                }
                // Single move
                executeMove(matching[0], false);
                return;
            }

            // Clicked on own piece — reselect
            const clicked = board[row][col];
            if (clicked && clicked.color === currentTurn) {
                selectedSq = { row, col };
                legalMovesCache = legalMovesFor(row, col, board, enPassantTarget, castlingRights);
                render();
                return;
            }

            // Deselect
            selectedSq = null;
            legalMovesCache = [];
            render();
            return;
        }

        // Select a piece
        const piece = board[row][col];
        if (piece && piece.color === currentTurn) {
            selectedSq = { row, col };
            legalMovesCache = legalMovesFor(row, col, board, enPassantTarget, castlingRights);
            render();
        }
    }

    // ─── UI Helpers ───────────────────────────────────────────────────────────
    function updateStatus(msg) {
        const el = document.getElementById("chess-status");
        if (el) el.textContent = msg;
    }

    function updateUI() {
        if (gameOver) return;

        const inCheck = isInCheck(board, currentTurn);
        const turnLabel = currentTurn === WHITE ? "White" : "Black";
        let status = turnLabel + "'s Turn";
        if (inCheck) status += " — CHECK!";
        if (gameMode === "pve" && currentTurn === BLACK) status = "AI Thinking...";
        updateStatus(status);

        updateMoveHistory();
        updateCaptured();
    }

    function updateMoveHistory() {
        const el = document.getElementById("chess-move-history");
        if (!el) return;
        const last10 = moveHistory.slice(-10);
        el.innerHTML = last10.map(m =>
            `<div class="chess-move-entry">${m}</div>`
        ).join("");
        el.scrollTop = el.scrollHeight;
    }

    function updateCaptured() {
        const wEl = document.getElementById("chess-captured-white");
        const bEl = document.getElementById("chess-captured-black");
        if (wEl) wEl.textContent = capturedByWhite.map(p => UNICODE[p.color][p.type]).join(" ");
        if (bEl) bEl.textContent = capturedByBlack.map(p => UNICODE[p.color][p.type]).join(" ");
    }

    function showOverlay(title, desc, btnText) {
        const overlay = document.getElementById("chess-overlay");
        const titleEl = document.getElementById("chess-overlay-title");
        const descEl = document.getElementById("chess-overlay-desc");
        const btnEl = document.getElementById("chess-overlay-primary");
        if (titleEl) titleEl.textContent = title;
        if (descEl) descEl.textContent = desc;
        if (btnEl) btnEl.textContent = btnText;
        if (overlay) overlay.classList.add("visible");
        updateStatus(title + " " + desc);
    }

    function hideOverlay() {
        const overlay = document.getElementById("chess-overlay");
        if (overlay) overlay.classList.remove("visible");
    }

    // ─── Controls ─────────────────────────────────────────────────────────────
    function newGame() {
        hideOverlay();
        const modeEl = document.getElementById("chess-mode-select");
        const diffEl = document.getElementById("chess-difficulty-select");
        gameMode = modeEl ? modeEl.value : "pve";
        aiDifficulty = diffEl ? diffEl.value : "medium";
        initBoard();
    }

    // ─── Public Init ──────────────────────────────────────────────────────────
    window.initChessGame = function () {
        canvas = document.getElementById("chess-canvas");
        if (!canvas) { console.error("chess-canvas not found"); return; }

        // Pre-load Stockfish so it's ready when Hard mode is selected
        initStockfish();

        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        ctx = canvas.getContext("2d");

        canvas.addEventListener("click", onCanvasClick);

        // New Game button
        const newGameBtn = document.getElementById("chess-newgame-btn");
        if (newGameBtn) newGameBtn.addEventListener("click", newGame);

        // Overlay primary button
        const overlayBtn = document.getElementById("chess-overlay-primary");
        if (overlayBtn) overlayBtn.addEventListener("click", newGame);

        // Mode/difficulty changes
        const modeEl = document.getElementById("chess-mode-select");
        const diffEl = document.getElementById("chess-difficulty-select");
        if (modeEl) modeEl.addEventListener("change", () => { /* no auto-restart */ });
        if (diffEl) diffEl.addEventListener("change", () => { /* no auto-restart */ });

        newGame();
    };

})();
