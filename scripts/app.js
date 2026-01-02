/**
 * Main App Module
 * Handles routing, event listeners, and app state
 */

const App = (() => {
    let currentGame = null;
    let isSpectatorMode = false;
    let isOperationInProgress = false;

    /**
     * Check if an operation is in progress
     */
    function isOperationPending() {
        return isOperationInProgress;
    }

    /**
     * Mark operation as started
     */
    function startOperation() {
        isOperationInProgress = true;
    }

    /**
     * Mark operation as complete
     */
    function endOperation() {
        isOperationInProgress = false;
    }

    /**
     * Initialize the app and setup all event listeners
     */
    function init() {
        setupNavigation();
        setupHomeEvents();
        setupNewGameEvents();
        setupGameEvents();
        setupHistoryEvents();
        setupLeaderboardEvents();
        setupModalEvents();
    }

    /**
     * Handle route changes from router
     */
    async function handleRoute(routeInfo) {
        console.log('Handling route:', routeInfo);

        try {
            switch (routeInfo.route) {
                case 'home':
                    loadHome();
                    break;

                case 'game':
                    await loadGameFromUrl(routeInfo.gameId);
                    break;

                case 'new-game':
                    loadNewGame();
                    break;

                case 'history':
                    await loadHistory();
                    break;

                case 'game-detail':
                    await App.viewGameDetail(routeInfo.gameId);
                    break;

                case 'leaderboard':
                    await loadLeaderboard();
                    break;

                case 'player-profile':
                    await App.viewPlayerProfile(routeInfo.playerName);
                    break;

                default:
                    loadHome();
            }
        } catch (error) {
            console.error('Route handling error:', error);
            loadHome();
        }
    }

    /**
     * Load game from URL - determine if active or spectator
     */
    async function loadGameFromUrl(gameId) {
        UI.showLoader('Loading game...');
        try {
            const game = await Storage.getGame(gameId);
            if (!game) {
                UI.showToast('Game not found', 'error');
                loadHome();
                UI.hideLoader();
                return;
            }

            currentGame = game;
            isSpectatorMode = !Device.isGameOwner(game.device_id);

            if (isSpectatorMode) {
                console.log('Opening game in SPECTATOR mode');
                UI.showToast('📺 Viewing as Spectator', 'info');
                loadSpectatorGame();
            } else {
                console.log('Opening game in ACTIVE mode');
                UI.showToast('🎮 Game Resumed', 'info');
                loadActiveGame();
            }
            UI.hideLoader();
        } catch (error) {
            console.error('Error loading game:', error);
            UI.showToast('Failed to load game', 'error');
            loadHome();
            UI.hideLoader();
        }
    }

    /**
     * Check if running in spectator mode
     */
    function getIsSpectatorMode() {
        return isSpectatorMode;
    }

    /**
     * Setup navigation listeners
     */
    function setupNavigation() {
        // Handle navbar brand click to go home
        const navbarBrand = document.querySelector('.navbar-brand');
        if (navbarBrand) {
            navbarBrand.style.cursor = 'pointer';
            navbarBrand.addEventListener('click', () => {
                Router.navigate('home');
            });
        }

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                switch (page) {
                    case 'home':
                        Router.navigate('home');
                        break;
                    case 'new-game':
                        Router.navigate('new-game');
                        break;
                    case 'history':
                        Router.navigate('history');
                        break;
                    case 'leaderboard':
                        Router.navigate('leaderboard');
                        break;
                }
            });
        });
    }

    /**
     * Setup home page events
     */
    function setupHomeEvents() {
        document.getElementById('quick-new-game')?.addEventListener('click', () => {
            Router.navigate('new-game');
        });
    }

    /**
     * Setup new game form events
     */
    function setupNewGameEvents() {
        const form = document.getElementById('new-game-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
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

                try {
                    await Storage.saveGame(currentGame);
                    // Navigate to game URL instead of loading directly
                    Router.navigate('game', { gameId: currentGame.id });
                } catch (error) {
                    UI.showToast('Failed to save game', 'error');
                    console.error('Save game error:', error);
                }
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
        document.getElementById('share-game-btn')?.addEventListener('click', shareGame);
        document.getElementById('rematch-btn')?.addEventListener('click', startRematch);
        document.getElementById('home-btn')?.addEventListener('click', () => {
            Router.navigate('home');
        });
    }

    /**
     * Setup history page events
     */
    function setupHistoryEvents() {
        const playerFilter = document.getElementById('history-player-filter');
        const sortSelect = document.getElementById('history-sort');

        if (playerFilter) {
            playerFilter.addEventListener('input', async (e) => {
                await UI.renderGameHistory(e.target.value, sortSelect.value, 1);
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', async (e) => {
                await UI.renderGameHistory(playerFilter?.value || '', e.target.value, 1);
            });
        }

        // Pagination button events
        const paginationPrev = document.getElementById('pagination-prev');
        const paginationNext = document.getElementById('pagination-next');

        if (paginationPrev) {
            paginationPrev.addEventListener('click', async (e) => {
                e.preventDefault();
                const currentPage = UI.getPaginationState().currentPage;
                await UI.renderGameHistory(
                    UI.getPaginationState().filter,
                    UI.getPaginationState().sortOrder,
                    currentPage - 1
                );
            });
        }

        if (paginationNext) {
            paginationNext.addEventListener('click', async (e) => {
                e.preventDefault();
                const currentPage = UI.getPaginationState().currentPage;
                await UI.renderGameHistory(
                    UI.getPaginationState().filter,
                    UI.getPaginationState().sortOrder,
                    currentPage + 1
                );
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
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('.time-filters .filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const filter = e.target.dataset.filter;
                const metric = document.querySelector('.leaderboard-tabs .tab-btn.active').dataset.tab;
                await UI.renderLeaderboard(metric, filter);
            });
        });

        // Metric tabs
        document.querySelectorAll('.leaderboard-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('.leaderboard-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const metric = e.target.dataset.tab;
                const filter = document.querySelector('.time-filters .filter-btn.active').dataset.filter;
                await UI.renderLeaderboard(metric, filter);
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
    async function loadHome() {
        UI.showLoader('Loading dashboard...');
        try {
            UI.showPage('home-page');
            await UI.renderRecentGames();
        } catch (error) {
            console.error('Error loading home:', error);
            UI.showToast('Failed to load dashboard', 'error');
        } finally {
            UI.hideLoader();
        }
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
     * Load game in spectator mode (read-only)
     */
    function loadSpectatorGame() {
        if (!currentGame) return;
        UI.showPage('active-game-page');
        UI.renderSpectatorGame(currentGame);
    }

    /**
     * Load history page
     */
    async function loadHistory() {
        const gameDetailPage = document.getElementById('game-detail-page');
        gameDetailPage.classList.add('hidden');
        document.getElementById('history-page').classList.remove('hidden');
        UI.showPage('history-page');
        await UI.renderGameHistory();
    }

    /**
     * Load leaderboard page
     */
    async function loadLeaderboard() {
        const profilePage = document.getElementById('player-profile-page');
        profilePage.classList.add('hidden');
        document.getElementById('leaderboard-page').classList.remove('hidden');
        UI.showPage('leaderboard-page');
        await UI.renderLeaderboard('wins', 'all-time');
    }

    /**
     * Submit current turn
     */
    async function submitTurn() {
        if (!currentGame || isOperationInProgress) return;

        // Prevent multiple submissions
        startOperation();
        UI.showLoader('Submitting turn...');

        try {
            const inputs = document.querySelectorAll('.dart-input');
            console.log('Found dart inputs:', inputs.length);

            const darts = Array.from(inputs)
                .map(input => input.value)
                .filter(v => v);

            console.log('Darts to submit:', darts);

            if (darts.length === 0) {
                UI.showToast('Please enter at least one dart', 'warning');
                endOperation();
                UI.hideLoader();
                return;
            }

            // Track previous turn before submitting
            const previousTurn = currentGame.current_turn;

            const result = Game.submitTurn(currentGame, darts);
            console.log('Turn submission result:', result);

            if (!result.success) {
                UI.showToast(result.error, 'error');
                endOperation();
                UI.hideLoader();
                return;
            }

            console.log('Saving game to database...');
            await Storage.updateGame(currentGame.id, currentGame);
            console.log('Game saved successfully');

            // Determine if round completed (current_turn increased)
            const roundCompleted = currentGame.current_turn > previousTurn;
            console.log(`Round completed: ${roundCompleted} (prev: ${previousTurn}, curr: ${currentGame.current_turn})`);

            // Player finished - update winners board
            if (result.playerFinished) {
                // Always animate when player finishes
                UI.updateWinnersBoard(result.allRankings, true);
                UI.showToast(`🏆 ${result.playerFinished} finished in ${['1st', '2nd', '3rd'][result.finishRank - 1] || result.finishRank + 'th'} place!`, 'success');

                // If game ended (last player finished)
                if (result.gameEnded) {
                    UI.updateWinnersBoard(result.finalRankings, true);
                    setTimeout(() => {
                        showGameCompletionModal(result.finalRankings);
                    }, 800);
                } else {
                    // Continue with next player
                    setTimeout(() => {
                        UI.updateActiveGameUI(currentGame, false); // Don't animate on next player setup
                        UI.showToast(`Next: ${result.nextPlayer}`, 'info');
                    }, 800);
                }
            } else {
                // Update rankings: animate only if round completed
                UI.updateWinnersBoard(result.allRankings || Game.getRankings(currentGame), roundCompleted);
                UI.updateActiveGameUI(currentGame, false); // Don't animate on regular update
                UI.showToast(`Next: ${result.nextPlayer}`, 'info');
            }
        } catch (error) {
            console.error('Error submitting turn:', error);
            UI.showToast('Failed to submit turn', 'error');
        } finally {
            endOperation();
            UI.hideLoader();
        }
    }

    /**
     * Undo last dart
     */
    async function undoTurn() {
        if (!currentGame) return;

        const result = Game.undoLastDart(currentGame);
        if (!result.success) {
            UI.showToast(result.error, 'warning');
            return;
        }

        await Storage.updateGame(currentGame.id, currentGame);
        UI.updateActiveGameUI(currentGame);
        UI.showToast(`Turn undone for ${result.player}`, 'info');
    }

    /**
     * End current game
     */
    async function endGame() {
        if (!currentGame) return;

        if (confirm('Are you sure you want to end this game?')) {
            Game.endGame(currentGame);
            await Storage.updateGame(currentGame.id, currentGame);
            currentGame = null;
            UI.showToast('Game ended', 'info');
            Router.navigate('home');
        }
    }

    /**
     * Show game completion modal with final rankings
     */
    function showGameCompletionModal(finalRankings) {
        const modal = document.getElementById('game-completion-modal');
        const rankingsDiv = document.getElementById('completion-rankings');

        console.log('showGameCompletionModal called');
        console.log('finalRankings:', finalRankings);
        console.log('finalRankings type:', typeof finalRankings);
        console.log('finalRankings is array:', Array.isArray(finalRankings));
        console.log('finalRankings length:', finalRankings ? finalRankings.length : 'N/A');
        console.log('modal element found:', !!modal);
        console.log('rankingsDiv element found:', !!rankingsDiv);

        if (!modal || !rankingsDiv) {
            console.error('Modal or rankings div not found!');
            return;
        }

        if (!finalRankings || !Array.isArray(finalRankings) || finalRankings.length === 0) {
            console.error('No valid rankings data available!', finalRankings);
            rankingsDiv.innerHTML = '<p>No rankings available</p>';
            UI.showModal(modal);
            return;
        }

        // Display final rankings
        let rankingsHtml = '<div class="final-rankings">';
        console.log('Rendering rankings:');
        finalRankings.forEach((player, index) => {
            console.log(`  Ranking ${index}:`, player);
            const medals = ['🥇', '🥈', '🥉'];
            const medal = medals[index] || '🏅';
            const position = index + 1;
            let suffix = 'th';
            if (position % 10 === 1 && position % 100 !== 11) suffix = 'st';
            else if (position % 10 === 2 && position % 100 !== 12) suffix = 'nd';
            else if (position % 10 === 3 && position % 100 !== 13) suffix = 'rd';

            rankingsHtml += `
                <div class="ranking-row">
                    <span class="rank-medal">${medal}</span>
                    <span class="rank-position">${position}${suffix}</span>
                    <span class="rank-name">${player.name}</span>
                    <span class="rank-stats">${player.darts} darts • ${parseFloat(player.avgPerDart).toFixed(1)} avg</span>
                </div>
            `;
        });
        rankingsHtml += '</div>';

        console.log('Rankings HTML:', rankingsHtml);
        rankingsDiv.innerHTML = rankingsHtml;
        console.log('Rankings HTML set in DOM');
        // Show the game completion modal directly (don't use UI.showModal which is for generic modal)
        modal.classList.remove('hidden');
    }

    /**
     * Start a rematch with the same players
     */
    async function startRematch() {
        if (!currentGame) return;

        // Extract player names from current game
        const playerNames = currentGame.players.map(p => p.name);
        const gameType = currentGame.game_type;
        const winCondition = currentGame.win_condition;
        const scoringMode = currentGame.scoring_mode;

        // Hide completion modal
        const modal = document.getElementById('game-completion-modal');
        modal.classList.add('hidden');

        // Create new game with same settings
        const newGame = Game.createGame({
            playerCount: playerNames.length,
            playerNames: playerNames,
            gameType: gameType,
            winBelow: winCondition === 'below',
            scoringMode: scoringMode
        });

        // Save to database
        await Storage.saveGame(newGame);

        // Load and display the new game
        currentGame = newGame;
        loadActiveGame(newGame.id);

        UI.showToast('Starting rematch...', 'info');
    }

    /**
     * Share current game
     */
    function shareGame() {
        if (!currentGame) return;

        // Generate spectator link (will use spectator.html once created)
        const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
        const shareUrl = `${baseUrl}/spectator.html?game=${currentGame.id}`;

        // Copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            UI.showToast('Share link copied to clipboard! 📋', 'success');

            // Show modal with share link
            UI.showModal(`
                <div style="text-align: center;">
                    <h3 style="margin-bottom: 15px;">Share This Game</h3>
                    <p style="margin-bottom: 15px;">Send this link to friends to watch the game live:</p>
                    <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin: 15px 0; word-break: break-all;">
                        <code style="font-size: 12px;">${shareUrl}</code>
                    </div>
                    <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${shareUrl}'); alert('Copied!');" style="margin-top: 10px;">
                        📋 Copy Link
                    </button>
                </div>
            `, 'Share Game');
        }).catch(() => {
            UI.showToast('Failed to copy link', 'error');
        });
    }

    /**
     * View game detail
     */
    async function viewGameDetail(gameId) {
        document.getElementById('history-page').classList.add('hidden');
        document.getElementById('game-detail-page').classList.remove('hidden');
        UI.showPage('game-detail-page');
        await UI.renderGameDetail(gameId);
    }

    /**
     * View player profile
     */
    async function viewPlayerProfile(playerName) {
        document.getElementById('leaderboard-page').classList.add('hidden');
        document.getElementById('player-profile-page').classList.remove('hidden');
        UI.showPage('player-profile-page');
        await UI.renderPlayerProfile(playerName);
    }

    /**
     * Resume active game (if exists and was interrupted)
     * Only resume if:
     * - Game is marked as active
     * - Game has at least one turn (was actually played)
     * - Game has no completion date (wasn't finished)
     */
    async function resumeGame() {
        try {
            const games = await Storage.getGames();
            console.log('Total games in DB:', games.length);

            // Debug: log all games and their status
            games.forEach(g => {
                console.log(`Game ${g.id.substring(0, 8)}: is_active=${g.is_active}, completed_at=${g.completed_at}, players=${g.players.length}, turns=${g.players.reduce((sum, p) => sum + p.turns.length, 0)}`);
            });

            // Find an active game that was interrupted (not completed)
            // Also accept games that are active with at least 1 turn but no completion date
            const activeGame = games.find(g =>
                g.is_active &&
                !g.completed_at &&
                g.players.some(p => p.turns.length > 0)
            );

            if (activeGame) {
                console.log('Found active game to resume:', activeGame.id);
                currentGame = activeGame;
                loadActiveGame();
                UI.showToast('Game resumed', 'info');
                return true;
            }

            console.log('No active game found to resume');
            return false;
        } catch (error) {
            console.error('Resume game error:', error);
            return false;
        }
    }

    // Public API
    return {
        init,
        handleRoute,
        getIsSpectatorMode,
        loadHome,
        loadNewGame,
        loadActiveGame,
        loadSpectatorGame,
        loadHistory,
        loadLeaderboard,
        loadGameFromUrl,
        viewGameDetail,
        viewPlayerProfile,
        resumeGame,
        submitTurn,
        undoTurn,
        endGame,
        shareGame
    };
})();

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize app event listeners
    App.init();

    // Initialize router with route change handler
    Router.init(App.handleRoute);

    // Periodic auto-save for current game
    setInterval(async () => {
        if (window.currentGame) {
            try {
                await Storage.updateGame(window.currentGame.id, window.currentGame);
            } catch (error) {
                console.error('Auto-save failed:', error);
            }
        }
    }, 30000);
});

// Handle beforeunload
window.addEventListener('beforeunload', async (e) => {
    // Check if there's an active game that needs saving
    if (window.currentGame && window.currentGame.is_active) {
        e.preventDefault();
        e.returnValue = '';
    }
});
