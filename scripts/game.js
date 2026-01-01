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
            createdAt: Date.now(),
            completedAt: null,
            gameType: parseInt(gameType),
            winCondition: winBelow ? 'below' : 'exact',
            scoringMode: scoringMode,
            currentPlayerIndex: 0,
            currentTurn: 0,
            isActive: true,
            players: []
        };

        // Initialize players
        for (let i = 0; i < playerCount; i++) {
            const playerName = playerNames[i]?.trim() || `Player ${i + 1}`;
            Storage.getOrCreatePlayer(playerName);

            game.players.push({
                id: Storage.generateUUID(),
                name: playerName,
                startingScore: game.gameType,
                currentScore: game.gameType,
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
        if (!game.isActive) {
            return { success: false, error: 'Game is not active' };
        }

        const validation = validateTurn(dartsInput);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        const currentPlayer = game.players[game.currentPlayerIndex];
        const darts = validation.darts;
        const totalScore = validation.total;

        // Check for checkout attempt
        if (currentPlayer.currentScore - totalScore === 0 ||
            (currentPlayer.currentScore - totalScore < 0 && game.winCondition === 'below')) {
            currentPlayer.stats.checkoutAttempts++;
        }

        // Check for bust
        const newScore = currentPlayer.currentScore - totalScore;
        let busted = false;

        if (newScore < 0) {
            if (game.winCondition === 'exact') {
                // Bust - score reverts to start of turn
                busted = true;
            } else if (game.winCondition === 'below') {
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

        if (!busted || game.winCondition === 'below') {
            currentPlayer.turns.push(turn);

            // Update player stats
            currentPlayer.stats.totalDarts += darts.length;
            currentPlayer.stats.totalScore += totalScore;
            currentPlayer.stats.maxTurn = Math.max(currentPlayer.stats.maxTurn, totalScore);
            currentPlayer.stats.maxDart = Math.max(currentPlayer.stats.maxDart, Math.max(...darts));
            currentPlayer.stats.avgPerDart =
                currentPlayer.stats.totalScore / currentPlayer.stats.totalDarts;
        } else {
            currentPlayer.turns.push(turn);
        }

        // Check for win
        if (currentPlayer.currentScore === 0) {
            endGame(game);
            return { success: true, gameEnded: true, winner: currentPlayer.name };
        }

        // Move to next player
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        game.currentTurn++;

        return { success: true, gameEnded: false, nextPlayer: game.players[game.currentPlayerIndex].name };
    }

    /**
     * Undo last dart
     */
    function undoLastDart(game) {
        const currentPlayer = game.players[game.currentPlayerIndex];
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
            currentPlayer.stats.avgPerDart = currentPlayer.stats.totalScore / currentPlayer.stats.totalDarts;
        }

        return { success: true, player: currentPlayer.name, score: currentPlayer.currentScore };
    }

    /**
     * End the current game
     */
    function endGame(game) {
        game.isActive = false;
        game.completedAt = Date.now();

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
        game.isActive = false;
        game.completedAt = Date.now();
        // Don't mark any winner when abandoned
        return game;
    }

    /**
     * Get current player
     */
    function getCurrentPlayer(game) {
        return game.players[game.currentPlayerIndex];
    }

    /**
     * Get game summary
     */
    function getGameSummary(game) {
        return {
            id: game.id,
            createdAt: game.createdAt,
            completedAt: game.completedAt,
            gameType: game.gameType,
            scoringMode: game.scoringMode,
            players: game.players.map(p => ({
                name: p.name,
                winner: p.winner,
                score: p.currentScore,
                darts: p.stats.totalDarts,
                avgPerDart: p.stats.avgPerDart.toFixed(2),
                turns: p.turns.length
            })),
            duration: game.completedAt ? ((game.completedAt - game.createdAt) / 1000 / 60).toFixed(1) : null
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
        getQuickDarts
    };
})();
