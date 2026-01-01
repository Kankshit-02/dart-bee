/**
 * Main App Module
 * Handles routing, event listeners, and app state
 */

const App = (() => {
    let currentGame = null;

    /**
     * Initialize the app
     */
    function init() {
        setupNavigation();
        setupHomeEvents();
        setupNewGameEvents();
        setupGameEvents();
        setupHistoryEvents();
        setupLeaderboardEvents();
        setupModalEvents();
        loadHome();
    }

    /**
     * Setup navigation listeners
     */
    function setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                switch (page) {
                    case 'home':
                        loadHome();
                        break;
                    case 'new-game':
                        loadNewGame();
                        break;
                    case 'history':
                        loadHistory();
                        break;
                    case 'leaderboard':
                        loadLeaderboard();
                        break;
                }
            });
        });
    }

    /**
     * Setup home page events
     */
    function setupHomeEvents() {
        document.getElementById('quick-new-game')?.addEventListener('click', loadNewGame);
    }

    /**
     * Setup new game form events
     */
    function setupNewGameEvents() {
        const form = document.getElementById('new-game-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();

                const playerCount = parseInt(document.getElementById('player-count').value);
                const playerNames = Array.from(document.querySelectorAll('#player-names-container input'))
                    .map(input => input.value);

                let gameType = document.getElementById('game-type').value;
                if (gameType === 'custom') {
                    gameType = document.getElementById('custom-points').value;
                }

                const winBelow = document.getElementById('win-below').checked;
                const scoringMode = document.querySelector('input[name="scoringMode"]:checked').value;

                currentGame = Game.createGame({
                    playerCount,
                    playerNames,
                    gameType,
                    winBelow,
                    scoringMode
                });

                Storage.saveGame(currentGame);
                loadActiveGame();
            });
        }
    }

    /**
     * Setup active game events
     */
    function setupGameEvents() {
        document.getElementById('submit-turn-btn')?.addEventListener('click', submitTurn);
        document.getElementById('undo-dart-btn')?.addEventListener('click', undoTurn);
        document.getElementById('end-game-btn')?.addEventListener('click', endGame);
    }

    /**
     * Setup history page events
     */
    function setupHistoryEvents() {
        const playerFilter = document.getElementById('history-player-filter');
        const sortSelect = document.getElementById('history-sort');

        if (playerFilter) {
            playerFilter.addEventListener('input', (e) => {
                UI.renderGameHistory(e.target.value, sortSelect.value);
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                UI.renderGameHistory(playerFilter?.value || '', e.target.value);
            });
        }

        const backBtn = document.getElementById('back-to-history');
        if (backBtn) {
            backBtn.addEventListener('click', loadHistory);
        }
    }

    /**
     * Setup leaderboard events
     */
    function setupLeaderboardEvents() {
        // Time filters
        document.querySelectorAll('.time-filters .filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-filters .filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const filter = e.target.dataset.filter;
                const metric = document.querySelector('.leaderboard-tabs .tab-btn.active').dataset.tab;
                UI.renderLeaderboard(metric, filter);
            });
        });

        // Metric tabs
        document.querySelectorAll('.leaderboard-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.leaderboard-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const metric = e.target.dataset.tab;
                const filter = document.querySelector('.time-filters .filter-btn.active').dataset.filter;
                UI.renderLeaderboard(metric, filter);
            });
        });

        // Back to leaderboard from profile
        const backBtn = document.getElementById('back-to-leaderboard');
        if (backBtn) {
            backBtn.addEventListener('click', loadLeaderboard);
        }
    }

    /**
     * Setup modal events
     */
    function setupModalEvents() {
        document.getElementById('modal-close')?.addEventListener('click', UI.hideModal);
        document.getElementById('modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                UI.hideModal();
            }
        });
    }

    /**
     * Load home page
     */
    function loadHome() {
        UI.showPage('home-page');
        UI.renderRecentGames();
        UI.renderQuickStats();
    }

    /**
     * Load new game page
     */
    function loadNewGame() {
        UI.showPage('new-game-page');
        UI.renderNewGameForm();
    }

    /**
     * Load active game page
     */
    function loadActiveGame() {
        if (!currentGame) return;
        UI.showPage('active-game-page');
        UI.updateActiveGameUI(currentGame);
    }

    /**
     * Load history page
     */
    function loadHistory() {
        const gameDetailPage = document.getElementById('game-detail-page');
        gameDetailPage.classList.add('hidden');
        document.getElementById('history-page').classList.remove('hidden');
        UI.showPage('history-page');
        UI.renderGameHistory();
    }

    /**
     * Load leaderboard page
     */
    function loadLeaderboard() {
        const profilePage = document.getElementById('player-profile-page');
        profilePage.classList.add('hidden');
        document.getElementById('leaderboard-page').classList.remove('hidden');
        UI.showPage('leaderboard-page');
        UI.renderLeaderboard('wins', 'all-time');
    }

    /**
     * Submit current turn
     */
    function submitTurn() {
        if (!currentGame) return;

        const inputs = document.querySelectorAll('.dart-input');
        const darts = Array.from(inputs)
            .map(input => input.value)
            .filter(v => v);

        if (darts.length === 0) {
            UI.showToast('Please enter at least one dart', 'warning');
            return;
        }

        const result = Game.submitTurn(currentGame, darts);

        if (!result.success) {
            UI.showToast(result.error, 'error');
            return;
        }

        if (result.gameEnded) {
            Storage.updateGame(currentGame.id, currentGame);
            UI.showToast(`${result.winner} wins! 🎉`, 'success');
            setTimeout(() => {
                currentGame = null;
                loadHome();
            }, 2000);
        } else {
            Storage.updateGame(currentGame.id, currentGame);
            UI.updateActiveGameUI(currentGame);
            UI.showToast(`Next: ${result.nextPlayer}`, 'info');
        }
    }

    /**
     * Undo last dart
     */
    function undoTurn() {
        if (!currentGame) return;

        const result = Game.undoLastDart(currentGame);
        if (!result.success) {
            UI.showToast(result.error, 'warning');
            return;
        }

        Storage.updateGame(currentGame.id, currentGame);
        UI.updateActiveGameUI(currentGame);
        UI.showToast(`Turn undone for ${result.player}`, 'info');
    }

    /**
     * End current game
     */
    function endGame() {
        if (!currentGame) return;

        if (confirm('Are you sure you want to end this game?')) {
            Game.endGame(currentGame);
            Storage.updateGame(currentGame.id, currentGame);
            currentGame = null;
            UI.showToast('Game ended', 'info');
            loadHome();
        }
    }

    /**
     * View game detail
     */
    function viewGameDetail(gameId) {
        document.getElementById('history-page').classList.add('hidden');
        document.getElementById('game-detail-page').classList.remove('hidden');
        UI.showPage('game-detail-page');
        UI.renderGameDetail(gameId);
    }

    /**
     * View player profile
     */
    function viewPlayerProfile(playerName) {
        document.getElementById('leaderboard-page').classList.add('hidden');
        document.getElementById('player-profile-page').classList.remove('hidden');
        UI.showPage('player-profile-page');
        UI.renderPlayerProfile(playerName);
    }

    /**
     * Resume active game (if exists)
     */
    function resumeGame() {
        const games = Storage.getGames();
        const activeGame = games.find(g => g.isActive);

        if (activeGame) {
            currentGame = activeGame;
            loadActiveGame();
            UI.showToast('Game resumed', 'info');
            return true;
        }

        return false;
    }

    // Public API
    return {
        init,
        loadHome,
        loadNewGame,
        loadActiveGame,
        loadHistory,
        loadLeaderboard,
        viewGameDetail,
        viewPlayerProfile,
        resumeGame,
        submitTurn,
        undoTurn,
        endGame
    };
})();

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();

    // Check if there's an active game to resume
    if (!App.resumeGame()) {
        App.loadHome();
    }

    // Periodic auto-save
    setInterval(() => {
        if (window.currentGame) {
            Storage.updateGame(window.currentGame.id, window.currentGame);
        }
    }, 30000);
});

// Handle beforeunload
window.addEventListener('beforeunload', (e) => {
    const games = Storage.getGames();
    const activeGame = games.find(g => g.isActive);
    if (activeGame) {
        e.preventDefault();
        e.returnValue = '';
    }
});
