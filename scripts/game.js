/**
 * Game Module
 * Handles core game logic and scoring
 */

const Game = (() => {
    /**
     * Create a new game
     */
    function createGame(options) {
        const {
            playerCount,
            playerNames = [],
            gameType = 501,
            winBelow = false,
            scoringMode = 'per-dart'
        } = options;

        const game = {
            id: Storage.generateUUID(),
            created_at: new Date().toISOString(),
            completed_at: null,
            game_type: parseInt(gameType),
            win_condition: winBelow ? 'below' : 'exact',
            scoring_mode: scoringMode,
            current_player_index: 0,
            current_turn: 0,
            is_active: true,
            device_id: Device.getDeviceId(),
            players: []
        };

        // Initialize players
        for (let i = 0; i < playerCount; i++) {
            const playerName = playerNames[i]?.trim() || `Player ${i + 1}`;
            Storage.getOrCreatePlayer(playerName);

            game.players.push({
                id: Storage.generateUUID(),
                name: playerName,
                startingScore: game.game_type,
                currentScore: game.game_type,
                turns: [],
                winner: false,
                stats: {
                    totalDarts: 0,
                    totalScore: 0,
                    avgPerDart: 0,
                    maxTurn: 0,
                    maxDart: 0,
                    checkoutAttempts: 0,
                    checkoutSuccess: 0
                }
            });
        }

        // Randomize player order (Fisher-Yates shuffle)
        for (let i = game.players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [game.players[i], game.players[j]] = [game.players[j], game.players[i]];
        }

        return game;
    }

    /**
     * Validate dart score
     */
    function validateDart(score) {
        const s = parseInt(score);
        if (isNaN(s) || s < 0 || s > 180) {
            return { valid: false, error: 'Dart must be between 0 and 180' };
        }
        return { valid: true, score: s };
    }

    /**
     * Validate dart turn (3 darts max per turn)
     */
    function validateTurn(darts) {
        if (!Array.isArray(darts) || darts.length === 0 || darts.length > 3) {
            return { valid: false, error: 'A turn must have 1-3 darts' };
        }

        let totalScore = 0;
        for (const dart of darts) {
            const validation = validateDart(dart);
            if (!validation.valid) return validation;
            totalScore += validation.score;
        }

        if (totalScore > 180) {
            return { valid: false, error: 'Turn total cannot exceed 180' };
        }

        return { valid: true, darts: darts.map(d => parseInt(d)), total: totalScore };
    }

    /**
     * Submit a turn for the current player
     */
    function submitTurn(game, dartsInput) {
        if (!game.is_active) {
            return { success: false, error: 'Game is not active' };
        }

        const validation = validateTurn(dartsInput);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        const currentPlayer = game.players[game.current_player_index];
        const darts = validation.darts;
        const totalScore = validation.total;

        // Check for checkout attempt
        if (currentPlayer.currentScore - totalScore === 0 ||
            (currentPlayer.currentScore - totalScore < 0 && game.win_condition === 'below')) {
            currentPlayer.stats.checkoutAttempts++;
        }

        // Check for bust
        const newScore = currentPlayer.currentScore - totalScore;
        let busted = false;

        if (newScore < 0) {
            if (game.win_condition === 'exact') {
                // Bust - score reverts to start of turn
                busted = true;
            } else if (game.win_condition === 'below') {
                // Below zero wins
                currentPlayer.currentScore = 0;
            }
        } else if (newScore === 0) {
            // Exact match - player wins
            currentPlayer.currentScore = 0;
            currentPlayer.winner = true;
            currentPlayer.stats.checkoutSuccess++;
        } else {
            // Valid turn
            currentPlayer.currentScore = newScore;
        }

        // Record turn
        const turn = {
            darts: darts,
            remaining: busted ? currentPlayer.currentScore : newScore,
            busted: busted,
            timestamp: Date.now()
        };

        if (!busted || game.win_condition === 'below') {
            currentPlayer.turns.push(turn);

            // Update player stats
            currentPlayer.stats.totalDarts += darts.length;
            currentPlayer.stats.totalScore += totalScore;
            currentPlayer.stats.maxTurn = Math.max(currentPlayer.stats.maxTurn, totalScore);
            currentPlayer.stats.maxDart = Math.max(currentPlayer.stats.maxDart, Math.max(...darts));
            // Calculate average per 3 darts (per turn) instead of per individual dart
            currentPlayer.stats.avgPerDart =
                (currentPlayer.stats.totalScore / currentPlayer.stats.totalDarts) * 3;
        } else {
            currentPlayer.turns.push(turn);
        }

        // Check for player finish (0 score)
        if (currentPlayer.currentScore === 0) {
            // Mark player as finished (but don't rank yet - wait for round end)
            currentPlayer.winner = true;
            // Track which round they finished (round = complete cycle through all players)
            // This ensures players finishing in the same round get the same rank
            currentPlayer.finish_round = Math.floor(game.current_turn / game.players.length);

            // Find next active player (not finished)
            let nextActiveIndex = -1;
            let activePlayers = 0;

            for (let i = 0; i < game.players.length; i++) {
                if (!game.players[i].winner) {
                    activePlayers++;
                }
            }

            // Count active players after current finish
            let activePlayersRemaining = activePlayers - 1;

            // Move to next active player (skip all finished players)
            let searchIndex = (game.current_player_index + 1) % game.players.length;
            let searchAttempts = 0;
            while (searchAttempts < game.players.length) {
                if (!game.players[searchIndex].winner) {
                    nextActiveIndex = searchIndex;
                    break;
                }
                searchIndex = (searchIndex + 1) % game.players.length;
                searchAttempts++;
            }

            game.current_turn++;

            // If only 1 player left, they get last place - update all rankings
            if (activePlayersRemaining === 0) {
                // All other players have finished
                assignRankingsByFinishTurn(game);

                // DEBUG: Log player finish ranks before final ranking
                console.log('Before getRankings - player finish_ranks:');
                game.players.forEach((p, idx) => {
                    console.log(`  Player ${idx} (${p.name}): finish_round=${p.finish_round}, finish_rank=${p.finish_rank}`);
                });

                endGame(game);
                const finalRankings = getRankings(game);

                console.log('Final rankings returned:', finalRankings);
                console.log('Final rankings length:', finalRankings ? finalRankings.length : 'undefined');

                return {
                    success: true,
                    gameEnded: true,
                    playerFinished: currentPlayer.name,
                    finishRank: currentPlayer.finish_rank,
                    finalRankings: finalRankings
                };
            }

            // Move to next active player
            if (nextActiveIndex !== -1) {
                game.current_player_index = nextActiveIndex;
            }

            // Calculate rank for this player based on finish round
            const finishRank = calculateCurrentRank(game, currentPlayer.finish_round);

            return {
                success: true,
                gameEnded: false,
                playerFinished: currentPlayer.name,
                finishRank: finishRank,
                finishRound: currentPlayer.finish_round,
                nextPlayer: game.players[game.current_player_index].name,
                allRankings: getRankings(game)
            };
        }

        // Move to next active player (skip finished ones)
        let nextPlayerIndex = (game.current_player_index + 1) % game.players.length;
        let searchAttempts = 0;
        while (searchAttempts < game.players.length) {
            if (!game.players[nextPlayerIndex].winner) {
                game.current_player_index = nextPlayerIndex;
                break;
            }
            nextPlayerIndex = (nextPlayerIndex + 1) % game.players.length;
            searchAttempts++;
        }

        game.current_turn++;

        return { success: true, gameEnded: false, nextPlayer: game.players[game.current_player_index].name };
    }

    /**
     * Undo last dart
     */
    function undoLastDart(game) {
        const currentPlayer = game.players[game.current_player_index];
        if (currentPlayer.turns.length === 0) {
            return { success: false, error: 'No turns to undo' };
        }

        const lastTurn = currentPlayer.turns[currentPlayer.turns.length - 1];
        currentPlayer.turns.pop();

        // Recalculate score
        currentPlayer.currentScore = currentPlayer.startingScore;
        currentPlayer.stats.totalDarts = 0;
        currentPlayer.stats.totalScore = 0;
        currentPlayer.stats.maxTurn = 0;
        currentPlayer.stats.maxDart = 0;

        currentPlayer.turns.forEach(turn => {
            if (!turn.busted) {
                currentPlayer.currentScore = turn.remaining;
                const turnTotal = turn.darts.reduce((a, b) => a + b, 0);
                currentPlayer.stats.totalDarts += turn.darts.length;
                currentPlayer.stats.totalScore += turnTotal;
                currentPlayer.stats.maxTurn = Math.max(currentPlayer.stats.maxTurn, turnTotal);
                currentPlayer.stats.maxDart = Math.max(currentPlayer.stats.maxDart, Math.max(...turn.darts));
            }
        });

        if (currentPlayer.stats.totalDarts > 0) {
            // Calculate average per 3 darts (per turn)
            currentPlayer.stats.avgPerDart = (currentPlayer.stats.totalScore / currentPlayer.stats.totalDarts) * 3;
        }

        return { success: true, player: currentPlayer.name, score: currentPlayer.currentScore };
    }

    /**
     * End the current game
     */
    function endGame(game) {
        game.is_active = false;
        game.completed_at = new Date().toISOString();

        // Ensure winner is marked
        const winner = game.players.find(p => p.winner);
        if (!winner) {
            // If no winner (game abandoned), mark player with lowest score as winner
            const sortedPlayers = [...game.players].sort((a, b) => a.currentScore - b.currentScore);
            if (sortedPlayers[0]) {
                sortedPlayers[0].winner = true;
            }
        }

        return game;
    }

    /**
     * Abandon a game without completing it
     */
    function abandonGame(game) {
        game.is_active = false;
        game.completed_at = new Date().toISOString();
        // Don't mark any winner when abandoned
        return game;
    }

    /**
     * Get current player
     */
    function getCurrentPlayer(game) {
        return game.players[game.current_player_index];
    }

    /**
     * Get game summary
     */
    function getGameSummary(game) {
        const createdTime = new Date(game.created_at).getTime();
        const completedTime = game.completed_at ? new Date(game.completed_at).getTime() : null;

        return {
            id: game.id,
            created_at: game.created_at,
            completed_at: game.completed_at,
            game_type: game.game_type,
            scoring_mode: game.scoring_mode,
            players: game.players.map(p => ({
                name: p.name,
                winner: p.winner,
                score: p.currentScore,
                darts: p.stats.totalDarts,
                avgPerDart: p.stats.totalDarts > 0 ? ((p.stats.totalScore / p.stats.totalDarts) * 3).toFixed(2) : '0',
                turns: p.turns.length
            })),
            duration: completedTime ? ((completedTime - createdTime) / 1000 / 60).toFixed(1) : null
        };
    }

    /**
     * Get turn history for a player
     */
    function getPlayerTurnHistory(game, playerIndex) {
        const player = game.players[playerIndex];
        return player.turns.map((turn, index) => ({
            turnNumber: index + 1,
            darts: turn.darts,
            total: turn.darts.reduce((a, b) => a + b, 0),
            remaining: turn.remaining,
            busted: turn.busted
        }));
    }

    /**
     * Format time for display
     */
    function formatDuration(ms) {
        const minutes = Math.floor((ms / 1000) / 60);
        const seconds = Math.floor((ms / 1000) % 60);
        if (minutes === 0) {
            return `${seconds}s`;
        }
        return `${minutes}m ${seconds}s`;
    }

    /**
     * Get common dart scores for quick entry
     */
    function getQuickDarts() {
        return [0, 20, 25, 30, 40, 50, 60, 80, 100, 120, 140, 160, 180];
    }

    /**
     * Get the next finish rank (counting finished players)
     */
    /**
     * Assign rankings based on finish round
     * Players finishing in same round get same rank
     * Last player (who didn't finish) gets last rank
     */
    function assignRankingsByFinishTurn(game) {
        // Get all finished players with their finish rounds
        const finishedPlayers = game.players
            .filter(p => p.finish_round !== undefined)
            .map(p => ({
                player: p,
                finishRound: p.finish_round
            }));

        // Sort by finish round (ascending)
        finishedPlayers.sort((a, b) => a.finishRound - b.finishRound);

        // Assign ranks
        let currentRank = 1;
        let lastFinishRound = -1;
        let playersAtCurrentRank = 0;

        for (const { player, finishRound } of finishedPlayers) {
            if (finishRound !== lastFinishRound) {
                // New finish round, move to next rank(s)
                currentRank += playersAtCurrentRank;
                playersAtCurrentRank = 0;
                lastFinishRound = finishRound;
            }
            player.finish_rank = currentRank;
            playersAtCurrentRank++;
        }

        // Assign rank to any unfinished players (they get the last rank)
        const unfinishedPlayers = game.players.filter(p => p.finish_round === undefined);
        if (unfinishedPlayers.length > 0) {
            const lastRank = game.players.length - unfinishedPlayers.length + 1;
            unfinishedPlayers.forEach(p => {
                p.finish_rank = lastRank;
            });
        }
    }

    function getNextFinishRank(game) {
        const finishedCount = game.players.filter(p => p.finish_rank !== undefined).length;
        return finishedCount + 1;
    }

    /**
     * Calculate the current rank of a player based on their finish_round
     */
    function calculateCurrentRank(game, playerFinishRound) {
        const finishedPlayers = game.players
            .filter(p => p.finish_round !== undefined && p.finish_round < playerFinishRound)
            .map(p => p.finish_round);

        // Get unique finish rounds that came before this player
        const uniqueEarlierRounds = [...new Set(finishedPlayers)].sort((a, b) => a - b);

        // Rank is 1 + number of unique earlier finish rounds
        return uniqueEarlierRounds.length + 1;
    }

    /**
     * Get final rankings sorted by finish order
     */
    function getRankings(game) {
        return game.players
            .map(p => ({
                name: p.name,
                rank: p.finish_rank,
                score: p.currentScore,
                darts: p.stats.totalDarts,
                // Calculate average per 3 darts (per turn)
                avgPerDart: p.stats.totalDarts > 0 ? ((p.stats.totalScore / p.stats.totalDarts) * 3).toFixed(2) : 0
            }))
            .sort((a, b) => (a.rank || 999) - (b.rank || 999));
    }

    // Public API
    return {
        createGame,
        validateDart,
        validateTurn,
        submitTurn,
        undoLastDart,
        endGame,
        abandonGame,
        getCurrentPlayer,
        getGameSummary,
        getPlayerTurnHistory,
        formatDuration,
        getQuickDarts,
        getRankings,
        assignRankingsByFinishTurn
    };
})();
