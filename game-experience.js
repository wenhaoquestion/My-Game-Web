/* Shared play tools: instructions, fullscreen and opt-in synthesized feedback. */
(() => {
    'use strict';
    const guides = {
        snake: ['Grow your snake by collecting food. Avoid your tail and the obstacles.', 'Arrow keys / WASD, swipe or use the direction pad. Pause before adjusting your next run.', 'Choose a pace you can control. Look two turns ahead and leave an escape route.'],
        tetris: ['Fill horizontal rows to clear them. The landing guide shows exactly where your piece will fall.', 'Arrows / A D move; Q / E rotate; Down soft drops; Space hard drops; Shift / C holds a piece. P pauses. B toggles AI practice.', 'Marathon: 150 lines. Sprint: 40 lines. Ultra: score in 120 seconds. Gauntlet: 80 lines under rising garbage. Records are separate by mode and stage; AI-assisted runs do not set personal records.'],
        '2048': ['Slide matching numbers together to build the 2048 tile, then keep going for a larger score.', 'Arrow keys / WASD or swipe. Undo takes back a move including its new tile. Your current board is saved in this browser when storage is available.', 'Keep your largest tile in a corner and build a chain along an edge. A move that changes nothing does not create a tile.'],
        sudoku: ['Fill every row, column and 3×3 box with the digits 1–9, once each.', 'Select a cell, then use the keypad or number keys. Notes mark candidates. Undo reverses a board edit; hints and mistakes remain counted.', 'Killer cages must also add to their printed total without repeating a digit. Candidate notes follow the visible board rules; a hint reveals a solution digit.'],
        shooter: ['Survive enemy waves, collect upgrades and defeat each sector’s boss.', 'Drag to steer or use arrows / A D and touch buttons. Auto-fire starts on; Space shoots manually, Shift uses a bomb and P pauses.', 'Chain quick eliminations for a score multiplier. Watch boss warnings, save bombs for crowded moments and collect repairs between sectors.'],
        merge10: ['Drag a rectangle whose remaining numbers add to exactly 10. Empty cells do not add to the sum.', 'Use a hint when you are stuck. Undo restores a removed group but does not give back elapsed time.', 'Countdown rewards points before time runs out. Clear Race begins with a solvable board and measures how quickly you clear it; your chosen moves can still lead to a dead end.'],
        coin: ['Choose Heads or Tails, then flip. Play freely or test your predictions over ten rounds.', 'Use the Flip button or Space. Every flip is independent; previous results do not change the next result.', 'This is a chance game with no stakes. Compare your guesses with the actual outcome and enjoy the animation.'],
        chess: ['Checkmate your opponent’s king: attack it so no legal move can escape.', 'Select a piece to see legal destinations. Undo returns to your previous turn against AI, or takes back one move with a friend. Hint highlights a legal suggestion without playing it.', 'Develop your pieces and protect your king. Castling, en passant and promotion are supported; hints look only a few moves ahead.'],
        gomoku: ['Place five stones in one unbroken horizontal, vertical or diagonal line.', 'Select an empty intersection. Black moves first. Choose AI or local two-player mode; undo or request a hint below the board.', 'Watch the threat readout. Take an immediate win when possible, block your opponent’s winning move, then build threats in two directions.'],
        xiangqi: ['Trap the opposing general while keeping your own safe.', 'Select a piece, then a legal destination. Red moves first. Undo restores your previous turn against AI; Hint marks a suggested move without playing it.', 'Generals may not face each other on an open file. Cannons need one intervening piece to capture, horses can be blocked at the leg, and elephants stay on their side of the river.'],
        poker: ['Explore how often a Texas Hold’em hand wins against random opponent hands.', 'Choose two hero cards, optionally add board cards, select opponents and calculate. Each physical card can be used once.', 'Results are simulation estimates, not predictions or a guarantee. More simulations reduce sampling noise; changing the cards requires a new calculation.'],
        'ten-helper': ['Find removal routes for an editable Merge 10 board and inspect each step.', 'Type digits, import a screenshot or load a demo. Solve computes a route in the background; use Next / Prev or Play to inspect it.', 'Check OCR digits before solving. Search is time-limited, so the best route found is not necessarily optimal. Editing the board cancels old playback and search.'],
    };
    let context;
    let enabled = window.ArcadeStorage?.getItem('arcade_sound') === 'on';
    let lastSound = 0;
    const melodies = { move: [320], score: [440, 660], combo: [440, 554, 660], hit: [160, 100], win: [523, 659, 784, 1047], lose: [330, 220, 147] };
    function updateSoundButtons() {
        document.querySelectorAll('[data-play-sound]').forEach(button => {
            button.textContent = enabled ? 'Sound on' : 'Sound off';
            button.setAttribute('aria-pressed', String(enabled));
        });
    }
    window.ArcadeFeedback = {
        play(type = 'move') {
            if (!enabled || !context || document.hidden || document.body.dataset.game === 'menu') return;
            const now = performance.now();
            if (now - lastSound < 45) return;
            lastSound = now;
            const notes = melodies[type] || melodies.move;
            notes.forEach((frequency, index) => {
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                const start = context.currentTime + index * .065;
                oscillator.type = 'sine';
                oscillator.frequency.value = frequency;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(.065, start + .01);
                gain.gain.exponentialRampToValueAtTime(.001, start + .13);
                oscillator.connect(gain).connect(context.destination);
                oscillator.start(start);
                oscillator.stop(start + .15);
                oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
            });
        },
    };
    const unlockSound = () => {
        if (!enabled) return;
        const Constructor = window.AudioContext || window.webkitAudioContext;
        if (!Constructor) return;
        try {
            context ||= new Constructor();
            if (context.state === 'suspended') context.resume().catch(() => {});
        } catch {}
    };
    document.addEventListener('pointerdown', unlockSound, { capture: true });
    document.addEventListener('keydown', unlockSound, { capture: true });

    const dialog = document.createElement('dialog');
    dialog.className = 'play-guide';
    dialog.setAttribute('aria-labelledby', 'play-guide-title');
    dialog.innerHTML = '<div class="play-guide-header"><h2 id="play-guide-title"></h2><button type="button" class="btn" aria-label="Close instructions">Close ×</button></div><div class="play-guide-content"></div><p class="play-guide-note">Take your time. The arcade will be here.</p>';
    document.body.append(dialog);
    const closeButton = dialog.querySelector('button');
    dialog.addEventListener('keydown', event => event.stopPropagation());
    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => {
        delete document.body.dataset.gameHelp;
        document.dispatchEvent(new CustomEvent('arcade:helpclose'));
    });
    document.addEventListener('arcade:screenchange', () => {
        if (dialog.open) dialog.close();
        if (document.fullscreenElement?.hidden) document.exitFullscreen().catch(() => {});
    });

    async function toggleFullscreen(screen) {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else if (screen.requestFullscreen) await screen.requestFullscreen();
        } catch {
            document.getElementById('app-announcement').textContent = 'Fullscreen is not available in this browser.';
        }
    }
    window.addEventListener('keydown', event => {
        if (event.key.toLowerCase() !== 'f' || event.ctrlKey || event.metaKey || event.altKey || event.repeat || dialog.open) return;
        if (event.target.closest?.('input, select, textarea, button, a, [contenteditable="true"]')) return;
        const screen = document.querySelector('.screen.active:not(#menu-screen)');
        if (screen) { event.preventDefault(); toggleFullscreen(screen); }
    });
    for (const game of window.ArcadeCatalog) {
        const screen = document.getElementById(game.screen);
        const toolbar = document.createElement('div');
        toolbar.className = 'play-tools';
        toolbar.setAttribute('role', 'group');
        toolbar.setAttribute('aria-label', game.title + ' play tools');
        const help = document.createElement('button');
        help.className = 'play-tool';
        help.type = 'button';
        help.textContent = 'How to play';
        help.addEventListener('click', () => {
            document.body.dataset.gameHelp = 'open';
            document.dispatchEvent(new CustomEvent('arcade:pause', { detail: { gameId: game.id } }));
            dialog.querySelector('h2').textContent = game.title;
            dialog.querySelector('.play-guide-content').replaceChildren(...guides[game.id].map((text, index) => {
                const section = document.createElement('section');
                const heading = document.createElement('h3');
                heading.textContent = ['The goal', 'Your controls', 'A little strategy'][index];
                const paragraph = document.createElement('p');
                paragraph.textContent = text;
                section.append(heading, paragraph);
                return section;
            }));
            dialog.showModal();
        });
        const sound = document.createElement('button');
        sound.type = 'button';
        sound.className = 'play-tool';
        sound.dataset.playSound = '';
        sound.addEventListener('click', async () => {
            const Constructor = window.AudioContext || window.webkitAudioContext;
            if (!Constructor) { sound.textContent = 'Sound unavailable'; sound.disabled = true; return; }
            try {
                context ||= new Constructor();
                await context.resume();
                enabled = !enabled;
                window.ArcadeStorage?.setItem('arcade_sound', enabled ? 'on' : 'off');
                updateSoundButtons();
                if (enabled) window.ArcadeFeedback.play('score');
            } catch { document.getElementById('app-announcement').textContent = 'Sound could not start. Please try again.'; }
        });
        const fullscreen = document.createElement('button');
        fullscreen.className = 'play-tool';
        fullscreen.type = 'button';
        fullscreen.textContent = 'Fullscreen ↗';
        fullscreen.title = 'Fullscreen (F)';
        fullscreen.hidden = !document.fullscreenEnabled;
        fullscreen.addEventListener('click', () => toggleFullscreen(screen));
        document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement === screen ? 'Exit fullscreen ↙' : 'Fullscreen ↗'; });
        toolbar.append(help, sound, fullscreen);
        screen.querySelector('.game-topbar').append(toolbar);
    }
    updateSoundButtons();
})();
