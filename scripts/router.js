/**
 * Router Module
 * Handles hash-based routing for single-page application
 * Uses hash routes (#/) for compatibility with static file servers
 * Supports routes like: #/game/:id, #/history, #/history/game/:id, #/leaderboard, etc.
 */

const Router = (() => {
    /**
     * Parse current URL and extract route info
     * Uses hash-based routing (#/) for compatibility with static file servers
     */
    function parseUrl() {
        const hash = window.location.hash.substring(2); // Remove '#/'
        const pathParts = hash.split('/').filter(p => p);

        console.log('Current hash:', hash);
        console.log('Path parts:', pathParts);

        // Parse different routes
        if (!hash || pathParts.length === 0) {
            return { route: 'home' };
        }

        if (pathParts[0] === 'game' && pathParts[1]) {
            return { route: 'game', gameId: pathParts[1] };
        }

        if (pathParts[0] === 'history') {
            if (pathParts[1] === 'game' && pathParts[2]) {
                return { route: 'game-detail', gameId: pathParts[2] };
            }
            return { route: 'history' };
        }

        if (pathParts[0] === 'leaderboard') {
            if (pathParts[1] === 'player' && pathParts[2]) {
                return { route: 'player-profile', playerName: decodeURIComponent(pathParts[2]) };
            }
            return { route: 'leaderboard' };
        }

        if (pathParts[0] === 'new-game') {
            return { route: 'new-game' };
        }

        return { route: 'home' };
    }

    /**
     * Navigate to a route using hash-based routing
     */
    function navigate(route, params = {}) {
        let path = '#/';

        switch (route) {
            case 'home':
                path = '#/';
                break;
            case 'game':
                path = `#/game/${params.gameId}`;
                break;
            case 'new-game':
                path = '#/new-game';
                break;
            case 'history':
                path = '#/history';
                break;
            case 'game-detail':
                path = `#/history/game/${params.gameId}`;
                break;
            case 'leaderboard':
                path = '#/leaderboard';
                break;
            case 'player-profile':
                path = `#/leaderboard/player/${encodeURIComponent(params.playerName)}`;
                break;
        }

        // Update browser location hash (doesn't cause page reload)
        window.location.hash = path.substring(1); // Remove '#' prefix

        console.log('Navigated to:', path);
    }

    /**
     * Initialize router and handle navigation
     */
    function init(onRouteChange) {
        // Parse initial URL
        const currentRoute = parseUrl();
        onRouteChange(currentRoute);

        // Handle hash changes (browser back/forward and manual hash changes)
        window.addEventListener('hashchange', () => {
            const newRoute = parseUrl();
            onRouteChange(newRoute);
        });

        // Handle link clicks with data-navigate attributes
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-navigate]');
            if (link) {
                e.preventDefault();
                const route = link.dataset.navigate;
                const params = {};

                // Extract any params from data attributes
                Object.keys(link.dataset).forEach(key => {
                    if (key !== 'navigate') {
                        params[key] = link.dataset[key];
                    }
                });

                navigate(route, params);
                onRouteChange(parseUrl());
            }
        });
    }

    return {
        parseUrl,
        navigate,
        init
    };
})();
