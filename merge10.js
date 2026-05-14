(function () {
    "use strict";

    const ROWS = 16;
    const COLS = 10;
    const CELL_COUNT = ROWS * COLS;
    const TEN = 10;

    let merge10Controller = null;
    let tenHelperController = null;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function sleep(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    function blankGrid() {
        return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0));
    }

    function cloneGrid(grid) {
        return grid.map((row) => row.slice());
    }

    function gridToFlat(grid) {
        const flat = new Array(CELL_COUNT).fill(0);
        for (let r = 0; r < ROWS; r += 1) {
            for (let c = 0; c < COLS; c += 1) {
                const raw = grid?.[r]?.[c];
                const value = Number(raw);
                flat[r * COLS + c] = Number.isFinite(value) ? clamp(Math.floor(value), 0, 9) : 0;
            }
        }
        return flat;
    }

    function flatToGrid(flat) {
        const grid = [];
        for (let r = 0; r < ROWS; r += 1) {
            grid.push(flat.slice(r * COLS, r * COLS + COLS));
        }
        return grid;
    }

    function flatKey(flat) {
        return flat.join("");
    }

    function mulberry32(seed) {
        let t = seed >>> 0;
        return function () {
            t += 0x6D2B79F5;
            let x = t;
            x = Math.imul(x ^ (x >>> 15), x | 1);
            x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
            return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
        };
    }

    function randomGrid(seed) {
        const random = Number.isFinite(seed) ? mulberry32(seed) : Math.random;
        const grid = [];
        for (let r = 0; r < ROWS; r += 1) {
            const row = [];
            for (let c = 0; c < COLS; c += 1) {
                row.push(1 + Math.floor(random() * 9));
            }
            grid.push(row);
        }
        return grid;
    }

    function randomPlayableGrid() {
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const grid = randomGrid();
            if (generateMoves(gridToFlat(grid)).length > 0) {
                return grid;
            }
        }
        return demoGrid();
    }

    function demoGrid() {
        const pattern = [
            [1, 9, 2, 8, 3, 7, 4, 6, 5, 5],
            [2, 3, 5, 1, 4, 5, 6, 4, 7, 3],
            [8, 1, 1, 9, 2, 2, 3, 7, 4, 6],
            [6, 4, 5, 5, 7, 3, 8, 2, 9, 1],
        ];
        const grid = [];
        for (let r = 0; r < ROWS; r += 1) {
            grid.push(pattern[r % pattern.length].slice());
        }
        return grid;
    }

    function normalizeRect(a, b) {
        return {
            r1: Math.min(a.r, b.r),
            c1: Math.min(a.c, b.c),
            r2: Math.max(a.r, b.r),
            c2: Math.max(a.c, b.c),
        };
    }

    function buildPrefix(flat) {
        const ps = Array.from({ length: ROWS + 1 }, () => new Array(COLS + 1).fill(0));
        for (let r = 0; r < ROWS; r += 1) {
            let running = 0;
            for (let c = 0; c < COLS; c += 1) {
                running += flat[r * COLS + c];
                ps[r + 1][c + 1] = ps[r][c + 1] + running;
            }
        }
        return ps;
    }

    function rectSumFromPrefix(ps, rect) {
        return ps[rect.r2 + 1][rect.c2 + 1] - ps[rect.r1][rect.c2 + 1] -
            ps[rect.r2 + 1][rect.c1] + ps[rect.r1][rect.c1];
    }

    function collectRectCells(flat, rect) {
        const indices = [];
        const values = [];
        for (let r = rect.r1; r <= rect.r2; r += 1) {
            for (let c = rect.c1; c <= rect.c2; c += 1) {
                const index = r * COLS + c;
                const value = flat[index];
                if (value > 0) {
                    indices.push(index);
                    values.push(value);
                }
            }
        }
        return { indices, values };
    }

    function describeSelection(flat, rect) {
        const cells = collectRectCells(flat, rect);
        return {
            rect,
            sum: cells.values.reduce((total, value) => total + value, 0),
            indices: cells.indices,
            values: cells.values,
            count: cells.indices.length,
        };
    }

    function generateMoves(flat) {
        const ps = buildPrefix(flat);
        const byCells = new Map();
        for (let r1 = 0; r1 < ROWS; r1 += 1) {
            for (let r2 = r1; r2 < ROWS; r2 += 1) {
                for (let c1 = 0; c1 < COLS; c1 += 1) {
                    for (let c2 = c1; c2 < COLS; c2 += 1) {
                        const rect = { r1, c1, r2, c2 };
                        if (rectSumFromPrefix(ps, rect) !== TEN) {
                            continue;
                        }
                        const cells = collectRectCells(flat, rect);
                        if (!cells.indices.length) {
                            continue;
                        }
                        const key = cells.indices.join(",");
                        const area = (r2 - r1 + 1) * (c2 - c1 + 1);
                        const move = {
                            rect,
                            indices: cells.indices,
                            values: cells.values,
                            removedCount: cells.indices.length,
                            area,
                        };
                        const old = byCells.get(key);
                        if (!old || move.area < old.area) {
                            byCells.set(key, move);
                        }
                    }
                }
            }
        }
        return Array.from(byCells.values());
    }

    function applyMove(flat, move) {
        const next = flat.slice();
        move.indices.forEach((index) => {
            next[index] = 0;
        });
        return next;
    }

    function moveScore(move, scoreMode) {
        return scoreMode === "moves" ? 1 : move.removedCount;
    }

    function totalNonZero(flat) {
        return flat.reduce((total, value) => total + (value > 0 ? 1 : 0), 0);
    }

    function formatMove(move, index, scoreMode) {
        const removedCells = move.indices.map((cellIndex, offset) => {
            const r = Math.floor(cellIndex / COLS);
            const c = cellIndex % COLS;
            return { r, c, r1: r + 1, c1: c + 1, value: move.values[offset] };
        });
        const cellText = removedCells.map((cell) => `R${cell.r1}C${cell.c1}=${cell.value}`).join(" + ");
        return {
            index,
            rect: { ...move.rect },
            rect_1_based: {
                r1: move.rect.r1 + 1,
                c1: move.rect.c1 + 1,
                r2: move.rect.r2 + 1,
                c2: move.rect.c2 + 1,
            },
            removed_cells: removedCells,
            sum: TEN,
            score_delta: moveScore(move, scoreMode),
            text: `框选 R${move.rect.r1 + 1}C${move.rect.c1 + 1} 到 R${move.rect.r2 + 1}C${move.rect.c2 + 1}；消除：${cellText}；和=10`,
        };
    }

    function serializeSolution(initialFlat, moves, scoreMode, params, stoppedByTime) {
        const totalSum = initialFlat.reduce((total, value) => total + value, 0);
        const initialCellCount = totalNonZero(initialFlat);
        const formattedMoves = moves.map((move, index) => formatMove(move, index + 1, scoreMode));
        const totalRemovedCells = formattedMoves.reduce((total, move) => total + move.removed_cells.length, 0);
        const totalScore = formattedMoves.reduce((total, move) => total + move.score_delta, 0);
        const maxPossibleMoves = Math.floor(totalSum / TEN);
        const theoreticalBest = scoreMode === "moves"
            ? totalScore >= maxPossibleMoves
            : totalRemovedCells >= initialCellCount;
        return {
            rows: ROWS,
            cols: COLS,
            score_mode: scoreMode,
            initial_grid: flatToGrid(initialFlat),
            moves: formattedMoves,
            total_moves: formattedMoves.length,
            total_removed_cells: totalRemovedCells,
            total_score: totalScore,
            theoretical_best: theoreticalBest,
            stopped_by_time: Boolean(stoppedByTime),
            total_sum: totalSum,
            max_possible_moves: maxPossibleMoves,
            params,
        };
    }

    function solveMerge10Grid(grid, options = {}) {
        const scoreMode = options.scoreMode === "moves" ? "moves" : "cells";
        const beamWidth = clamp(Math.floor(Number(options.beamWidth) || 300), 20, 2000);
        const timeLimit = clamp(Number(options.timeLimit) || 2, 0.2, 30);
        const started = performance.now();
        const deadline = started + timeLimit * 1000;
        const initialFlat = gridToFlat(grid);
        const moveCache = new Map();
        const maxDepth = Math.max(1, Math.floor(initialFlat.reduce((total, value) => total + value, 0) / TEN));
        let stoppedByTime = false;
        let best = {
            flat: initialFlat,
            score: 0,
            removed: 0,
            moves: [],
        };

        function timedOut() {
            const out = performance.now() >= deadline;
            if (out) stoppedByTime = true;
            return out;
        }

        function movesFor(flat) {
            const key = flatKey(flat);
            const cached = moveCache.get(key);
            if (cached) return cached;
            const moves = generateMoves(flat);
            if (moveCache.size > 2500) {
                moveCache.clear();
            }
            moveCache.set(key, moves);
            return moves;
        }

        function isBetter(candidate, current = best) {
            return candidate.score > current.score ||
                (candidate.score === current.score && candidate.removed > current.removed) ||
                (candidate.score === current.score && candidate.removed === current.removed && candidate.moves.length > current.moves.length);
        }

        function updateBest(state) {
            if (isBetter(state)) {
                best = state;
            }
        }

        function rankMove(move, strategy) {
            const scoreDelta = moveScore(move, scoreMode);
            if (strategy === "tight") {
                return scoreDelta * 160 + move.removedCount * 30 - move.area * 1.6;
            }
            if (strategy === "wide") {
                return scoreDelta * 135 + move.area * 0.12 + move.removedCount * 28;
            }
            if (strategy === "few") {
                return -move.removedCount * 38 - move.area * 0.2;
            }
            return scoreDelta * 180 + move.removedCount * 42 - move.area * 0.55;
        }

        function takeMove(state, move) {
            return {
                flat: applyMove(state.flat, move),
                score: state.score + moveScore(move, scoreMode),
                removed: state.removed + move.removedCount,
                moves: state.moves.concat(move),
            };
        }

        function runGreedy(strategy) {
            let state = { flat: initialFlat, score: 0, removed: 0, moves: [] };
            for (let depth = 0; depth < maxDepth && !timedOut(); depth += 1) {
                const moves = movesFor(state.flat);
                if (!moves.length) {
                    updateBest(state);
                    return;
                }
                const move = moves.reduce((picked, candidate) => {
                    if (!picked) return candidate;
                    return rankMove(candidate, strategy) > rankMove(picked, strategy) ? candidate : picked;
                }, null);
                state = takeMove(state, move);
                updateBest(state);
            }
        }

        ["balanced", "tight", "wide", "few"].forEach((strategy) => {
            if (!timedOut()) runGreedy(strategy);
        });

        let layer = [{ flat: initialFlat, score: 0, removed: 0, moves: [] }];
        for (let depth = 0; depth < maxDepth && layer.length && !timedOut(); depth += 1) {
            const candidates = new Map();
            for (const state of layer) {
                if (timedOut()) break;
                const moves = movesFor(state.flat);
                if (!moves.length) {
                    updateBest(state);
                    continue;
                }
                const perStateLimit = Math.min(moves.length, Math.max(45, Math.floor(beamWidth / 5)));
                const topMoves = moves
                    .slice()
                    .sort((a, b) => rankMove(b, "balanced") - rankMove(a, "balanced"))
                    .slice(0, perStateLimit);
                for (const move of topMoves) {
                    const nextState = takeMove(state, move);
                    const key = flatKey(nextState.flat);
                    const old = candidates.get(key);
                    if (!old || isBetter(nextState, old)) {
                        candidates.set(key, nextState);
                    }
                    updateBest(nextState);
                    if (timedOut()) break;
                }
            }

            layer = Array.from(candidates.values())
                .sort((a, b) => {
                    const aMoves = a.moves.length;
                    const bMoves = b.moves.length;
                    return (b.score * 10000 + b.removed * 120 + bMoves * 14) -
                        (a.score * 10000 + a.removed * 120 + aMoves * 14);
                })
                .slice(0, beamWidth);
        }

        return serializeSolution(initialFlat, best.moves, scoreMode, {
            beam_width: beamWidth,
            time_limit: timeLimit,
        }, stoppedByTime);
    }

    function downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function loadScriptOnce(src, globalName) {
        if (globalName && window[globalName]) {
            return Promise.resolve(window[globalName]);
        }
        const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
        if (existing) {
            return new Promise((resolve, reject) => {
                existing.addEventListener("load", () => resolve(globalName ? window[globalName] : true), { once: true });
                existing.addEventListener("error", reject, { once: true });
            });
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.dataset.dynamicSrc = src;
            script.onload = () => resolve(globalName ? window[globalName] : true);
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    }

    function luminance(r, g, b) {
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    function saturation(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return max === 0 ? 0 : (max - min) / max;
    }

    function normalizeCrop(rect, width, height) {
        const x1 = clamp(Math.min(rect.x, rect.x + rect.w), 0, width);
        const y1 = clamp(Math.min(rect.y, rect.y + rect.h), 0, height);
        const x2 = clamp(Math.max(rect.x, rect.x + rect.w), 0, width);
        const y2 = clamp(Math.max(rect.y, rect.y + rect.h), 0, height);
        return {
            x: x1,
            y: y1,
            w: Math.max(8, x2 - x1),
            h: Math.max(8, y2 - y1),
        };
    }

    function defaultOcrCrop(width, height) {
        const aspect = COLS / ROWS;
        const imageAspect = width / Math.max(1, height);
        if (Math.abs(imageAspect - aspect) < 0.16) {
            const pad = Math.max(3, Math.min(width, height) * 0.018);
            return { x: pad, y: pad, w: width - pad * 2, h: height - pad * 2 };
        }
        let cropH = height * 0.68;
        let cropW = cropH * aspect;
        if (cropW > width * 0.9) {
            cropW = width * 0.9;
            cropH = cropW / aspect;
        }
        const x = (width - cropW) / 2;
        const y = Math.max(0, Math.min(height - cropH, height * 0.16));
        return { x, y, w: cropW, h: cropH };
    }

    function connectedComponents(mask, width, height) {
        const visited = new Uint8Array(mask.length);
        const components = [];
        const stack = [];
        for (let i = 0; i < mask.length; i += 1) {
            if (!mask[i] || visited[i]) continue;
            visited[i] = 1;
            stack.length = 0;
            stack.push(i);
            let area = 0;
            let minX = width;
            let minY = height;
            let maxX = 0;
            let maxY = 0;
            while (stack.length) {
                const p = stack.pop();
                const x = p % width;
                const y = Math.floor(p / width);
                area += 1;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
                const neighbors = [p - 1, p + 1, p - width, p + width];
                for (const n of neighbors) {
                    if (n < 0 || n >= mask.length || visited[n] || !mask[n]) continue;
                    const nx = n % width;
                    if (Math.abs(nx - x) > 1) continue;
                    visited[n] = 1;
                    stack.push(n);
                }
            }
            components.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
        }
        return components;
    }

    function median(values) {
        if (!values.length) return 0;
        const sorted = values.slice().sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
    }

    function detectBrightTileCrop(canvas) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const { width, height } = canvas;
        const data = ctx.getImageData(0, 0, width, height).data;
        const mask = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i += 1) {
            const offset = i * 4;
            const y = Math.floor(i / width);
            if (y < height * 0.06) continue;
            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];
            const lum = luminance(r, g, b);
            if (lum > 148 && saturation(r, g, b) < 0.42) {
                mask[i] = 1;
            }
        }
        const imageArea = width * height;
        const boxes = connectedComponents(mask, width, height).filter((box) => {
            const ar = box.w / Math.max(1, box.h);
            const boxArea = box.w * box.h;
            return ar >= 0.5 && ar <= 1.65 &&
                boxArea >= imageArea * 0.00012 &&
                boxArea <= imageArea * 0.009 &&
                box.w >= 7 && box.h >= 7;
        });
        if (boxes.length < 50) return null;
        const medArea = median(boxes.map((box) => box.w * box.h));
        const chosen = boxes
            .slice()
            .sort((a, b) => Math.abs(a.w * a.h - medArea) - Math.abs(b.w * b.h - medArea))
            .slice(0, Math.min(CELL_COUNT, boxes.length));
        const minX = Math.min(...chosen.map((box) => box.x));
        const minY = Math.min(...chosen.map((box) => box.y));
        const maxX = Math.max(...chosen.map((box) => box.x + box.w));
        const maxY = Math.max(...chosen.map((box) => box.y + box.h));
        const pad = Math.max(4, Math.min(maxX - minX, maxY - minY) * 0.025);
        return normalizeCrop({ x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }, width, height);
    }

    function drawOcrCanvas(canvas, imageCanvas, cropRect) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageCanvas, 0, 0);
        if (!cropRect) return;
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
        ctx.drawImage(imageCanvas, cropRect.x, cropRect.y, cropRect.w, cropRect.h, cropRect.x, cropRect.y, cropRect.w, cropRect.h);
        ctx.strokeStyle = "#ffd166";
        ctx.lineWidth = Math.max(2, Math.round(canvas.width / 360));
        ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
        ctx.fillStyle = "rgba(255, 209, 102, 0.16)";
        ctx.fillRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
        ctx.restore();
    }

    function fitMask(rawMask, rawWidth, rawHeight, targetWidth, targetHeight) {
        let minX = rawWidth;
        let minY = rawHeight;
        let maxX = -1;
        let maxY = -1;
        let count = 0;
        for (let y = 0; y < rawHeight; y += 1) {
            for (let x = 0; x < rawWidth; x += 1) {
                if (!rawMask[y * rawWidth + x]) continue;
                count += 1;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
        const fitted = new Uint8Array(targetWidth * targetHeight);
        if (count < 6) {
            return { mask: fitted, count: 0 };
        }
        const boxW = Math.max(1, maxX - minX + 1);
        const boxH = Math.max(1, maxY - minY + 1);
        const scale = Math.min((targetWidth - 10) / boxW, (targetHeight - 10) / boxH);
        const offX = (targetWidth - boxW * scale) / 2;
        const offY = (targetHeight - boxH * scale) / 2;
        for (let y = minY; y <= maxY; y += 1) {
            for (let x = minX; x <= maxX; x += 1) {
                if (!rawMask[y * rawWidth + x]) continue;
                const tx = clamp(Math.round((x - minX) * scale + offX), 0, targetWidth - 1);
                const ty = clamp(Math.round((y - minY) * scale + offY), 0, targetHeight - 1);
                fitted[ty * targetWidth + tx] = 1;
            }
        }
        return { mask: fitted, count };
    }

    function dilateMask(mask, width, height) {
        const out = new Uint8Array(mask.length);
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                if (!mask[y * width + x]) continue;
                for (let dy = -1; dy <= 1; dy += 1) {
                    for (let dx = -1; dx <= 1; dx += 1) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            out[ny * width + nx] = 1;
                        }
                    }
                }
            }
        }
        return out;
    }

    const OCR_TEMPLATE_WIDTH = 72;
    const OCR_TEMPLATE_HEIGHT = 96;
    let digitTemplates = null;

    function createDigitTemplates() {
        if (digitTemplates) return digitTemplates;
        const fonts = [
            "900 76px Arial",
            "800 74px Helvetica",
            "900 74px system-ui",
            "800 72px Verdana",
            "900 74px sans-serif",
        ];
        digitTemplates = [];
        for (const font of fonts) {
            for (let digit = 1; digit <= 9; digit += 1) {
                const canvas = document.createElement("canvas");
                canvas.width = 120;
                canvas.height = 140;
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.font = font;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "#000";
                ctx.fillText(String(digit), canvas.width / 2, canvas.height / 2 + 4);
                const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                const raw = new Uint8Array(canvas.width * canvas.height);
                for (let i = 0; i < raw.length; i += 1) {
                    const offset = i * 4;
                    if (luminance(data[offset], data[offset + 1], data[offset + 2]) < 170) {
                        raw[i] = 1;
                    }
                }
                const fitted = fitMask(raw, canvas.width, canvas.height, OCR_TEMPLATE_WIDTH, OCR_TEMPLATE_HEIGHT);
                digitTemplates.push({
                    digit,
                    mask: fitted.mask,
                    count: fitted.mask.reduce((total, value) => total + value, 0),
                    dilated: dilateMask(fitted.mask, OCR_TEMPLATE_WIDTH, OCR_TEMPLATE_HEIGHT),
                });
            }
        }
        return digitTemplates;
    }

    function makeCellCanvas(sourceCanvas, rect, size = 96) {
        const cellCanvas = document.createElement("canvas");
        cellCanvas.width = size;
        cellCanvas.height = size;
        const ctx = cellCanvas.getContext("2d");
        const padX = rect.w * 0.16;
        const padY = rect.h * 0.16;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(
            sourceCanvas,
            rect.x + padX,
            rect.y + padY,
            Math.max(1, rect.w - padX * 2),
            Math.max(1, rect.h - padY * 2),
            0,
            0,
            size,
            size
        );
        return cellCanvas;
    }

    function normalizedMaskFromCellCanvas(cellCanvas) {
        const ctx = cellCanvas.getContext("2d", { willReadFrequently: true });
        const { width, height } = cellCanvas;
        const image = ctx.getImageData(0, 0, width, height);
        const lums = [];
        for (let i = 0; i < image.data.length; i += 4) {
            lums.push(luminance(image.data[i], image.data[i + 1], image.data[i + 2]));
        }
        const mean = lums.reduce((total, value) => total + value, 0) / Math.max(1, lums.length);
        const minLum = Math.min(...lums);
        const maxLum = Math.max(...lums);
        const lightInk = mean < 126;
        const threshold = lightInk ? Math.max(135, mean + (maxLum - mean) * 0.34) : Math.min(165, mean - (mean - minLum) * 0.34);
        const raw = new Uint8Array(width * height);
        for (let i = 0; i < lums.length; i += 1) {
            raw[i] = lightInk ? (lums[i] > threshold ? 1 : 0) : (lums[i] < threshold ? 1 : 0);
        }
        return fitMask(raw, width, height, OCR_TEMPLATE_WIDTH, OCR_TEMPLATE_HEIGHT);
    }

    function maskToCanvas(mask, width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        const image = ctx.createImageData(width, height);
        for (let i = 0; i < mask.length; i += 1) {
            const offset = i * 4;
            const value = mask[i] ? 0 : 255;
            image.data[offset] = value;
            image.data[offset + 1] = value;
            image.data[offset + 2] = value;
            image.data[offset + 3] = 255;
        }
        ctx.putImageData(image, 0, 0);
        return canvas;
    }

    function cleanDigitMask(rawMask, width, height) {
        const components = connectedComponents(rawMask, width, height);
        const cleaned = new Uint8Array(rawMask.length);
        const cellArea = width * height;
        let kept = 0;
        components.forEach((component) => {
            const cx = component.x + component.w / 2;
            const cy = component.y + component.h / 2;
            const areaRatio = component.area / cellArea;
            const heightRatio = component.h / height;
            const widthRatio = component.w / width;
            const central = cx > width * 0.12 && cx < width * 0.88 && cy > height * 0.08 && cy < height * 0.92;
            const plausible =
                areaRatio >= 0.003 &&
                areaRatio <= 0.26 &&
                heightRatio >= 0.16 &&
                heightRatio <= 0.86 &&
                widthRatio >= 0.035 &&
                widthRatio <= 0.72 &&
                central;
            if (!plausible) return;
            for (let y = component.y; y < component.y + component.h; y += 1) {
                for (let x = component.x; x < component.x + component.w; x += 1) {
                    const index = y * width + x;
                    if (rawMask[index]) {
                        cleaned[index] = 1;
                        kept += 1;
                    }
                }
            }
        });
        return { mask: cleaned, count: kept };
    }

    function classifyDigitTemplate(cellCanvas) {
        const ctx = cellCanvas.getContext("2d", { willReadFrequently: true });
        const { width, height } = cellCanvas;
        const image = ctx.getImageData(0, 0, width, height);
        const lums = [];
        const sats = [];
        for (let i = 0; i < image.data.length; i += 4) {
            const r = image.data[i];
            const g = image.data[i + 1];
            const b = image.data[i + 2];
            lums.push(luminance(r, g, b));
            sats.push(saturation(r, g, b));
        }
        const mean = lums.reduce((total, value) => total + value, 0) / Math.max(1, lums.length);
        const candidates = [];

        const darkRaw = new Uint8Array(width * height);
        const lightRaw = new Uint8Array(width * height);
        for (let i = 0; i < lums.length; i += 1) {
            if (lums[i] < Math.min(150, mean - 18) && sats[i] < 0.72) {
                darkRaw[i] = 1;
            }
            if (lums[i] > Math.max(145, mean + 28) && sats[i] < 0.58) {
                lightRaw[i] = 1;
            }
        }

        const darkClean = cleanDigitMask(darkRaw, width, height);
        const lightClean = cleanDigitMask(lightRaw, width, height);
        if (darkClean.count >= 8) {
            candidates.push(fitMask(darkClean.mask, width, height, OCR_TEMPLATE_WIDTH, OCR_TEMPLATE_HEIGHT));
        }
        if (lightClean.count >= 8) {
            candidates.push(fitMask(lightClean.mask, width, height, OCR_TEMPLATE_WIDTH, OCR_TEMPLATE_HEIGHT));
        }
        if (!candidates.length) {
            candidates.push(normalizedMaskFromCellCanvas(cellCanvas));
        }

        let bestResult = { value: 0, confidence: 0, margin: 0, canvas: maskToCanvas(new Uint8Array(OCR_TEMPLATE_WIDTH * OCR_TEMPLATE_HEIGHT), OCR_TEMPLATE_WIDTH, OCR_TEMPLATE_HEIGHT) };
        for (const normalized of candidates) {
            const result = classifyNormalizedDigitMask(normalized);
            if (result.confidence > bestResult.confidence) {
                bestResult = result;
            }
        }
        return bestResult;
    }

    function classifyNormalizedDigitMask(normalized) {
        if (normalized.count < 8) {
            return { value: 0, confidence: 0, margin: 0, canvas: maskToCanvas(normalized.mask, OCR_TEMPLATE_WIDTH, OCR_TEMPLATE_HEIGHT) };
        }
        const inputMask = normalized.mask;
        const inputDilated = dilateMask(inputMask, OCR_TEMPLATE_WIDTH, OCR_TEMPLATE_HEIGHT);
        const inputCount = inputMask.reduce((total, value) => total + value, 0);
        const scores = new Map();
        for (const template of createDigitTemplates()) {
            let inputCovered = 0;
            let templateCovered = 0;
            for (let i = 0; i < inputMask.length; i += 1) {
                if (inputMask[i] && template.dilated[i]) inputCovered += 1;
                if (template.mask[i] && inputDilated[i]) templateCovered += 1;
            }
            const score = (inputCovered / Math.max(1, inputCount) + templateCovered / Math.max(1, template.count)) / 2;
            scores.set(template.digit, Math.max(scores.get(template.digit) || 0, score));
        }
        const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
        const best = ranked[0] || [0, 0];
        const second = ranked[1] || [0, 0];
        const margin = best[1] - second[1];
        const confidence = clamp(best[1] * 0.88 + Math.min(0.12, margin * 2.4), 0, 1);
        return {
            value: best[0],
            confidence,
            margin,
            canvas: maskToCanvas(normalized.mask, OCR_TEMPLATE_WIDTH, OCR_TEMPLATE_HEIGHT),
        };
    }

    async function recognizeDigitDeep(cellCanvas, statusCallback) {
        const Tesseract = await loadScriptOnce("https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js", "Tesseract");
        if (!Tesseract?.createWorker) {
            throw new Error("Tesseract.js unavailable");
        }
        if (!recognizeDigitDeep.worker) {
            statusCallback?.("Loading Deep OCR...");
            recognizeDigitDeep.worker = await Tesseract.createWorker("eng", 1, {
                logger: (message) => {
                    if (message?.status && Number.isFinite(message.progress)) {
                        statusCallback?.(`${message.status} ${Math.round(message.progress * 100)}%`);
                    }
                },
            });
            await recognizeDigitDeep.worker.setParameters({
                tessedit_char_whitelist: "0123456789",
                tessedit_pageseg_mode: "10",
            });
        }
        const result = await recognizeDigitDeep.worker.recognize(cellCanvas);
        const text = result?.data?.text || "";
        const match = text.match(/[1-9]/);
        return {
            value: match ? Number(match[0]) : 0,
            confidence: (Number(result?.data?.confidence) || 0) / 100,
        };
    }
    recognizeDigitDeep.worker = null;

    class Merge10Game {
        constructor() {
            this.boardEl = document.getElementById("merge10-board");
            this.statusEl = document.getElementById("merge10-status");
            this.scoreEl = document.getElementById("merge10-score");
            this.bestEl = document.getElementById("merge10-best");
            this.timeEl = document.getElementById("merge10-time");
            this.durationEl = document.getElementById("merge10-duration");
            this.scoreModeEl = document.getElementById("merge10-score-mode");
            this.startBtn = document.getElementById("merge10-start-btn");
            this.pauseBtn = document.getElementById("merge10-pause-btn");
            this.newBoardBtn = document.getElementById("merge10-new-board-btn");
            this.selectionSumEl = document.getElementById("merge10-selection-sum");
            this.selectionCellsEl = document.getElementById("merge10-selection-cells");
            this.movesEl = document.getElementById("merge10-moves");
            this.removedEl = document.getElementById("merge10-removed");
            this.overlay = document.getElementById("merge10-overlay");
            this.overlayTitle = document.getElementById("merge10-overlay-title");
            this.overlayDesc = document.getElementById("merge10-overlay-desc");
            this.overlayPrimary = document.getElementById("merge10-overlay-primary");

            this.flat = gridToFlat(randomPlayableGrid());
            this.cells = [];
            this.score = 0;
            this.moves = 0;
            this.removed = 0;
            this.remaining = this.readDuration();
            this.playing = false;
            this.paused = false;
            this.pointerDown = false;
            this.selectionStart = null;
            this.selectionEnd = null;
            this.selectionState = "neutral";
            this.lastFrame = null;
            this.rafId = null;
        }

        init() {
            this.ensureCells();
            this.attachEvents();
            this.updateBest();
            this.render();
            this.showOverlay("Ready", "Choose a countdown, then start.", "Start");
        }

        readDuration() {
            return clamp(Number(this.durationEl?.value || 60), 10, 600);
        }

        scoreMode() {
            return this.scoreModeEl?.value === "moves" ? "moves" : "cells";
        }

        bestKey() {
            return `merge10_best_${this.scoreMode()}_${this.readDuration()}`;
        }

        loadBest() {
            const raw = window.localStorage.getItem(this.bestKey());
            const value = Number(raw);
            return Number.isFinite(value) ? value : 0;
        }

        saveBest() {
            const best = this.loadBest();
            if (this.score > best) {
                window.localStorage.setItem(this.bestKey(), String(this.score));
            }
            this.updateBest();
        }

        updateBest() {
            if (this.bestEl) {
                this.bestEl.textContent = String(this.loadBest());
            }
        }

        ensureCells() {
            if (!this.boardEl || this.cells.length === CELL_COUNT) return;
            this.boardEl.innerHTML = "";
            const fragment = document.createDocumentFragment();
            for (let index = 0; index < CELL_COUNT; index += 1) {
                const cell = document.createElement("button");
                cell.type = "button";
                cell.className = "merge10-cell";
                cell.dataset.index = String(index);
                cell.ariaLabel = `R${Math.floor(index / COLS) + 1}C${index % COLS + 1}`;
                fragment.appendChild(cell);
                this.cells.push(cell);
            }
            this.boardEl.appendChild(fragment);
        }

        attachEvents() {
            this.boardEl.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
            this.boardEl.addEventListener("pointermove", (event) => this.handlePointerMove(event));
            this.boardEl.addEventListener("pointerup", (event) => this.handlePointerUp(event));
            this.boardEl.addEventListener("pointercancel", () => this.clearSelection());
            this.startBtn.addEventListener("click", () => this.startGame(true));
            this.pauseBtn.addEventListener("click", () => this.togglePause());
            this.newBoardBtn.addEventListener("click", () => this.resetBoard(false));
            this.durationEl.addEventListener("input", () => {
                if (!this.playing) {
                    this.remaining = this.readDuration();
                    this.updateBest();
                    this.renderStats();
                }
            });
            this.scoreModeEl.addEventListener("change", () => {
                if (!this.playing) {
                    this.updateBest();
                }
            });
        }

        startGame(newBoard) {
            if (newBoard) {
                this.flat = gridToFlat(randomPlayableGrid());
            }
            this.score = 0;
            this.moves = 0;
            this.removed = 0;
            this.remaining = this.readDuration();
            this.playing = true;
            this.paused = false;
            this.lastFrame = null;
            this.hideOverlay();
            this.clearSelection();
            this.render();
            this.loop();
        }

        resetBoard(showReady = true) {
            this.flat = gridToFlat(randomPlayableGrid());
            this.score = 0;
            this.moves = 0;
            this.removed = 0;
            this.remaining = this.readDuration();
            this.playing = false;
            this.paused = false;
            this.clearSelection();
            this.render();
            if (showReady) {
                this.showOverlay("Ready", "Fresh board loaded.", "Start");
            } else {
                this.showOverlay("New Board", "Fresh board loaded.", "Start");
            }
        }

        loop(timestamp) {
            if (!this.playing) return;
            if (this.rafId) window.cancelAnimationFrame(this.rafId);
            this.rafId = window.requestAnimationFrame((nextTimestamp) => {
                if (this.lastFrame === null) this.lastFrame = nextTimestamp;
                const dt = Math.min((nextTimestamp - this.lastFrame) / 1000, 0.1);
                this.lastFrame = nextTimestamp;
                this.advanceSeconds(dt);
                this.loop(nextTimestamp);
            });
        }

        advanceSeconds(dt) {
            if (!this.playing || this.paused) {
                this.renderStats();
                return;
            }
            this.remaining = Math.max(0, this.remaining - dt);
            if (this.remaining <= 0) {
                this.endGame("Time Up");
            } else {
                this.renderStats();
            }
        }

        advanceTime(ms) {
            this.advanceSeconds(ms / 1000);
            this.render();
        }

        endGame(title) {
            this.playing = false;
            this.paused = false;
            if (this.rafId) {
                window.cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
            this.saveBest();
            this.renderStats();
            this.showOverlay(title, `Score ${this.score} · Moves ${this.moves} · Removed ${this.removed}`, "Play Again");
        }

        togglePause() {
            if (!this.playing) return;
            this.paused = !this.paused;
            this.statusEl.textContent = this.paused ? "Paused" : "Playing";
            this.pauseBtn.textContent = this.paused ? "Resume" : "Pause";
            if (this.paused) {
                this.showOverlay("Paused", `Score ${this.score}`, "Resume");
                this.overlayPrimary.onclick = () => {
                    this.paused = false;
                    this.pauseBtn.textContent = "Pause";
                    this.hideOverlay();
                };
            } else {
                this.hideOverlay();
            }
        }

        showOverlay(title, desc, buttonText) {
            if (!this.overlay) return;
            this.overlayTitle.textContent = title;
            this.overlayDesc.textContent = desc;
            this.overlayPrimary.textContent = buttonText;
            this.overlayPrimary.onclick = () => this.startGame(true);
            this.overlay.classList.add("visible");
        }

        hideOverlay() {
            this.overlay?.classList.remove("visible");
        }

        cellFromEvent(event) {
            const rect = this.boardEl.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
            const col = clamp(Math.floor((x / rect.width) * COLS), 0, COLS - 1);
            const row = clamp(Math.floor((y / rect.height) * ROWS), 0, ROWS - 1);
            return { r: row, c: col };
        }

        handlePointerDown(event) {
            if (!this.playing || this.paused) return;
            const cell = this.cellFromEvent(event);
            if (!cell) return;
            event.preventDefault();
            this.pointerDown = true;
            this.selectionStart = cell;
            this.selectionEnd = cell;
            this.selectionState = "neutral";
            this.boardEl.setPointerCapture?.(event.pointerId);
            this.render();
        }

        handlePointerMove(event) {
            if (!this.pointerDown || !this.selectionStart) return;
            const cell = this.cellFromEvent(event);
            if (!cell) return;
            this.selectionEnd = cell;
            const selection = this.currentSelection();
            this.selectionState = selection.sum === TEN && selection.count > 0 ? "valid" : "neutral";
            this.render();
        }

        handlePointerUp(event) {
            if (!this.pointerDown || !this.selectionStart) return;
            const cell = this.cellFromEvent(event);
            if (cell) {
                this.selectionEnd = cell;
            }
            const selection = this.currentSelection();
            this.pointerDown = false;
            if (selection.sum === TEN && selection.count > 0) {
                selection.indices.forEach((index) => {
                    this.flat[index] = 0;
                });
                const delta = this.scoreMode() === "moves" ? 1 : selection.count;
                this.score += delta;
                this.moves += 1;
                this.removed += selection.count;
                this.statusEl.textContent = `+${delta}`;
                this.clearSelection();
                this.render();
                if (!generateMoves(this.flat).length) {
                    this.endGame("No Moves Left");
                }
            } else {
                this.selectionState = "invalid";
                this.statusEl.textContent = `Sum ${selection.sum}`;
                this.render();
                window.setTimeout(() => this.clearSelection(), 280);
            }
        }

        currentSelection() {
            if (!this.selectionStart || !this.selectionEnd) {
                return { rect: null, sum: 0, indices: [], values: [], count: 0 };
            }
            const rect = normalizeRect(this.selectionStart, this.selectionEnd);
            return describeSelection(this.flat, rect);
        }

        clearSelection() {
            this.pointerDown = false;
            this.selectionStart = null;
            this.selectionEnd = null;
            this.selectionState = "neutral";
            this.render();
        }

        renderStats() {
            this.scoreEl.textContent = String(this.score);
            this.timeEl.textContent = `${this.remaining.toFixed(1)}s`;
            this.movesEl.textContent = String(this.moves);
            this.removedEl.textContent = String(this.removed);
            this.pauseBtn.textContent = this.paused ? "Resume" : "Pause";
            this.pauseBtn.disabled = !this.playing;
            if (!this.playing && this.statusEl.textContent !== "Ready") {
                this.statusEl.textContent = "Ready";
            } else if (this.playing && !this.paused && !this.pointerDown) {
                this.statusEl.textContent = "Playing";
            }
        }

        render() {
            this.ensureCells();
            const selection = this.currentSelection();
            const selected = new Set(selection.indices);
            this.cells.forEach((cell, index) => {
                const value = this.flat[index];
                cell.textContent = value ? String(value) : "";
                cell.className = value ? "merge10-cell" : "merge10-cell empty";
                if (selected.has(index)) {
                    cell.classList.add("selected");
                    if (this.selectionState === "valid") cell.classList.add("valid");
                    if (this.selectionState === "invalid") cell.classList.add("invalid");
                }
            });
            this.selectionSumEl.textContent = String(selection.sum);
            this.selectionCellsEl.textContent = String(selection.count);
            this.renderStats();
        }

        toText() {
            return {
                game: "merge10",
                status: this.playing ? (this.paused ? "paused" : "playing") : "ready",
                score: this.score,
                scoreMode: this.scoreMode(),
                remaining: Number(this.remaining.toFixed(2)),
                moves: this.moves,
                removed: this.removed,
                selection: this.currentSelection(),
                board: flatToGrid(this.flat),
                coordinateSystem: "rows and columns are zero-based; r increases downward, c increases rightward",
            };
        }
    }

    class TenHelper {
        constructor() {
            this.gridEl = document.getElementById("ten-helper-grid");
            this.playbackGridEl = document.getElementById("ten-helper-playback-grid");
            this.statusEl = document.getElementById("ten-helper-status");
            this.demoBtn = document.getElementById("ten-helper-demo-btn");
            this.randomBtn = document.getElementById("ten-helper-random-btn");
            this.clearBtn = document.getElementById("ten-helper-clear-btn");
            this.solveBtn = document.getElementById("ten-helper-solve-btn");
            this.scoreModeEl = document.getElementById("ten-helper-score-mode");
            this.timeLimitEl = document.getElementById("ten-helper-time-limit");
            this.beamWidthEl = document.getElementById("ten-helper-beam-width");
            this.playBtn = document.getElementById("ten-helper-play-btn");
            this.pauseBtn = document.getElementById("ten-helper-pause-btn");
            this.prevBtn = document.getElementById("ten-helper-prev-btn");
            this.nextBtn = document.getElementById("ten-helper-next-btn");
            this.stepEl = document.getElementById("ten-helper-step");
            this.scoreEl = document.getElementById("ten-helper-score");
            this.removedEl = document.getElementById("ten-helper-removed");
            this.copyBtn = document.getElementById("ten-helper-copy-btn");
            this.jsonBtn = document.getElementById("ten-helper-json-btn");
            this.moveListEl = document.getElementById("ten-helper-move-list");
            this.ocrFileEl = document.getElementById("ten-helper-ocr-file");
            this.ocrUploadBtn = document.getElementById("ten-helper-ocr-upload-btn");
            this.ocrAutoBtn = document.getElementById("ten-helper-ocr-auto-btn");
            this.ocrRunBtn = document.getElementById("ten-helper-ocr-run-btn");
            this.ocrDeepEl = document.getElementById("ten-helper-ocr-deep");
            this.ocrStatusEl = document.getElementById("ten-helper-ocr-status");
            this.ocrCanvas = document.getElementById("ten-helper-ocr-canvas");
            this.ocrCard = document.querySelector(".ten-ocr-card");
            this.inputs = [];
            this.playbackCells = [];
            this.solution = null;
            this.currentGrid = blankGrid();
            this.currentStep = 0;
            this.currentScore = 0;
            this.currentRemoved = 0;
            this.playing = false;
            this.animating = false;
            this.ocrImageCanvas = null;
            this.ocrCrop = null;
            this.ocrDragging = false;
            this.ocrDragStart = null;
        }

        init() {
            this.renderInputs(blankGrid());
            this.ensurePlaybackCells();
            this.attachEvents();
            this.renderPlayback(blankGrid());
            this.updateControls();
        }

        attachEvents() {
            this.demoBtn.addEventListener("click", () => this.loadGrid(demoGrid(), "Demo loaded"));
            this.randomBtn.addEventListener("click", () => this.loadGrid(randomPlayableGrid(), "Random board"));
            this.clearBtn.addEventListener("click", () => this.loadGrid(blankGrid(), "Cleared"));
            this.solveBtn.addEventListener("click", () => this.solve());
            this.playBtn.addEventListener("click", () => this.playLoop());
            this.pauseBtn.addEventListener("click", () => this.pause());
            this.prevBtn.addEventListener("click", () => this.jumpToStep(this.currentStep - 1));
            this.nextBtn.addEventListener("click", () => this.playNext(true));
            this.copyBtn.addEventListener("click", () => this.copySolution());
            this.jsonBtn.addEventListener("click", () => {
                if (this.solution) {
                    downloadFile("merge10-solution.json", JSON.stringify(this.solution, null, 2), "application/json;charset=utf-8");
                }
            });
            this.ocrUploadBtn.addEventListener("click", () => this.ocrFileEl.click());
            this.ocrFileEl.addEventListener("change", () => {
                const file = this.ocrFileEl.files?.[0];
                if (file) this.loadOcrImage(file);
            });
            this.ocrAutoBtn.addEventListener("click", () => this.autoCropOcrImage());
            this.ocrRunBtn.addEventListener("click", () => this.runOcr());
            this.ocrCanvas.addEventListener("pointerdown", (event) => this.beginOcrCrop(event));
            this.ocrCanvas.addEventListener("pointermove", (event) => this.moveOcrCrop(event));
            this.ocrCanvas.addEventListener("pointerup", (event) => this.endOcrCrop(event));
            this.ocrCanvas.addEventListener("pointercancel", () => {
                this.ocrDragging = false;
            });
            this.setupOcrDropTargets();
        }

        setupOcrDropTargets() {
            const targets = [this.ocrCard, document.getElementById("ten-helper-screen")].filter(Boolean);
            targets.forEach((target) => {
                target.addEventListener("dragenter", (event) => this.handleOcrDrag(event));
                target.addEventListener("dragover", (event) => this.handleOcrDrag(event));
                target.addEventListener("dragleave", (event) => {
                    event.preventDefault();
                    this.ocrCard?.classList.remove("dragover");
                });
                target.addEventListener("drop", (event) => this.handleOcrDrop(event));
            });
        }

        handleOcrDrag(event) {
            event.preventDefault();
            this.ocrCard?.classList.add("dragover");
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = "copy";
            }
        }

        handleOcrDrop(event) {
            event.preventDefault();
            this.ocrCard?.classList.remove("dragover");
            const file = Array.from(event.dataTransfer?.files || []).find((item) =>
                /^image\//.test(item.type || "") || /\.(png|jpe?g|webp)$/i.test(item.name || "")
            );
            if (file) {
                this.loadOcrImage(file);
            } else {
                this.setOcrStatus("Drop image only");
            }
        }

        renderInputs(grid, warnings = []) {
            this.gridEl.innerHTML = "";
            this.inputs = [];
            const warningSet = new Set(warnings.map((cell) => `${cell.r},${cell.c}`));
            const fragment = document.createDocumentFragment();
            for (let r = 0; r < ROWS; r += 1) {
                for (let c = 0; c < COLS; c += 1) {
                    const input = document.createElement("input");
                    input.type = "text";
                    input.inputMode = "numeric";
                    input.maxLength = 1;
                    input.value = grid[r][c] ? String(grid[r][c]) : "";
                    input.dataset.r = String(r);
                    input.dataset.c = String(c);
                    input.ariaLabel = `R${r + 1}C${c + 1}`;
                    if (warningSet.has(`${r},${c}`)) {
                        input.classList.add("warning");
                    }
                    input.addEventListener("input", () => {
                        input.value = input.value.replace(/[^\d]/g, "").slice(0, 1);
                        input.classList.remove("warning");
                        this.solution = null;
                        this.currentStep = 0;
                        this.currentGrid = this.readGrid();
                        this.renderPlayback(this.currentGrid);
                        this.updateControls();
                    });
                    input.addEventListener("focus", () => input.select());
                    fragment.appendChild(input);
                    this.inputs.push(input);
                }
            }
            this.gridEl.appendChild(fragment);
        }

        ensurePlaybackCells() {
            if (this.playbackCells.length === CELL_COUNT) return;
            this.playbackGridEl.innerHTML = "";
            const fragment = document.createDocumentFragment();
            for (let index = 0; index < CELL_COUNT; index += 1) {
                const cell = document.createElement("div");
                cell.className = "ten-helper-cell empty";
                fragment.appendChild(cell);
                this.playbackCells.push(cell);
            }
            this.playbackGridEl.appendChild(fragment);
        }

        readGrid() {
            const grid = blankGrid();
            this.inputs.forEach((input) => {
                const r = Number(input.dataset.r);
                const c = Number(input.dataset.c);
                const value = input.value === "" ? 0 : Number(input.value);
                grid[r][c] = Number.isFinite(value) ? clamp(Math.floor(value), 0, 9) : 0;
            });
            return grid;
        }

        loadGrid(grid, status, warnings = []) {
            this.pause();
            this.solution = null;
            this.currentStep = 0;
            this.currentScore = 0;
            this.currentRemoved = 0;
            this.renderInputs(grid, warnings);
            this.currentGrid = cloneGrid(grid);
            this.renderPlayback(grid);
            this.moveListEl.innerHTML = "";
            this.statusEl.textContent = status;
            this.updateSummary();
            this.updateControls();
        }

        setOcrStatus(text) {
            if (this.ocrStatusEl) {
                this.ocrStatusEl.textContent = text;
            }
        }

        async loadOcrImage(file) {
            if (!/^image\//.test(file.type || "") && !/\.(png|jpe?g|webp)$/i.test(file.name || "")) {
                this.setOcrStatus("Image only");
                return;
            }
            this.setOcrStatus("Loading image...");
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => {
                URL.revokeObjectURL(url);
                const maxSide = 980;
                const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
                const source = document.createElement("canvas");
                source.width = Math.max(1, Math.round(image.naturalWidth * scale));
                source.height = Math.max(1, Math.round(image.naturalHeight * scale));
                source.getContext("2d").drawImage(image, 0, 0, source.width, source.height);
                this.ocrImageCanvas = source;
                this.ocrCanvas.width = source.width;
                this.ocrCanvas.height = source.height;
                this.ocrCanvas.hidden = false;
                this.ocrCrop = detectBrightTileCrop(source) || defaultOcrCrop(source.width, source.height);
                this.drawOcrPreview();
                this.ocrAutoBtn.disabled = false;
                this.ocrRunBtn.disabled = false;
                this.setOcrStatus("Crop Ready");
            };
            image.onerror = () => {
                URL.revokeObjectURL(url);
                this.setOcrStatus("Load failed");
            };
            image.src = url;
        }

        autoCropOcrImage() {
            if (!this.ocrImageCanvas) return;
            this.ocrCrop = detectBrightTileCrop(this.ocrImageCanvas) || defaultOcrCrop(this.ocrImageCanvas.width, this.ocrImageCanvas.height);
            this.drawOcrPreview();
            this.setOcrStatus("Crop Ready");
        }

        drawOcrPreview() {
            if (!this.ocrImageCanvas || !this.ocrCanvas) return;
            drawOcrCanvas(this.ocrCanvas, this.ocrImageCanvas, this.ocrCrop);
        }

        ocrPointFromEvent(event) {
            const rect = this.ocrCanvas.getBoundingClientRect();
            return {
                x: clamp(((event.clientX - rect.left) / rect.width) * this.ocrCanvas.width, 0, this.ocrCanvas.width),
                y: clamp(((event.clientY - rect.top) / rect.height) * this.ocrCanvas.height, 0, this.ocrCanvas.height),
            };
        }

        beginOcrCrop(event) {
            if (!this.ocrImageCanvas) return;
            event.preventDefault();
            this.ocrDragging = true;
            this.ocrDragStart = this.ocrPointFromEvent(event);
            this.ocrCrop = { x: this.ocrDragStart.x, y: this.ocrDragStart.y, w: 1, h: 1 };
            this.ocrCanvas.setPointerCapture?.(event.pointerId);
            this.drawOcrPreview();
        }

        moveOcrCrop(event) {
            if (!this.ocrDragging || !this.ocrDragStart) return;
            const point = this.ocrPointFromEvent(event);
            this.ocrCrop = normalizeCrop({
                x: this.ocrDragStart.x,
                y: this.ocrDragStart.y,
                w: point.x - this.ocrDragStart.x,
                h: point.y - this.ocrDragStart.y,
            }, this.ocrCanvas.width, this.ocrCanvas.height);
            this.drawOcrPreview();
        }

        endOcrCrop(event) {
            if (!this.ocrDragging) return;
            this.moveOcrCrop(event);
            this.ocrDragging = false;
            this.ocrDragStart = null;
            this.setOcrStatus("Crop Ready");
        }

        cellRectForOcr(r, c) {
            const crop = this.ocrCrop;
            return {
                x: crop.x + (crop.w * c) / COLS,
                y: crop.y + (crop.h * r) / ROWS,
                w: crop.w / COLS,
                h: crop.h / ROWS,
            };
        }

        async runOcr() {
            if (!this.ocrImageCanvas || !this.ocrCrop) {
                this.setOcrStatus("No image");
                return;
            }
            this.pause();
            this.ocrRunBtn.disabled = true;
            this.ocrAutoBtn.disabled = true;
            this.solveBtn.disabled = true;
            const grid = blankGrid();
            const warnings = [];
            const uncertain = [];
            try {
                for (let r = 0; r < ROWS; r += 1) {
                    for (let c = 0; c < COLS; c += 1) {
                        const cellCanvas = makeCellCanvas(this.ocrImageCanvas, this.cellRectForOcr(r, c));
                        const result = classifyDigitTemplate(cellCanvas);
                        grid[r][c] = result.value || 0;
                        if (!result.value || result.confidence < 0.58 || result.margin < 0.025) {
                            warnings.push({ r, c });
                            uncertain.push({ r, c, canvas: result.canvas });
                        }
                    }
                    this.setOcrStatus(`OCR ${r + 1}/${ROWS}`);
                    await sleep(0);
                }

                if (this.ocrDeepEl.checked && uncertain.length) {
                    const deepLimit = Math.min(uncertain.length, 60);
                    for (let i = 0; i < deepLimit; i += 1) {
                        const cell = uncertain[i];
                        this.setOcrStatus(`Deep OCR ${i + 1}/${deepLimit}`);
                        const deep = await recognizeDigitDeep(cell.canvas, (text) => this.setOcrStatus(text));
                        if (deep.value && deep.confidence >= 0.35) {
                            grid[cell.r][cell.c] = deep.value;
                            const warningIndex = warnings.findIndex((item) => item.r === cell.r && item.c === cell.c);
                            if (warningIndex !== -1 && deep.confidence >= 0.5) {
                                warnings.splice(warningIndex, 1);
                            }
                        }
                    }
                }

                this.loadGrid(grid, "OCR loaded", warnings);
                const filled = gridToFlat(grid).filter((value) => value > 0).length;
                this.setOcrStatus(`${filled}/${CELL_COUNT} cells · ${warnings.length} check`);
            } catch (err) {
                console.error("[merge10.js] OCR failed", err);
                this.setOcrStatus("OCR failed");
            } finally {
                this.ocrRunBtn.disabled = false;
                this.ocrAutoBtn.disabled = false;
                this.solveBtn.disabled = false;
            }
        }

        async solve() {
            this.pause();
            const grid = this.readGrid();
            const flat = gridToFlat(grid);
            if (!totalNonZero(flat)) {
                this.statusEl.textContent = "Board empty";
                return;
            }
            this.statusEl.textContent = "Solving...";
            this.solveBtn.disabled = true;
            await sleep(20);
            const solution = solveMerge10Grid(grid, {
                scoreMode: this.scoreModeEl.value,
                beamWidth: Number(this.beamWidthEl.value),
                timeLimit: Number(this.timeLimitEl.value),
            });
            this.solution = solution;
            this.currentStep = 0;
            this.currentScore = 0;
            this.currentRemoved = 0;
            this.currentGrid = cloneGrid(solution.initial_grid);
            this.renderPlayback(this.currentGrid);
            this.renderMoveList();
            this.statusEl.textContent = solution.total_moves ? "Solved" : "No moves";
            this.updateSummary();
            this.updateControls();
        }

        renderPlayback(grid, activeMove = null, removing = false) {
            this.ensurePlaybackCells();
            const rectSet = new Set();
            const removingSet = new Set();
            if (activeMove) {
                for (let r = activeMove.rect.r1; r <= activeMove.rect.r2; r += 1) {
                    for (let c = activeMove.rect.c1; c <= activeMove.rect.c2; c += 1) {
                        rectSet.add(r * COLS + c);
                    }
                }
                activeMove.removed_cells.forEach((cell) => removingSet.add(cell.r * COLS + cell.c));
            }
            for (let r = 0; r < ROWS; r += 1) {
                for (let c = 0; c < COLS; c += 1) {
                    const index = r * COLS + c;
                    const value = grid[r][c];
                    const cell = this.playbackCells[index];
                    cell.textContent = value ? String(value) : "";
                    cell.className = value ? "ten-helper-cell" : "ten-helper-cell empty";
                    if (rectSet.has(index)) cell.classList.add("rect");
                    if (removing && removingSet.has(index)) cell.classList.add("removing");
                }
            }
        }

        renderMoveList() {
            this.moveListEl.innerHTML = "";
            if (!this.solution) return;
            const fragment = document.createDocumentFragment();
            this.solution.moves.forEach((move) => {
                const item = document.createElement("li");
                item.textContent = move.text;
                item.dataset.index = String(move.index);
                item.addEventListener("click", () => this.jumpToStep(move.index));
                fragment.appendChild(item);
            });
            this.moveListEl.appendChild(fragment);
        }

        highlightMoveList() {
            this.moveListEl.querySelectorAll("li").forEach((item) => {
                item.classList.toggle("active", Number(item.dataset.index) === this.currentStep);
            });
        }

        gridAtStep(step) {
            if (!this.solution) return this.readGrid();
            const grid = cloneGrid(this.solution.initial_grid);
            for (let i = 0; i < step && i < this.solution.moves.length; i += 1) {
                this.solution.moves[i].removed_cells.forEach((cell) => {
                    grid[cell.r][cell.c] = 0;
                });
            }
            return grid;
        }

        scoreAtStep(step) {
            if (!this.solution) return { score: 0, removed: 0 };
            let score = 0;
            let removed = 0;
            for (let i = 0; i < step && i < this.solution.moves.length; i += 1) {
                score += this.solution.moves[i].score_delta;
                removed += this.solution.moves[i].removed_cells.length;
            }
            return { score, removed };
        }

        async playNext(animated) {
            if (!this.solution || this.animating || this.currentStep >= this.solution.moves.length) return;
            const move = this.solution.moves[this.currentStep];
            this.animating = true;
            this.renderPlayback(this.currentGrid, move, false);
            this.highlightMoveList();
            if (animated) {
                await sleep(240);
                this.renderPlayback(this.currentGrid, move, true);
                await sleep(210);
            }
            move.removed_cells.forEach((cell) => {
                this.currentGrid[cell.r][cell.c] = 0;
            });
            this.currentStep += 1;
            this.currentScore += move.score_delta;
            this.currentRemoved += move.removed_cells.length;
            this.renderPlayback(this.currentGrid);
            this.updateSummary();
            this.highlightMoveList();
            this.animating = false;
            this.updateControls();
        }

        async playLoop() {
            if (!this.solution || this.playing) return;
            this.playing = true;
            this.updateControls();
            while (this.playing && this.currentStep < this.solution.moves.length) {
                await this.playNext(true);
                if (this.playing) await sleep(90);
            }
            this.playing = false;
            this.updateControls();
        }

        pause() {
            this.playing = false;
            this.updateControls();
        }

        jumpToStep(step) {
            if (!this.solution || this.animating) return;
            this.pause();
            const target = clamp(step, 0, this.solution.moves.length);
            this.currentStep = target;
            this.currentGrid = this.gridAtStep(target);
            const totals = this.scoreAtStep(target);
            this.currentScore = totals.score;
            this.currentRemoved = totals.removed;
            this.renderPlayback(this.currentGrid);
            this.updateSummary();
            this.highlightMoveList();
            this.updateControls();
        }

        updateSummary() {
            const total = this.solution?.moves?.length || 0;
            this.stepEl.textContent = `${this.currentStep} / ${total}`;
            this.scoreEl.textContent = String(this.currentScore);
            this.removedEl.textContent = String(this.currentRemoved);
        }

        updateControls() {
            const hasSolution = Boolean(this.solution);
            const hasMoves = Boolean(this.solution?.moves?.length);
            this.playBtn.disabled = !hasMoves || this.playing || this.animating || this.currentStep >= this.solution.moves.length;
            this.pauseBtn.disabled = !this.playing;
            this.prevBtn.disabled = !hasMoves || this.animating || this.currentStep <= 0;
            this.nextBtn.disabled = !hasMoves || this.animating || this.currentStep >= (this.solution?.moves?.length || 0);
            this.copyBtn.disabled = !hasSolution;
            this.jsonBtn.disabled = !hasSolution;
            this.solveBtn.disabled = false;
            this.updateSummary();
        }

        solutionText() {
            if (!this.solution) return "";
            const solution = this.solution;
            return [
                "合十消除助手攻略",
                "",
                `总数字和：${solution.total_sum}`,
                `理论最多合十步数上限：${solution.max_possible_moves}`,
                `搜索模式：score=${solution.score_mode}, beam_width=${solution.params.beam_width}, time_limit=${solution.params.time_limit}s`,
                `找到分数：${solution.total_score}`,
                `找到步数：${solution.total_moves}`,
                `消除格子数：${solution.total_removed_cells}`,
                `是否已达到理论最优：${solution.theoretical_best ? "是" : "否"}`,
                "",
                "逐步攻略：",
                ...solution.moves.map((move) => `${String(move.index).padStart(2, "0")}. ${move.text}`),
            ].join("\n");
        }

        async copySolution() {
            const text = this.solutionText();
            if (!text) return;
            try {
                await navigator.clipboard.writeText(text);
                this.statusEl.textContent = "Copied";
            } catch (_err) {
                downloadFile("merge10-solution.txt", text, "text/plain;charset=utf-8");
                this.statusEl.textContent = "Downloaded";
            }
        }

        toText() {
            return {
                game: "ten-helper",
                status: this.statusEl.textContent,
                currentStep: this.currentStep,
                score: this.currentScore,
                removed: this.currentRemoved,
                solutionMoves: this.solution?.total_moves || 0,
                ocr: {
                    status: this.ocrStatusEl?.textContent || "",
                    crop: this.ocrCrop ? {
                        x: Math.round(this.ocrCrop.x),
                        y: Math.round(this.ocrCrop.y),
                        w: Math.round(this.ocrCrop.w),
                        h: Math.round(this.ocrCrop.h),
                    } : null,
                },
                board: this.currentGrid,
                coordinateSystem: "rows and columns are zero-based; r increases downward, c increases rightward",
            };
        }
    }

    window.initMerge10Game = function initMerge10Game() {
        if (!merge10Controller) {
            merge10Controller = new Merge10Game();
            merge10Controller.init();
        }
    };

    window.initTenHelper = function initTenHelper() {
        if (!tenHelperController) {
            tenHelperController = new TenHelper();
            tenHelperController.init();
        }
    };

    const previousRenderGameToText = window.render_game_to_text;
    window.render_game_to_text = function renderGameToText() {
        if (document.body.dataset.game === "merge10" && merge10Controller) {
            return JSON.stringify(merge10Controller.toText());
        }
        if (document.body.dataset.game === "ten-helper" && tenHelperController) {
            return JSON.stringify(tenHelperController.toText());
        }
        if (typeof previousRenderGameToText === "function") {
            return previousRenderGameToText();
        }
        return JSON.stringify({ game: document.body.dataset.game || "menu" });
    };

    const previousAdvanceTime = window.advanceTime;
    window.advanceTime = function advanceTime(ms) {
        if (document.body.dataset.game === "merge10" && merge10Controller) {
            merge10Controller.advanceTime(ms);
            return;
        }
        if (typeof previousAdvanceTime === "function") {
            previousAdvanceTime(ms);
        }
    };
})();
