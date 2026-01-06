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
     * Show loader overlay
     */
    function showLoader(text = 'Loading...') {
        const loader = document.getElementById('loader');
        const loaderText = loader.querySelector('.loader-text');
        loaderText.textContent = text;
        loader.classList.remove('hidden');
    }

    /**
     * Hide loader overlay
     */
    function hideLoader() {
        const loader = document.getElementById('loader');
        loader.classList.add('hidden');
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
    async function renderStatsWidget() {
        try {
            const stats = await Stats.getQuickStats();

            document.getElementById('stat-games').textContent = stats.totalGames || '0';
            document.getElementById('stat-players').textContent = stats.totalPlayers || '0';
            document.getElementById('stat-top-player').textContent = stats.topPlayer || '—';
            document.getElementById('stat-avg').textContent = stats.highestAvg || '0';
        } catch (error) {
            console.error('Error rendering stats widget:', error);
            // Set default values on error
            document.getElementById('stat-games').textContent = '0';
            document.getElementById('stat-players').textContent = '0';
            document.getElementById('stat-top-player').textContent = '—';
            document.getElementById('stat-avg').textContent = '0';
        }
    }

    async function renderRecentGames() {
        try {
            const container = document.getElementById('recent-games-list');
            if (!container) {
                console.error('recent-games-list container not found');
                return;
            }

            // Also render stats widget
            await renderStatsWidget();

            const allGames = await Storage.getGames();
            console.log('Total games loaded:', allGames.length);

            // Debug: Log all games
            allGames.forEach(g => {
                const totalTurns = g.players.reduce((sum, p) => sum + p.turns.length, 0);
                console.log(`Game ${g.id.substring(0, 8)}: is_active=${g.is_active}, completed_at=${g.completed_at}, turns=${totalTurns}`);
            });

            // Separate interrupted and completed games
            // Only show games that have at least 1 turn played
            const interruptedGames = allGames.filter(g => {
                const totalTurns = g.players.reduce((sum, p) => sum + p.turns.length, 0);
                const isInterrupted = g.is_active && !g.completed_at && totalTurns > 0;
                if (isInterrupted) {
                    console.log('Interrupted game found:', g.id, 'with', totalTurns, 'total turns');
                }
                return isInterrupted;
            });
            // Get only 5 most recent completed games (already ordered by database as newest first)
            const completedGames = allGames.filter(g => g.completed_at).slice(0, 5);

            console.log('Interrupted games:', interruptedGames.length);
            console.log('Completed games:', completedGames.length);

            if (interruptedGames.length === 0 && completedGames.length === 0) {
                container.innerHTML = '<p class="placeholder">No games yet. Start your first game!</p>';
                return;
            }

            let html = '';

            // Show interrupted games first with Resume button
            if (interruptedGames.length > 0) {
                html += '<div class="interrupted-games-section">';
                html += '<div class="section-title">⏸️ Interrupted Games</div>';

                interruptedGames.forEach(game => {
                    const currentPlayerIndex = game.current_player_index || 0;
                    const currentPlayer = game.players[currentPlayerIndex];
                    const date = new Date(game.created_at);
                    const dateStr = date.toLocaleDateString();
                    const totalTurns = game.players.reduce((sum, p) => sum + p.turns.length, 0);

                    html += `
                        <div class="game-card interrupted-card">
                            <div class="game-card-header">
                                <div class="game-card-title">${game.game_type} Points</div>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <div class="game-card-date">${dateStr}</div>
                                    <span class="game-status-badge" style="background: #ff9800; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">IN PROGRESS</span>
                                </div>
                            </div>
                            <div class="game-card-players">
                                ${game.players.map(p => {
                                    const playerTurns = p.turns.length;
                                    return `
                                        <div class="player-badge ${p.name === currentPlayer?.name ? 'current' : ''}">
                                            ${p.name} (${playerTurns} turn${playerTurns !== 1 ? 's' : ''})
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            <div class="game-card-footer">
                                <span>Turn ${totalTurns} • Now: ${currentPlayer?.name || 'N/A'}</span>
                                <span class="game-type-badge">${game.players.length} players</span>
                            </div>
                            <button class="btn btn-primary btn-small" onclick="Router.navigate('game', {gameId: '${game.id}'})" style="width: 100%; margin-top: 8px;">
                                ▶️ Resume Game
                            </button>
                        </div>
                    `;
                });

                html += '</div>';
            }

            // Show completed games
            if (completedGames.length > 0) {
                const needsWrapper = interruptedGames.length > 0;
                if (needsWrapper) {
                    html += '<div class="recent-games-section" style="margin-top: 16px;">';
                }

                html += '<div class="section-title">📜 Recent Games</div>';

                html += completedGames.map(game => {
                    const winner = game.players.find(p => p.winner);
                    const date = new Date(game.created_at);
                    const dateStr = date.toLocaleDateString();
                    const completedDate = game.completed_at ? new Date(game.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                    return `
                        <div class="game-card" onclick="Router.navigate('game-detail', {gameId: '${game.id}'})">
                            <div class="game-card-header">
                                <div class="game-card-title">${game.game_type} Points</div>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <div class="game-card-date">${dateStr}</div>
                                    <span class="game-status-badge" style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">COMPLETED</span>
                                </div>
                            </div>
                            <div class="game-card-players">
                                ${game.players.map(p => `
                                    <div class="player-badge ${p.winner ? 'winner' : ''}">
                                        ${p.name}
                                    </div>
                                `).join('')}
                            </div>
                            <div class="game-card-footer">
                                <span>🏆 ${winner?.name || 'N/A'}</span>
                                <span class="game-type-badge">${game.players.length} players</span>
                            </div>
                        </div>
                    `;
                }).join('');

                if (needsWrapper) {
                    html += '</div>';
                }
            }

            container.innerHTML = html;
            console.log('Recent games rendered successfully');
        } catch (error) {
            console.error('Error rendering recent games:', error);
            const container = document.getElementById('recent-games-list');
            if (container) {
                container.innerHTML = '<p class="placeholder">Error loading games. Please refresh the page.</p>';
            }
        }
    }

    /**
     * Render quick stats on home page
     */
    async function renderQuickStats() {
        const stats = await Stats.getQuickStats();

        const games = await Storage.getGames();
        const playerGames = games.length > 0 ? games.filter(g => g.completed_at) : [];

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

        // Calculate average per 3 darts (per turn) instead of per individual dart
        const avgPerDart = totalDarts > 0 ? ((totalScore / totalDarts) * 3).toFixed(2) : '—';
        const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '—';

        document.getElementById('stat-games').textContent = totalGames;
        document.getElementById('stat-win-rate').textContent = typeof winRate === 'number' ? `${winRate}%` : winRate;
        document.getElementById('stat-avg-dart').textContent = avgPerDart;
        document.getElementById('stat-180s').textContent = total180s;
    }

    /**
     * Render new game form
     */
    async function renderNewGameForm() {
        const form = document.getElementById('new-game-form');
        const playerCountInput = document.getElementById('player-count');
        const gameTypeSelect = document.getElementById('game-type');
        const customPointsInput = document.getElementById('custom-points');
        const playerNamesContainer = document.getElementById('player-names-container');

        // Get all existing players for autocomplete
        let existingPlayers = [];
        try {
            const players = await Storage.getPlayers();
            existingPlayers = Object.keys(players) || [];
        } catch (error) {
            console.warn('Could not load players for autocomplete:', error);
        }

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
                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';

                const input = document.createElement('input');
                input.type = 'text';
                input.name = `player-${i}`;
                input.placeholder = `Player ${i + 1} (optional)`;
                input.className = 'player-name-input';
                input.setAttribute('autocomplete', 'off');

                // Autocomplete suggestion list
                const suggestionsList = document.createElement('div');
                suggestionsList.className = 'player-suggestions';
                suggestionsList.style.display = 'none';

                // Handle input for suggestions
                input.addEventListener('input', (e) => {
                    const value = e.target.value.toLowerCase().trim();
                    if (value.length === 0) {
                        suggestionsList.style.display = 'none';
                        return;
                    }

                    // Filter existing players matching the input
                    const matches = existingPlayers.filter(player =>
                        player.toLowerCase().includes(value)
                    );

                    if (matches.length === 0) {
                        suggestionsList.style.display = 'none';
                        return;
                    }

                    // Show suggestions
                    suggestionsList.innerHTML = matches.map(player => `
                        <div class="suggestion-item" data-player="${player}">
                            ${player}
                        </div>
                    `).join('');
                    suggestionsList.style.display = 'block';

                    // Handle suggestion clicks
                    suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
                        item.addEventListener('click', () => {
                            input.value = item.getAttribute('data-player');
                            suggestionsList.style.display = 'none';
                        });
                    });
                });

                // Hide suggestions when clicking outside
                input.addEventListener('blur', () => {
                    setTimeout(() => {
                        suggestionsList.style.display = 'none';
                    }, 200);
                });

                input.addEventListener('focus', () => {
                    if (input.value.length > 0) {
                        const event = new Event('input', { bubbles: true });
                        input.dispatchEvent(event);
                    }
                });

                wrapper.appendChild(input);
                wrapper.appendChild(suggestionsList);
                playerNamesContainer.appendChild(wrapper);
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
            const isCurrent = index === game.current_player_index;
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
        const mode = game.scoring_mode;

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

        // Add Enter key listener to all dart inputs
        container.querySelectorAll('.dart-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('submit-turn-btn').click();
                }
            });
        });

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
        document.getElementById('game-title').textContent = `${game.game_type} - Turn ${game.current_turn + 1}`;
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
                const isCurrentPlayer = playerIndex === game.current_player_index;
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
     * Pagination state
     */
    let paginationState = {
        currentPage: 1,
        gamesPerPage: 6,
        totalPages: 1,
        filteredGames: [],
        filter: '',
        sortOrder: 'newest'
    };

    /**
     * Render game history list with pagination
     */
    async function renderGameHistory(filter = '', sortOrder = 'newest', page = 1) {
        const container = document.getElementById('games-history-list');
        let games = (await Storage.getGames()).filter(g => g.completed_at);

        if (filter) {
            games = games.filter(g =>
                g.players.some(p => p.name.toLowerCase().includes(filter.toLowerCase()))
            );
        }

        if (sortOrder === 'oldest') {
            games.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        } else {
            games.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        // Update pagination state
        paginationState.filteredGames = games;
        paginationState.filter = filter;
        paginationState.sortOrder = sortOrder;
        paginationState.currentPage = page;
        paginationState.totalPages = Math.ceil(games.length / paginationState.gamesPerPage);

        // Show/hide pagination controls
        const paginationControls = document.getElementById('pagination-controls');
        if (games.length === 0) {
            container.innerHTML = '<p class="placeholder">No games found</p>';
            if (paginationControls) paginationControls.style.display = 'none';
            document.getElementById('history-games-count').textContent = 'Total: 0 games';
            return;
        }

        // Calculate pagination
        const startIdx = (page - 1) * paginationState.gamesPerPage;
        const endIdx = startIdx + paginationState.gamesPerPage;
        const paginatedGames = games.slice(startIdx, endIdx);

        // Render games for current page
        container.innerHTML = paginatedGames.map(game => {
            const winner = game.players.find(p => p.winner);
            const date = new Date(game.created_at);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="game-card" onclick="Router.navigate('game-detail', {gameId: '${game.id}'})">
                    <div class="game-card-header">
                        <div class="game-card-title">${game.game_type} Points</div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <div class="game-card-date">${dateStr} ${timeStr}</div>
                            <span class="game-status-badge" style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">COMPLETED</span>
                        </div>
                    </div>
                    <div class="game-card-players">
                        ${game.players.map(p => `
                            <div class="player-badge ${p.winner ? 'winner' : ''}">
                                ${p.name}
                            </div>
                        `).join('')}
                    </div>
                    <div class="game-card-footer">
                        <span>🏆 ${winner?.name || 'N/A'}</span>
                        <span class="game-type-badge">${game.players.length} players</span>
                    </div>
                </div>
            `;
        }).join('');

        // Update pagination controls
        updatePaginationControls();

        // Update games count
        document.getElementById('history-games-count').textContent = `Total: ${games.length} games`;
    }

    /**
     * Update pagination UI controls
     */
    function updatePaginationControls() {
        const { currentPage, totalPages, gamesPerPage, filteredGames } = paginationState;
        const paginationControls = document.getElementById('pagination-controls');
        const paginationInfo = document.getElementById('pagination-info-text');
        const paginationPrev = document.getElementById('pagination-prev');
        const paginationNext = document.getElementById('pagination-next');
        const paginationNumbers = document.getElementById('pagination-numbers');

        if (!paginationControls) return;

        // Show/hide pagination
        if (totalPages <= 1) {
            paginationControls.style.display = 'none';
            return;
        }

        paginationControls.style.display = 'flex';

        // Update info text
        const startIdx = (currentPage - 1) * gamesPerPage + 1;
        const endIdx = Math.min(currentPage * gamesPerPage, filteredGames.length);
        paginationInfo.textContent = `Showing ${startIdx}-${endIdx} of ${filteredGames.length} (Page ${currentPage} of ${totalPages})`;

        // Update prev/next buttons
        paginationPrev.disabled = currentPage === 1;
        paginationNext.disabled = currentPage === totalPages;

        // Generate page number buttons
        paginationNumbers.innerHTML = '';
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.className = `btn btn-secondary btn-small pagination-number ${i === currentPage ? 'active' : ''}`;
            btn.textContent = i;
            btn.onclick = (e) => {
                e.preventDefault();
                renderGameHistory(paginationState.filter, paginationState.sortOrder, i);
            };
            paginationNumbers.appendChild(btn);
        }
    }

    /**
     * Render game detail view
     */
    async function renderGameDetail(gameId) {
        const game = await Storage.getGame(gameId);
        if (!game) return;

        const content = document.getElementById('game-detail-content');
        const winner = game.players.find(p => p.winner);
        const date = new Date(game.created_at);

        const createdTime = new Date(game.created_at).getTime();
        const completedTime = game.completed_at ? new Date(game.completed_at).getTime() : null;
        const duration = completedTime ? Game.formatDuration(completedTime - createdTime) : 'N/A';

        let html = `
            <div class="detail-header">
                <div class="detail-header-row">
                    <div class="detail-header-item">
                        <div class="detail-label">Game Type</div>
                        <div class="detail-value">${game.game_type} Points</div>
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

        // Add final standings section
        if (game.completed_at) {
            const rankings = Game.getRankings(game);

            // Separate finished players (with medals) from all players sorted by score
            const finishedPlayers = rankings.filter(p => p.rank !== undefined && p.rank !== null && p.rank > 0);
            const allPlayersSortedByScore = [...rankings].sort((a, b) => a.score - b.score);

            // Show podium if there are finished players
            if (finishedPlayers.length > 0) {
                html += '<div class="detail-section"><h3>🏆 Final Results</h3>';
                html += '<div class="detail-podium-container">';

                // Silver (2nd)
                if (finishedPlayers[1]) {
                    const p = finishedPlayers[1];
                    html += `
                        <div class="detail-podium silver">
                            <div class="detail-podium-medal">🥈</div>
                            <div class="detail-podium-name">${p.name}</div>
                            <div class="detail-podium-label">2nd</div>
                        </div>
                    `;
                }

                // Gold (1st)
                if (finishedPlayers[0]) {
                    const p = finishedPlayers[0];
                    html += `
                        <div class="detail-podium gold">
                            <div class="detail-podium-medal">🥇</div>
                            <div class="detail-podium-name">${p.name}</div>
                            <div class="detail-podium-label">1st</div>
                        </div>
                    `;
                }

                // Bronze (3rd)
                if (finishedPlayers[2]) {
                    const p = finishedPlayers[2];
                    html += `
                        <div class="detail-podium bronze">
                            <div class="detail-podium-medal">🥉</div>
                            <div class="detail-podium-name">${p.name}</div>
                            <div class="detail-podium-label">3rd</div>
                        </div>
                    `;
                }

                html += '</div>';

                // Show remaining players if any
                if (finishedPlayers.length > 3) {
                    html += '<div class="detail-remaining-players">';
                    for (let i = 3; i < finishedPlayers.length; i++) {
                        const p = finishedPlayers[i];
                        html += `
                            <div class="detail-result-item">
                                <span class="detail-result-rank">${p.rank}${p.rank % 10 === 1 && p.rank % 100 !== 11 ? 'st' : p.rank % 10 === 2 && p.rank % 100 !== 12 ? 'nd' : p.rank % 10 === 3 && p.rank % 100 !== 13 ? 'rd' : 'th'}</span>
                                <span class="detail-result-name">${p.name}</span>
                                <span class="detail-result-darts">Darts: ${p.darts}</span>
                            </div>
                        `;
                    }
                    html += '</div>';
                }

                html += '</div>';
            }

            // Always show all players standings sorted by final score
            html += '<div class="detail-section"><h3>📊 Final Standings</h3>';
            html += '<div class="detail-standings-table">';
            allPlayersSortedByScore.forEach((p, index) => {
                const position = index + 1;
                let positionLabel = position + (position % 10 === 1 && position % 100 !== 11 ? 'st' : position % 10 === 2 && position % 100 !== 12 ? 'nd' : position % 10 === 3 && position % 100 !== 13 ? 'rd' : 'th');

                html += `
                    <div class="detail-standings-row">
                        <span class="detail-standings-position">${positionLabel}</span>
                        <span class="detail-standings-name">${p.name}</span>
                        <span class="detail-standings-stats">
                            <span>Score: ${p.score}</span>
                            <span>Darts: ${p.darts}</span>
                            <span>Avg: ${p.avgPerDart}</span>
                        </span>
                    </div>
                `;
            });
            html += '</div>';
            html += '</div>';
        }

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
    async function renderLeaderboard(metric = 'wins', timeFilter = 'all-time') {
        const container = document.getElementById('leaderboard-content');
        const rankings = await Stats.getLeaderboard(metric, timeFilter);

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
    async function renderPlayerProfile(playerName) {
        const stats = await Stats.calculatePlayerStats(playerName);
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
    function updateActiveGameUI(game, animate = false) {
        renderScoreboard(game);
        renderCurrentPlayer(game);
        renderDartInputs(game);
        renderTurnHistory(game);

        // Update live rankings with current game standings
        const rankings = Game.getRankings(game);
        updateWinnersBoard(rankings, animate);
    }

    /**
     * Render game in spectator mode (read-only view)
     */
    function renderSpectatorGame(game) {
        renderScoreboard(game);
        renderCurrentPlayer(game);
        renderTurnHistory(game);

        // Hide dart input controls for spectator
        const dartEntrySection = document.querySelector('.dart-entry-section');
        if (dartEntrySection) {
            dartEntrySection.style.display = 'none';
        }

        // Show spectator indicator
        const pageHeader = document.querySelector('.page-header');
        if (pageHeader) {
            const spectatorIndicator = document.createElement('div');
            spectatorIndicator.style.cssText = 'color: #7d5f92; font-weight: 600; font-size: 14px; padding: 8px 16px; background: rgba(125, 95, 146, 0.1); border-radius: 6px; display: inline-block; margin-left: 16px;';
            spectatorIndicator.textContent = '📺 Spectator Mode (Read-Only)';
            pageHeader.appendChild(spectatorIndicator);
        }

        // Update live rankings with current game standings
        const rankings = Game.getRankings(game);
        updateWinnersBoard(rankings, false);

        // Show spectator-specific leaderboard with player stats from current game
        renderSpectatorLeaderboard(game);
    }

    /**
     * Render leaderboard for spectator view showing players in current game
     */
    async function renderSpectatorLeaderboard(game) {
        try {
            // Find or create a container for spectator leaderboard
            let leaderboardContainer = document.getElementById('spectator-leaderboard-container');

            if (!leaderboardContainer) {
                // Create container after turn history
                const turnHistorySection = document.querySelector('.turn-history-section');
                if (turnHistorySection) {
                    leaderboardContainer = document.createElement('div');
                    leaderboardContainer.id = 'spectator-leaderboard-container';
                    leaderboardContainer.className = 'spectator-leaderboard';
                    leaderboardContainer.style.cssText = 'background: var(--color-bg-lighter); border-radius: var(--radius-lg); padding: var(--spacing-xl); box-shadow: var(--shadow-md); margin-top: var(--spacing-xl);';
                    turnHistorySection.parentNode.insertBefore(leaderboardContainer, turnHistorySection.nextSibling);
                }
            }

            if (!leaderboardContainer) return;

            // Build leaderboard for players in this game
            let html = '<h3 style="margin-top: 0; color: var(--color-primary-dark); text-align: center;">👥 Player Leaderboard</h3>';
            html += '<div style="display: flex; flex-direction: column; gap: 8px;">';

            // Sort players by current score (lowest remaining is best)
            const sortedPlayers = [...game.players].sort((a, b) => {
                // Finished players first (by rank)
                if (a.winner && b.winner) {
                    return (a.finish_rank || 999) - (b.finish_rank || 999);
                }
                if (a.winner) return -1;
                if (b.winner) return 1;
                // Then by current score (lowest first)
                return a.currentScore - b.currentScore;
            });

            sortedPlayers.forEach((player, index) => {
                const stats = player.stats;
                let statusIcon = '';
                let statusText = '';

                if (player.winner) {
                    const medals = ['🥇', '🥈', '🥉'];
                    statusIcon = medals[player.finish_rank - 1] || '🏅';
                    statusText = `Finished - ${player.finish_rank}${player.finish_rank % 10 === 1 && player.finish_rank % 100 !== 11 ? 'st' : player.finish_rank % 10 === 2 && player.finish_rank % 100 !== 12 ? 'nd' : player.finish_rank % 10 === 3 && player.finish_rank % 100 !== 13 ? 'rd' : 'th'}`;
                } else {
                    statusIcon = '▶️';
                    statusText = `Playing - ${player.currentScore} remaining`;
                }

                html += `
                    <div style="display: grid; grid-template-columns: 50px 1fr 150px; gap: 12px; align-items: center; padding: 12px; background: var(--color-bg-light); border-radius: 6px; border-left: 4px solid var(--color-primary);">
                        <div style="text-align: center; font-size: 20px;">${statusIcon}</div>
                        <div>
                            <div style="font-weight: 600; color: var(--color-text-dark); margin-bottom: 4px;">${player.name}</div>
                            <div style="font-size: 12px; color: var(--color-text-light);">${statusText}</div>
                        </div>
                        <div style="text-align: right; font-size: 12px; color: var(--color-text-light);">
                            <div style="font-weight: 600; color: var(--color-primary);">${player.turns.length} turns</div>
                            <div>${stats.totalDarts} darts • Avg: ${stats.totalDarts > 0 ? stats.avgPerDart.toFixed(1) : '—'}</div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            leaderboardContainer.innerHTML = html;
        } catch (error) {
            console.error('Error rendering spectator leaderboard:', error);
        }
    }

    // Store previous rankings for animation tracking
    let previousRankings = {};
    let previousPositions = {}; // Track position changes

    /**
     * Update live rankings board with Olympic medal podium style
     * Shows finished players in medal podium, then active players below
     * @param {Array} rankings - Player rankings
     * @param {Boolean} animate - Whether to animate rank changes (only on round completion)
     */
    function updateWinnersBoard(rankings, animate = false) {
        const board = document.getElementById('live-rankings');
        const rankList = document.getElementById('rankings-list');
        const rankEmojis = ['🥇', '🥈', '🥉'];
        const rankLabels = ['1st', '2nd', '3rd'];

        if (!rankings || rankings.length === 0) {
            board.classList.add('hidden');
            return;
        }

        // Separate finished and active players
        const finishedPlayers = rankings.filter(p => p.rank !== undefined && p.rank !== null && p.rank > 0)
            .sort((a, b) => a.rank - b.rank);
        const activePlayers = rankings.filter(p => !(p.rank !== undefined && p.rank !== null && p.rank > 0))
            .sort((a, b) => a.score - b.score);

        let html = '';

        // Show podium for finished players (top 3)
        if (finishedPlayers.length > 0) {
            html += '<div class="podium-container">';

            // Silver (2nd place)
            if (finishedPlayers[1]) {
                const player = finishedPlayers[1];
                html += `
                    <div class="podium-position silver" data-player="${player.name}">
                        <div class="podium-medal">🥈</div>
                        <div class="podium-name">${player.name}</div>
                        <div class="podium-rank">2nd</div>
                        <div class="podium-height"></div>
                    </div>
                `;
            }

            // Gold (1st place)
            if (finishedPlayers[0]) {
                const player = finishedPlayers[0];
                html += `
                    <div class="podium-position gold" data-player="${player.name}">
                        <div class="podium-medal">🥇</div>
                        <div class="podium-name">${player.name}</div>
                        <div class="podium-rank">1st</div>
                        <div class="podium-height gold-height"></div>
                    </div>
                `;
            }

            // Bronze (3rd place)
            if (finishedPlayers[2]) {
                const player = finishedPlayers[2];
                html += `
                    <div class="podium-position bronze" data-player="${player.name}">
                        <div class="podium-medal">🥉</div>
                        <div class="podium-name">${player.name}</div>
                        <div class="podium-rank">3rd</div>
                        <div class="podium-height"></div>
                    </div>
                `;
            }

            html += '</div>';

            // Additional finished players (4th+)
            if (finishedPlayers.length > 3) {
                html += '<div class="other-finished-header">Other Finalists</div>';
                for (let i = 3; i < finishedPlayers.length; i++) {
                    const player = finishedPlayers[i];
                    const suffix = i === 3 ? 'th' : i === 4 ? 'th' : 'th';
                    html += `
                        <div class="ranking-item finished" data-player="${player.name}">
                            <div class="ranking-medal">🏅</div>
                            <div class="ranking-info">
                                <div class="ranking-name">${player.name}</div>
                                <div class="ranking-detail">✓ ${player.rank}${suffix}</div>
                            </div>
                            <div class="ranking-score">
                                <div>0</div>
                                <div class="ranking-darts">Darts: ${player.darts}</div>
                            </div>
                        </div>
                    `;
                }
            }
        }

        // Show active players if any
        if (activePlayers.length > 0) {
            if (finishedPlayers.length > 0) {
                html += '<div class="active-header">In Progress</div>';
            }

            activePlayers.forEach((player, index) => {
                let scoreChangeIndicator = '';
                let positionChangeIndicator = '';
                let animationClass = '';

                // Calculate position
                const position = finishedPlayers.length + index + 1;
                let suffix = 'th';
                if (position % 10 === 1 && position % 100 !== 11) suffix = 'st';
                else if (position % 10 === 2 && position % 100 !== 12) suffix = 'nd';
                else if (position % 10 === 3 && position % 100 !== 13) suffix = 'rd';
                const positionLabel = position + suffix;

                // Only show changes if animating (round completed)
                if (animate) {
                    // Score changes
                    const prevScore = previousRankings[player.name];
                    if (prevScore !== undefined && prevScore !== player.score) {
                        if (prevScore > player.score) {
                            scoreChangeIndicator = ' ↓ ' + (prevScore - player.score);
                            animationClass = 'score-down';
                        } else {
                            scoreChangeIndicator = ' ↑ ' + (player.score - prevScore);
                            animationClass = 'score-up';
                        }
                    }

                    // Position changes
                    const prevPosition = previousPositions[player.name];
                    if (prevPosition !== undefined && prevPosition !== position) {
                        if (prevPosition > position) {
                            positionChangeIndicator = ' 📈'; // Moved up
                            animationClass += ' position-up';
                        } else if (prevPosition < position) {
                            positionChangeIndicator = ' 📉'; // Moved down
                            animationClass += ' position-down';
                        }
                    } else if (prevPosition !== undefined && prevPosition === position) {
                        positionChangeIndicator = ' ➡️'; // Stayed same
                    }
                }

                html += `
                    <div class="ranking-item active ${animationClass}" data-player="${player.name}">
                        <div class="ranking-medal">${positionLabel}</div>
                        <div class="ranking-info">
                            <div class="ranking-name">${player.name}</div>
                            <div class="ranking-detail">In Progress${scoreChangeIndicator}${positionChangeIndicator}</div>
                        </div>
                        <div class="ranking-score">
                            <div>${player.score}</div>
                            <div class="ranking-darts">Darts: ${player.darts}</div>
                        </div>
                    </div>
                `;

                // Only update previous rankings if animating
                if (animate) {
                    previousRankings[player.name] = player.score;
                    previousPositions[player.name] = position;
                }
            });
        }

        rankList.innerHTML = html;
        board.classList.remove('hidden');

        // Trigger animation only if animate is true
        if (animate) {
            setTimeout(() => {
                document.querySelectorAll('.ranking-item.score-up, .ranking-item.score-down').forEach(item => {
                    item.classList.remove('score-up', 'score-down');
                });
            }, 300);
        }
    }

    // Public API
    return {
        showToast,
        showLoader,
        hideLoader,
        showModal,
        hideModal,
        showPage,
        renderRecentGames,
        renderStatsWidget,
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
        updateActiveGameUI,
        renderSpectatorGame,
        updateWinnersBoard,
        getPaginationState: () => paginationState
    };
})();
