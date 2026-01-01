/**
 * UI Module
 * Handles DOM manipulation and rendering
 */

const UI = (() => {
    /**
     * Show toast notification
     */
    function showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideInRight 200ms ease-in-out reverse';
            setTimeout(() => toast.remove(), 200);
        }, duration);
    }

    /**
     * Show modal dialog
     */
    function showModal(content, title = '') {
        const modal = document.getElementById('modal');
        const body = document.getElementById('modal-body');
        body.innerHTML = '';

        if (title) {
            const titleEl = document.createElement('h2');
            titleEl.textContent = title;
            body.appendChild(titleEl);
        }

        if (typeof content === 'string') {
            body.innerHTML += content;
        } else {
            body.appendChild(content);
        }

        modal.classList.remove('hidden');
    }

    /**
     * Hide modal
     */
    function hideModal() {
        document.getElementById('modal').classList.add('hidden');
    }

    /**
     * Show page
     */
    function showPage(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');

        // Update nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageId.replace('-page', '')}"]`)?.classList.add('active');

        // Scroll to top
        window.scrollTo(0, 0);
    }

    /**
     * Render recent games on home page
     */
    function renderRecentGames() {
        const container = document.getElementById('recent-games-list');
        const games = Storage.getGames().filter(g => g.completedAt).slice(-5).reverse();

        if (games.length === 0) {
            container.innerHTML = '<p class="placeholder">No games yet. Start your first game!</p>';
            return;
        }

        container.innerHTML = games.map(game => {
            const winner = game.players.find(p => p.winner);
            const date = new Date(game.createdAt);
            const dateStr = date.toLocaleDateString();

            return `
                <div class="game-card" onclick="App.viewGameDetail('${game.id}')">
                    <div class="game-card-header">
                        <div class="game-card-title">${game.gameType} Points</div>
                        <div class="game-card-date">${dateStr}</div>
                    </div>
                    <div class="game-card-players">
                        ${game.players.map(p => `
                            <div class="player-badge ${p.winner ? 'winner' : ''}">
                                ${p.name}
                            </div>
                        `).join('')}
                    </div>
                    <div class="game-card-footer">
                        <span>Winner: ${winner?.name || 'N/A'}</span>
                        <span class="game-type-badge">${game.players.length} players</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render quick stats on home page
     */
    function renderQuickStats() {
        const stats = Stats.getQuickStats();

        const games = Storage.getGames();
        const playerGames = games.length > 0 ? games.filter(g => g.completedAt) : [];

        let totalGames = 0;
        let totalWins = 0;
        let totalDarts = 0;
        let totalScore = 0;
        let total180s = 0;

        if (playerGames.length > 0) {
            playerGames.forEach(game => {
                totalGames++;
                game.players.forEach(player => {
                    if (player.winner) totalWins++;
                    totalDarts += player.stats.totalDarts;
                    totalScore += player.stats.totalScore;
                    player.turns.forEach(turn => {
                        if (turn.darts.reduce((a, b) => a + b, 0) === 180) {
                            total180s++;
                        }
                    });
                });
            });
        }

        const avgPerDart = totalDarts > 0 ? (totalScore / totalDarts).toFixed(2) : '—';
        const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '—';

        document.getElementById('stat-games').textContent = totalGames;
        document.getElementById('stat-win-rate').textContent = typeof winRate === 'number' ? `${winRate}%` : winRate;
        document.getElementById('stat-avg-dart').textContent = avgPerDart;
        document.getElementById('stat-180s').textContent = total180s;
    }

    /**
     * Render new game form
     */
    function renderNewGameForm() {
        const form = document.getElementById('new-game-form');
        const playerCountInput = document.getElementById('player-count');
        const gameTypeSelect = document.getElementById('game-type');
        const customPointsInput = document.getElementById('custom-points');
        const playerNamesContainer = document.getElementById('player-names-container');

        // Handle player count changes
        document.getElementById('increase-players').onclick = (e) => {
            e.preventDefault();
            const current = parseInt(playerCountInput.value);
            if (current < 8) {
                playerCountInput.value = current + 1;
                updatePlayerNameInputs();
            }
        };

        document.getElementById('decrease-players').onclick = (e) => {
            e.preventDefault();
            const current = parseInt(playerCountInput.value);
            if (current > 1) {
                playerCountInput.value = current - 1;
                updatePlayerNameInputs();
            }
        };

        // Handle game type changes
        gameTypeSelect.addEventListener('change', () => {
            if (gameTypeSelect.value === 'custom') {
                customPointsInput.classList.remove('hidden');
                customPointsInput.focus();
            } else {
                customPointsInput.classList.add('hidden');
            }
        });

        function updatePlayerNameInputs() {
            const count = parseInt(playerCountInput.value);
            playerNamesContainer.innerHTML = '';

            for (let i = 0; i < count; i++) {
                const input = document.createElement('input');
                input.type = 'text';
                input.name = `player-${i}`;
                input.placeholder = `Player ${i + 1} (optional)`;
                playerNamesContainer.appendChild(input);
            }
        }

        updatePlayerNameInputs();
    }

    /**
     * Render scoreboard during active game
     */
    function renderScoreboard(game) {
        const container = document.getElementById('scoreboard');
        container.innerHTML = game.players.map((player, index) => {
            const isCurrent = index === game.currentPlayerIndex;
            const stats = player.stats;
            return `
                <div class="player-score-card ${isCurrent ? 'current' : ''}">
                    <div class="player-score-name">${player.name}</div>
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
     * Render dart input fields
     */
    function renderDartInputs(game) {
        const container = document.getElementById('dart-inputs-container');
        const player = Game.getCurrentPlayer(game);
        const mode = game.scoringMode;

        container.innerHTML = '';

        if (mode === 'per-dart') {
            for (let i = 0; i < 3; i++) {
                const group = document.createElement('div');
                group.className = 'dart-input-group';
                group.innerHTML = `
                    <label>Dart ${i + 1}</label>
                    <input type="number" min="0" max="180" class="dart-input" placeholder="0">
                `;
                container.appendChild(group);
            }
        } else {
            const group = document.createElement('div');
            group.className = 'dart-input-group';
            group.innerHTML = `
                <label>Turn Total (3 darts)</label>
                <input type="number" min="0" max="180" class="dart-input" placeholder="0">
            `;
            container.appendChild(group);
        }

        // Add quick buttons
        const quickSection = document.createElement('div');
        quickSection.className = 'dart-number-pad';
        Game.getQuickDarts().forEach(dart => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dart-quick-btn';
            btn.textContent = dart;
            btn.onclick = (e) => {
                e.preventDefault();
                const inputs = container.querySelectorAll('.dart-input');
                const firstEmpty = Array.from(inputs).find(input => !input.value);
                if (firstEmpty) {
                    firstEmpty.value = dart;
                    firstEmpty.focus();
                }
            };
            quickSection.appendChild(btn);
        });
        container.appendChild(quickSection);
    }

    /**
     * Render current player info
     */
    function renderCurrentPlayer(game) {
        const player = Game.getCurrentPlayer(game);
        document.getElementById('current-player-name').textContent = `${player.name}'s Turn`;
        document.getElementById('game-title').textContent = `${game.gameType} - Turn ${game.currentTurn + 1}`;
    }

    /**
     * Render turn history
     */
    function renderTurnHistory(game) {
        const container = document.getElementById('turn-history');
        container.innerHTML = '';

        game.players.forEach((player, playerIndex) => {
            if (player.turns.length === 0) return;

            player.turns.forEach((turn, turnIndex) => {
                const isCurrentPlayer = playerIndex === game.currentPlayerIndex;
                const turnsHTML = `
                    <div class="turn-item ${turn.busted ? 'busted' : ''}">
                        <div class="turn-item-header">
                            ${isCurrentPlayer ? '➜ ' : ''}${player.name} - Turn ${turnIndex + 1}
                        </div>
                        <div class="turn-item-details">
                            <div class="turn-darts">
                                ${turn.darts.map(d => `<span class="turn-dart">${d}</span>`).join('')}
                            </div>
                            <div class="turn-remaining">
                                Remaining: ${turn.remaining}
                            </div>
                        </div>
                    </div>
                `;
                container.innerHTML += turnsHTML;
            });
        });
    }

    /**
     * Render game history list
     */
    function renderGameHistory(filter = '', sortOrder = 'newest') {
        const container = document.getElementById('games-history-list');
        let games = Storage.getGames().filter(g => g.completedAt);

        if (filter) {
            games = games.filter(g =>
                g.players.some(p => p.name.toLowerCase().includes(filter.toLowerCase()))
            );
        }

        if (sortOrder === 'oldest') {
            games.sort((a, b) => a.createdAt - b.createdAt);
        } else {
            games.sort((a, b) => b.createdAt - a.createdAt);
        }

        if (games.length === 0) {
            container.innerHTML = '<p class="placeholder">No games found</p>';
            return;
        }

        container.innerHTML = games.map(game => {
            const winner = game.players.find(p => p.winner);
            const date = new Date(game.createdAt);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="game-card" onclick="App.viewGameDetail('${game.id}')">
                    <div class="game-card-header">
                        <div class="game-card-title">${game.gameType} Points</div>
                        <div class="game-card-date">${dateStr} ${timeStr}</div>
                    </div>
                    <div class="game-card-players">
                        ${game.players.map(p => `
                            <div class="player-badge ${p.winner ? 'winner' : ''}">
                                ${p.name}
                            </div>
                        `).join('')}
                    </div>
                    <div class="game-card-footer">
                        <span>Winner: ${winner?.name || 'N/A'}</span>
                        <span class="game-type-badge">${game.players.length} players</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render game detail view
     */
    function renderGameDetail(gameId) {
        const game = Storage.getGame(gameId);
        if (!game) return;

        const content = document.getElementById('game-detail-content');
        const winner = game.players.find(p => p.winner);
        const date = new Date(game.createdAt);

        const duration = game.completedAt ? Game.formatDuration(game.completedAt - game.createdAt) : 'N/A';

        let html = `
            <div class="detail-header">
                <div class="detail-header-row">
                    <div class="detail-header-item">
                        <div class="detail-label">Game Type</div>
                        <div class="detail-value">${game.gameType} Points</div>
                    </div>
                    <div class="detail-header-item">
                        <div class="detail-label">Date</div>
                        <div class="detail-value">${date.toLocaleDateString()}</div>
                    </div>
                    <div class="detail-header-item">
                        <div class="detail-label">Winner</div>
                        <div class="detail-value">${winner?.name || 'N/A'}</div>
                    </div>
                    <div class="detail-header-item">
                        <div class="detail-label">Duration</div>
                        <div class="detail-value">${duration}</div>
                    </div>
                </div>
            </div>
        `;

        game.players.forEach(player => {
            html += `
                <div class="player-turns">
                    <div class="player-turns-header">
                        ${player.winner ? '👑 ' : ''}${player.name}
                        <span style="float: right;">Darts: ${player.stats.totalDarts}</span>
                    </div>
            `;

            player.turns.forEach((turn, turnIndex) => {
                const turnTotal = turn.darts.reduce((a, b) => a + b, 0);
                html += `
                    <div class="turn-row">
                        <div class="turn-number">Turn ${turnIndex + 1}</div>
                        <div class="turn-darts-detail">
                            ${turn.darts.map(d => `<div class="turn-dart-box">${d}</div>`).join('')}
                            <div class="turn-dart-box" style="background: #f5f5f5; color: #666;">=</div>
                            <div class="turn-dart-box" style="background: #f5f5f5; color: #666;">${turnTotal}</div>
                        </div>
                        <div class="turn-score-remaining">${turn.remaining}</div>
                    </div>
                `;
            });

            html += `</div>`;
        });

        content.innerHTML = html;
    }

    /**
     * Render leaderboard
     */
    function renderLeaderboard(metric = 'wins', timeFilter = 'all-time') {
        const container = document.getElementById('leaderboard-content');
        const rankings = Stats.getLeaderboard(metric, timeFilter);

        if (rankings.length === 0) {
            container.innerHTML = '<p class="placeholder">No games yet</p>';
            return;
        }

        const metricLabel = {
            'wins': 'Wins',
            'win-rate': 'Win Rate',
            'avg-dart': 'Avg/Dart',
            '180s': '180s'
        }[metric] || 'Wins';

        container.innerHTML = rankings.map((entry, index) => {
            const rank = index + 1;
            const rankClass = `rank-${rank}`;
            let metricDisplay = '';

            switch (metric) {
                case 'wins':
                    metricDisplay = entry.stats.gamesWon;
                    break;
                case 'win-rate':
                    metricDisplay = `${entry.stats.winRate}%`;
                    break;
                case 'avg-dart':
                    metricDisplay = entry.stats.avgPerDart;
                    break;
                case '180s':
                    metricDisplay = entry.stats.total180s;
                    break;
            }

            return `
                <div class="leaderboard-entry" onclick="App.viewPlayerProfile('${entry.name}')">
                    <div class="leaderboard-rank ${rankClass}">#${rank}</div>
                    <div class="leaderboard-player">
                        <div class="leaderboard-player-name">${entry.name}</div>
                        <div class="leaderboard-player-detail">
                            ${entry.stats.gamesPlayed} games
                        </div>
                    </div>
                    <div class="leaderboard-stat">
                        <div class="leaderboard-stat-value">${metricDisplay}</div>
                        <div class="leaderboard-stat-label">${metricLabel}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render player profile
     */
    function renderPlayerProfile(playerName) {
        const stats = Stats.calculatePlayerStats(playerName);
        const content = document.getElementById('player-profile-content');

        let html = `
            <div class="profile-section">
                <h3>Overall Stats</h3>
                <div class="stats-matrix">
                    <div class="stat-box">
                        <div class="stat-box-label">Games Played</div>
                        <div class="stat-box-value">${stats.gamesPlayed}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label">Wins</div>
                        <div class="stat-box-value">${stats.gamesWon}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label">Win Rate</div>
                        <div class="stat-box-value">${stats.winRate}%</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label">Avg/Dart</div>
                        <div class="stat-box-value">${stats.avgPerDart}</div>
                    </div>
                </div>
            </div>

            <div class="profile-section">
                <h3>Dart Stats</h3>
                <div class="stats-matrix">
                    <div class="stat-box">
                        <div class="stat-box-label">Total Darts</div>
                        <div class="stat-box-value">${stats.totalDarts}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label">Max Dart</div>
                        <div class="stat-box-value">${stats.maxDart}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label">Max Turn</div>
                        <div class="stat-box-value">${stats.maxTurn}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label">180s</div>
                        <div class="stat-box-value">${stats.total180s}</div>
                    </div>
                </div>
            </div>

            <div class="profile-section">
                <h3>High Scores</h3>
                <div class="stats-matrix">
                    <div class="stat-box">
                        <div class="stat-box-label">140+ Turns</div>
                        <div class="stat-box-value">${stats.total140plus}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-label">Checkout %</div>
                        <div class="stat-box-value">${stats.checkoutPercentage}%</div>
                    </div>
                </div>
            </div>
        `;

        if (Object.keys(stats.headToHead).length > 0) {
            html += `
                <div class="profile-section">
                    <h3>Head-to-Head Records</h3>
                    <div class="head-to-head-list">
                        ${Object.entries(stats.headToHead).map(([opponent, record]) => {
                            const total = record.wins + record.losses;
                            return `
                                <div class="h2h-card">
                                    <div class="h2h-opponent">${opponent}</div>
                                    <div class="h2h-record">
                                        <span class="h2h-wins">${record.wins}W</span>
                                        <span class="h2h-losses">${record.losses}L</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        document.getElementById('profile-player-name').textContent = `${playerName}'s Profile`;
        content.innerHTML = html;
    }

    /**
     * Update active game UI
     */
    function updateActiveGameUI(game) {
        renderScoreboard(game);
        renderCurrentPlayer(game);
        renderDartInputs(game);
        renderTurnHistory(game);
    }

    // Public API
    return {
        showToast,
        showModal,
        hideModal,
        showPage,
        renderRecentGames,
        renderQuickStats,
        renderNewGameForm,
        renderScoreboard,
        renderDartInputs,
        renderCurrentPlayer,
        renderTurnHistory,
        renderGameHistory,
        renderGameDetail,
        renderLeaderboard,
        renderPlayerProfile,
        updateActiveGameUI
    };
})();
