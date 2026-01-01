/**
 * Spectator Module
 * Handles live game viewing for spectators
 */

const Spectator = (() => {
    let gameId = null;
    let currentGame = null;
    let subscription = null;
    let supabase = null;

    /**
     * Initialize spectator view
     */
    async function init() {
        try {
            // Get game ID from URL
            const params = new URLSearchParams(window.location.search);
            gameId = params.get('game');

            if (!gameId) {
                showError('No game ID provided');
                return;
            }

            // Initialize Supabase
            if (!SupabaseClient.isConnected()) {
                showError('Unable to connect to Supabase');
                return;
            }

            supabase = SupabaseClient.getClient();

            // Load initial game state
            await loadGame();

            // Subscribe to real-time updates
            subscribeToUpdates();
        } catch (error) {
            console.error('Spectator init error:', error);
            showError(error.message);
        }
    }

    /**
     * Load game from database
     */
    async function loadGame() {
        try {
            const { data, error } = await supabase
                .from('games')
                .select('*')
                .eq('id', gameId)
                .single();

            if (error || !data) {
                showError('Game not found. The game may have expired.');
                return;
            }

            currentGame = data;
            renderGame();
            showGameView();
        } catch (error) {
            console.error('Load game error:', error);
            showError('Failed to load game: ' + error.message);
        }
    }

    /**
     * Subscribe to real-time game updates
     */
    function subscribeToUpdates() {
        if (!supabase || !gameId) return;

        subscription = supabase
            .channel(`game:${gameId}`)
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'games',
                    filter: `id=eq.${gameId}`
                },
                (payload) => {
                    console.log('Game updated:', payload);
                    currentGame = payload.new;
                    renderGame();
                }
            )
            .subscribe((status) => {
                console.log('Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('✓ Subscribed to game updates');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('✗ Subscription error');
                    updateLiveStatus(false);
                }
            });
    }

    /**
     * Render game state
     */
    function renderGame() {
        if (!currentGame) return;

        // Update header
        document.getElementById('game-title').textContent = `${currentGame.game_type} Points Game`;
        document.getElementById('game-type').textContent = `${currentGame.game_type} Points`;

        const createdDate = new Date(currentGame.created_at);
        const timeAgo = getTimeAgo(createdDate);
        document.getElementById('game-started').textContent = `Started ${timeAgo}`;

        // Update game status
        const statusText = currentGame.is_active ? 'Active' : 'Completed';
        const statusColor = currentGame.is_active ? '#4CAF50' : '#999';
        document.getElementById('game-status').textContent = statusText;
        document.getElementById('game-status').style.color = statusColor;

        // Update current player
        if (currentGame.is_active && currentGame.current_player_index !== undefined) {
            const currentPlayer = currentGame.players[currentGame.current_player_index];
            document.getElementById('current-player').textContent = currentPlayer?.name || '-';
        }

        // Update total turns
        const totalTurns = currentGame.players.reduce((sum, p) => sum + p.turns.length, 0);
        document.getElementById('total-turns').textContent = totalTurns;

        // Render scoreboard
        renderScoreboard();

        // Render recent turns
        renderRecentTurns();
    }

    /**
     * Render scoreboard
     */
    function renderScoreboard() {
        const container = document.getElementById('spectator-scoreboard');
        container.innerHTML = currentGame.players.map((player, index) => {
            const isCurrent = index === currentGame.current_player_index && currentGame.is_active;
            const stats = player.stats;
            return `
                <div class="player-score-card ${isCurrent ? 'current' : ''}">
                    <div class="player-score-name">
                        ${player.winner ? '👑 ' : ''}${player.name}
                    </div>
                    <div class="player-score-value">${player.currentScore}</div>
                    <div class="player-score-stats">
                        <div>Turns: ${player.turns.length}</div>
                        <div>Darts: ${stats.totalDarts}</div>
                        <div>Avg: ${stats.totalDarts > 0 ? stats.avgPerDart.toFixed(1) : '—'}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render recent turns (last 10)
     */
    function renderRecentTurns() {
        const container = document.getElementById('spectator-turns');
        const allTurns = [];

        // Collect all turns with player info
        currentGame.players.forEach((player, playerIndex) => {
            player.turns.forEach((turn, turnIndex) => {
                allTurns.push({
                    player,
                    playerIndex,
                    turn,
                    turnIndex,
                    timestamp: turn.timestamp || 0
                });
            });
        });

        // Sort by timestamp (most recent first) and take last 10
        const recentTurns = allTurns
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .slice(0, 10);

        if (recentTurns.length === 0) {
            container.innerHTML = '<p class="placeholder">No turns yet</p>';
            return;
        }

        container.innerHTML = recentTurns.map(({ player, turn, turnIndex }) => {
            const turnTotal = turn.darts.reduce((a, b) => a + b, 0);
            return `
                <div class="turn-item ${turn.busted ? 'busted' : ''}">
                    <div class="turn-item-header">
                        ${player.name} - Turn ${turnIndex + 1}
                    </div>
                    <div class="turn-item-details">
                        <div class="turn-darts">
                            ${turn.darts.map(d => `<span class="turn-dart">${d}</span>`).join('')}
                            <span style="margin: 0 5px; color: #666;">=</span>
                            <span class="turn-dart" style="background: #e0e0e0; color: #333; font-weight: bold;">${turnTotal}</span>
                        </div>
                        <div class="turn-remaining">
                            Remaining: ${turn.remaining}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Show game view
     */
    function showGameView() {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-state').classList.add('hidden');
        document.getElementById('game-view').classList.remove('hidden');
    }

    /**
     * Show error state
     */
    function showError(message) {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('game-view').classList.add('hidden');
        document.getElementById('error-state').classList.remove('hidden');
        document.getElementById('error-message').textContent = message;
    }

    /**
     * Update live status indicator
     */
    function updateLiveStatus(isLive) {
        const indicator = document.getElementById('live-status');
        if (isLive) {
            indicator.textContent = '🔴 LIVE';
            indicator.style.color = '#ff4444';
        } else {
            indicator.textContent = '⚪ DISCONNECTED';
            indicator.style.color = '#999';
        }
    }

    /**
     * Get human-readable time ago
     */
    function getTimeAgo(date) {
        const now = new Date();
        const secondsAgo = Math.floor((now - date) / 1000);

        if (secondsAgo < 60) return 'just now';
        const minutesAgo = Math.floor(secondsAgo / 60);
        if (minutesAgo < 60) return `${minutesAgo}m ago`;
        const hoursAgo = Math.floor(minutesAgo / 60);
        if (hoursAgo < 24) return `${hoursAgo}h ago`;
        const daysAgo = Math.floor(hoursAgo / 24);
        return `${daysAgo}d ago`;
    }

    /**
     * Cleanup
     */
    function cleanup() {
        if (subscription) {
            supabase?.removeChannel(subscription);
        }
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

    // Public API
    return {
        init
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Spectator.init();
});
