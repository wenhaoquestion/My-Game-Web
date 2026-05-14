Original prompt: 帮我把这个/Users/question/Desktop/kaijuyoueryuan做到我现在这个game web里 还有我想你把这个合成10这个做成一个单独的游戏也能在我这个gameweb里玩 同时这个合成10 有一个可自定义的倒计时 和一样的评分系统 你先确认一下我这个本地的game web是最新的github版本 然后再开始工作

Progress:
- Confirmed local `main` is up to date with `origin/main` after `git fetch origin --prune`; both point at `214d6e68985719954f432e9701ececb7d6a1eebe`.
- Inspected `/Users/question/Desktop/kaijuyoueryuan`; it is a Python/FastAPI "合十消除助手" with OCR and solver. The current game web is static HTML/JS, so the integration should avoid requiring the Python backend for GitHub Pages compatibility.
- Added a static `merge10.js` implementation with shared 合十 rectangle rules, browser-side solving, `cells`/`moves` scoring, `render_game_to_text`, and `advanceTime`.
- Added two arcade entries and screens: playable `合成10 · Merge 10` with customizable countdown, and `合十消除助手` with editable 16x10 board, solver, playback, copy, and JSON export.
- Verified desktop and mobile layouts with Playwright screenshots. Verified Merge 10 start/drag/score/countdown and helper demo/solve/next-step playback. `web_game_playwright_client` also enters both new screens and reports state without console errors.
- Added browser-side OCR to `合十消除助手`: screenshot upload, preview crop, auto crop, manual crop by dragging, fast template digit OCR, low-confidence yellow cell marking, and optional Deep OCR via Tesseract.js for difficult cells.
- Verified OCR with a generated 16x10 high-contrast board: 160/160 cells recognized with 0 warnings. Verified manual-crop OCR on a dark in-arcade Merge 10 screenshot: 139/160 cells filled, with uncertain cells marked for correction.
- Improved OCR for the user's WeChat-style screenshot (green board + white cards + black digits). The recognizer now extracts black digit strokes instead of the white tile background, and the helper supports dropping images directly onto the OCR area or helper screen. Verified the provided JPG via simulated drag/drop: 160/160 correct, 0 warnings.

TODO:
- Optional future improvement: tune the dark-theme screenshot classifier further, or add a small local/offline OCR model bundle so Deep OCR does not need to load Tesseract.js from CDN.
