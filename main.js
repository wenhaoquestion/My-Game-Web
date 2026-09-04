/* Library, preferences and hash routing. Games keep their independent engines. */
(() => {
    'use strict';
    const catalog = window.ArcadeCatalog;
    const games = new Map(catalog.map(game => [game.id, game]));
    const memory = new Map();
    const storage = window.ArcadeStorage = {
        getItem(key) { try { return localStorage.getItem(key) ?? memory.get(key) ?? null; } catch { return memory.get(key) ?? null; } },
        setItem(key, value) { memory.set(key, String(value)); try { localStorage.setItem(key, value); } catch { /* Session preferences still work. */ } },
        removeItem(key) { memory.delete(key); try { localStorage.removeItem(key); } catch {} },
    };
    const readList = key => {
        try { const value = JSON.parse(storage.getItem(key)); return Array.isArray(value) ? [...new Set(value.filter(id => games.has(id)))] : []; }
        catch { return []; }
    };
    const favorites = new Set(readList('arcade_favorites'));
    let recent = readList('arcade_recent');
    const initialized = new Set();
    const scripts = new Map();
    const library = document.getElementById('game-library');
    const search = document.getElementById('game-search');
    const empty = document.getElementById('library-empty');
    const feedback = document.getElementById('launch-feedback');
    let filter = 'all';
    let view = 'discover';
    let current = 'menu-screen';
    let lastGame = null;
    let libraryScroll = 0;
    let navigation = 0;
    const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
    function announce(text) { document.getElementById('app-announcement').textContent = text; }

    function renderLibrary() {
        const query = search.value.trim().toLocaleLowerCase();
        let results = catalog.filter(game =>
            (view !== 'favorites' || favorites.has(game.id)) &&
            (filter === 'all' || (filter === 'recent' ? recent.includes(game.id) : game.category.toLowerCase() === filter)) &&
            `${game.title} ${game.description} ${game.keywords}`.toLocaleLowerCase().includes(query));
        if (filter === 'recent') results.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
        library.replaceChildren(...results.map(game => {
            const article = document.createElement('article');
            article.className = 'library-card';
            const link = document.createElement('a');
            link.className = 'game-link';
            link.href = `#/${game.id}`;
            link.dataset.gameLink = game.id;
            link.setAttribute('aria-label', `Play ${game.title}`);
            const art = document.createElement('div');
            art.className = 'game-art';
            art.style.setProperty('--cover-x', `${(game.cover % 4) * 100 / 3}%`);
            art.style.setProperty('--cover-row', Math.floor(game.cover / 4));
            art.setAttribute('aria-hidden', 'true');
            const play = document.createElement('span');
            play.className = 'cover-play';
            play.textContent = 'Play ↗';
            art.append(play);
            const title = document.createElement('h3');
            title.textContent = game.title;
            const meta = document.createElement('p');
            meta.className = 'game-meta';
            meta.textContent = `${game.category}  ·  ${game.mode}`;
            link.append(art, title, meta);
            const favorite = document.createElement('button');
            favorite.type = 'button';
            favorite.className = 'favorite-button';
            favorite.dataset.favorite = game.id;
            favorite.setAttribute('aria-label', `${favorites.has(game.id) ? 'Remove' : 'Add'} ${game.title} ${favorites.has(game.id) ? 'from' : 'to'} favorites`);
            favorite.setAttribute('aria-pressed', String(favorites.has(game.id)));
            favorite.innerHTML = heart;
            article.append(link, favorite);
            return article;
        }));
        document.getElementById('collection-title').textContent = view === 'favorites' ? 'Your favorites' : 'The collection';
        document.getElementById('game-count').textContent = `${results.length} ${results.length === 1 ? 'game or tool' : 'games & tools'}`;
        document.getElementById('favorites-count').textContent = favorites.size ? ` ${favorites.size}` : '';
        empty.hidden = results.length > 0;
        if (!results.length) {
            document.getElementById('empty-title').textContent = query ? 'No games found' : view === 'favorites' ? 'Keep your favorites close.' : filter === 'recent' ? 'Your next favorite is waiting.' : 'Nothing here just yet.';
            document.getElementById('empty-description').textContent = query ? 'Try a different name, or explore the whole collection.' : view === 'favorites' ? 'Tap the heart on any game to save it here.' : 'Play something from the collection and it will appear here.';
        }
        document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
        document.querySelectorAll('[data-library-nav]').forEach(link => {
            const active = current === 'menu-screen' && link.dataset.libraryNav === view;
            if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
        });
    }

    function showScreen(screenId) {
        const previousScreenId = current;
        if (!document.getElementById(screenId)) return;
        current = screenId;
        document.querySelectorAll('.screen').forEach(screen => {
            const active = screen.id === screenId;
            screen.classList.toggle('active', active);
            screen.hidden = !active;
        });
        document.body.dataset.game = catalog.find(game => game.screen === screenId)?.id || 'menu';
        document.querySelector('.skip-link').textContent = screenId === 'menu-screen' ? 'Skip to games' : 'Skip to game';
        document.dispatchEvent(new CustomEvent('arcade:screenchange', { detail: { screenId, previousScreenId } }));
    }

    function loadScript(src) {
        if (!scripts.has(src)) {
            scripts.set(src, new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = () => { scripts.delete(src); script.remove(); reject(new Error(`Unable to load ${src}`)); };
                document.head.append(script);
            }));
        }
        return scripts.get(src);
    }
    function navigate(id = '') {
        const hash = `#/${id}`;
        if (location.hash === hash) route(); else location.hash = hash;
    }

    async function route() {
        const request = ++navigation;
        const id = location.hash.replace(/^#\/?/, '');
        const game = games.get(id);
        feedback.hidden = true;
        if (!game) {
            const wasGame = current !== 'menu-screen';
            const nextView = id === 'favorites' ? 'favorites' : 'discover';
            if (nextView !== view) { filter = 'all'; search.value = ''; }
            view = nextView;
            showScreen('menu-screen');
            document.getElementById('discovery-intro').hidden = view === 'favorites';
            document.title = `${view === 'favorites' ? 'Favorites · ' : ''}Wenhao’s Arcade`;
            renderLibrary();
            if (wasGame) {
                const target = document.querySelector(`[data-game-link="${lastGame}"]`) || document.getElementById('collection-title');
                target.focus({ preventScroll: true });
                window.scrollTo(0, libraryScroll);
            }
            return;
        }
        if (current === 'menu-screen') libraryScroll = window.scrollY;
        lastGame = game.id;
        showScreen(game.screen);
        renderLibrary();
        document.title = `${game.title} · Wenhao’s Arcade`;
        window.scrollTo(0, 0);
        const screen = document.getElementById(game.screen);
        const layout = screen.querySelector('.game-layout');
        screen.setAttribute('aria-busy', 'true');
        layout.inert = true;
        try {
            if (!initialized.has(game.id)) {
                document.getElementById('launch-message').textContent = `Opening ${game.title}…`;
                document.getElementById('launch-retry').hidden = true;
                feedback.hidden = false;
                await loadScript(game.script);
                if (request !== navigation) return;
                if (typeof window[game.init] !== 'function') throw new Error(`Missing ${game.init}`);
                await window[game.init]();
                initialized.add(game.id);
            }
            if (request !== navigation) return;
            recent = [game.id, ...recent.filter(item => item !== game.id)].slice(0, catalog.length);
            storage.setItem('arcade_recent', JSON.stringify(recent));
            feedback.hidden = true;
            layout.inert = false;
            screen.querySelector('h2')?.focus({ preventScroll: true });
            announce(`${game.title} opened`);
        } catch (error) {
            if (request !== navigation) return;
            document.getElementById('launch-message').textContent = 'This game could not open. Please try again.';
            document.getElementById('launch-retry').hidden = false;
            feedback.hidden = false;
            console.error(error);
        } finally {
            if (request === navigation || current !== game.screen) {
                screen.removeAttribute('aria-busy');
                layout.inert = false;
            }
        }
    }

    function applyTheme(theme) {
        const names = ['nebula', 'solaris', 'aqua', 'ember', 'verdant'];
        const value = names.includes(theme) ? theme : 'nebula';
        document.body.dataset.theme = value;
        storage.setItem('arcade_theme', value);
        document.querySelectorAll('.swatch').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === value)));
    }
    function applyAmbient(on) {
        document.body.dataset.ambient = on ? 'on' : 'off';
        storage.setItem('arcade_ambient', on ? 'on' : 'off');
        const button = document.getElementById('ambient-toggle-btn');
        button.setAttribute('aria-pressed', String(on));
        button.querySelector('.ctrl-btn-label').textContent = `Aura ${on ? 'on' : 'off'}`;
    }
    library.addEventListener('click', event => {
        const button = event.target.closest('[data-favorite]');
        if (!button) return;
        const id = button.dataset.favorite;
        if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
        storage.setItem('arcade_favorites', JSON.stringify([...favorites]));
        renderLibrary();
        (library.querySelector(`[data-favorite="${id}"]`) || library.querySelector('.favorite-button') || document.getElementById('collection-title')).focus({ preventScroll: true });
        announce(`${games.get(id).title} ${favorites.has(id) ? 'added to' : 'removed from'} favorites`);
    });
    document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; renderLibrary(); }));
    search.addEventListener('input', renderLibrary);
    document.getElementById('clear-search').addEventListener('click', () => { search.value = ''; renderLibrary(); search.focus(); });
    document.getElementById('reset-library').addEventListener('click', () => { filter = 'all'; search.value = ''; navigate(); renderLibrary(); });
    document.getElementById('launch-retry').addEventListener('click', route);
    document.querySelector('.skip-link').addEventListener('click', event => {
        event.preventDefault();
        const target = current === 'menu-screen' ? document.getElementById('collection-title') : document.getElementById(current).querySelector('h2');
        target?.focus();
        target?.scrollIntoView({ block: 'start' });
    });
    document.querySelectorAll('.back-btn').forEach(button => button.addEventListener('click', () => navigate(view === 'favorites' ? 'favorites' : '')));
    document.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.theme)));
    document.getElementById('ambient-toggle-btn').addEventListener('click', () => applyAmbient(document.body.dataset.ambient !== 'on'));
    window.addEventListener('keydown', event => {
        if (event.target.closest?.('input, textarea, select, button, a, [role="button"], [contenteditable="true"]')) return;
        if (['snake', '2048', 'tetris', 'shooter', 'sudoku', 'coin'].includes(document.body.dataset.game) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    }, { passive: false });
    window.addEventListener('hashchange', route);
    catalog.forEach(game => { window[game.legacy] = () => navigate(game.id); });
    window.switchToMenu = () => navigate(view === 'favorites' ? 'favorites' : '');
    window.showScreen = showScreen;
    applyTheme(storage.getItem('arcade_theme'));
    applyAmbient(storage.getItem('arcade_ambient') === 'on');
    route();
})();
