/**
 * Storage Module
 * Handles LocalStorage management for games and players
 */

const Storage = (() => {
    const GAMES_KEY = 'dartbee_games';
    const PLAYERS_KEY = 'dartbee_players';
    const VERSION_KEY = 'dartbee_version';
    const CURRENT_VERSION = '1.0.0';

    /**
     * Initialize storage, create if doesn't exist
     */
    function init() {
        if (!localStorage.getItem(VERSION_KEY)) {
            localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
            localStorage.setItem(GAMES_KEY, JSON.stringify([]));
            localStorage.setItem(PLAYERS_KEY, JSON.stringify({}));
        }
        validateData();
    }

    /**
     * Validate stored data integrity
     */
    function validateData() {
        try {
            const games = getGames();
            const players = getPlayers();
            if (!Array.isArray(games) || typeof players !== 'object') {
                resetStorage();
            }
        } catch (error) {
            console.error('Storage validation error:', error);
            resetStorage();
        }
    }

    /**
     * Reset storage to defaults
     */
    function resetStorage() {
        localStorage.setItem(GAMES_KEY, JSON.stringify([]));
        localStorage.setItem(PLAYERS_KEY, JSON.stringify({}));
    }

    /**
     * Get all games
     */
    function getGames() {
        try {
            const games = localStorage.getItem(GAMES_KEY);
            return games ? JSON.parse(games) : [];
        } catch (error) {
            console.error('Error retrieving games:', error);
            return [];
        }
    }

    /**
     * Save a new game
     */
    function saveGame(game) {
        try {
            const games = getGames();
            games.push(game);
            localStorage.setItem(GAMES_KEY, JSON.stringify(games));
            updatePlayersFromGame(game);
            return game;
        } catch (error) {
            console.error('Error saving game:', error);
            return null;
        }
    }

    /**
     * Update an existing game
     */
    function updateGame(gameId, updates) {
        try {
            const games = getGames();
            const index = games.findIndex(g => g.id === gameId);
            if (index !== -1) {
                games[index] = { ...games[index], ...updates };
                localStorage.setItem(GAMES_KEY, JSON.stringify(games));
                return games[index];
            }
            return null;
        } catch (error) {
            console.error('Error updating game:', error);
            return null;
        }
    }

    /**
     * Get a single game by ID
     */
    function getGame(gameId) {
        const games = getGames();
        return games.find(g => g.id === gameId) || null;
    }

    /**
     * Delete a game
     */
    function deleteGame(gameId) {
        try {
            const games = getGames();
            const filtered = games.filter(g => g.id !== gameId);
            localStorage.setItem(GAMES_KEY, JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Error deleting game:', error);
            return false;
        }
    }

    /**
     * Get all players
     */
    function getPlayers() {
        try {
            const players = localStorage.getItem(PLAYERS_KEY);
            return players ? JSON.parse(players) : {};
        } catch (error) {
            console.error('Error retrieving players:', error);
            return {};
        }
    }

    /**
     * Get or create player profile
     */
    function getOrCreatePlayer(playerName) {
        const players = getPlayers();
        if (!players[playerName]) {
            players[playerName] = {
                id: generateUUID(),
                name: playerName,
                createdAt: Date.now(),
                aggregateStats: {
                    gamesPlayed: 0,
                    gamesWon: 0,
                    totalDarts: 0,
                    total180s: 0,
                    total140plus: 0,
                    totalCheckoutAttempts: 0,
                    totalCheckoutSuccess: 0,
                    bestCheckout: 0,
                    maxDart: 0,
                    totalScore: 0
                }
            };
            localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
        }
        return players[playerName];
    }

    /**
     * Update player aggregate stats from a completed game
     */
    function updatePlayersFromGame(game) {
        const players = getPlayers();

        game.players.forEach(player => {
            const playerName = player.name;
            let playerProfile = players[playerName] || {
                id: generateUUID(),
                name: playerName,
                createdAt: Date.now(),
                aggregateStats: {
                    gamesPlayed: 0,
                    gamesWon: 0,
                    totalDarts: 0,
                    total180s: 0,
                    total140plus: 0,
                    totalCheckoutAttempts: 0,
                    totalCheckoutSuccess: 0,
                    bestCheckout: 0,
                    maxDart: 0,
                    totalScore: 0
                }
            };

            // Update game stats
            playerProfile.aggregateStats.gamesPlayed++;
            if (player.winner) {
                playerProfile.aggregateStats.gamesWon++;
            }

            // Update dart stats
            playerProfile.aggregateStats.totalScore += player.stats.totalScore;
            playerProfile.aggregateStats.totalDarts += player.stats.totalDarts;
            playerProfile.aggregateStats.totalCheckoutAttempts += player.stats.checkoutAttempts;
            playerProfile.aggregateStats.totalCheckoutSuccess += player.stats.checkoutSuccess;

            // Count 180s and 140+
            player.turns.forEach(turn => {
                const turnTotal = turn.darts.reduce((a, b) => a + b, 0);
                if (turnTotal === 180) {
                    playerProfile.aggregateStats.total180s++;
                }
                if (turnTotal >= 140 && turnTotal < 180) {
                    playerProfile.aggregateStats.total140plus++;
                }
                turn.darts.forEach(dart => {
                    if (dart > playerProfile.aggregateStats.maxDart) {
                        playerProfile.aggregateStats.maxDart = dart;
                    }
                });
            });

            // Update best checkout
            if (player.stats.checkoutSuccess > 0) {
                playerProfile.aggregateStats.bestCheckout = Math.max(
                    playerProfile.aggregateStats.bestCheckout,
                    player.stats.checkoutSuccess
                );
            }

            players[playerName] = playerProfile;
        });

        localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
    }

    /**
     * Get all games for a specific player
     */
    function getPlayerGames(playerName) {
        const games = getGames();
        return games.filter(game =>
            game.players.some(p => p.name === playerName)
        );
    }

    /**
     * Export all data as JSON
     */
    function exportData() {
        return {
            version: localStorage.getItem(VERSION_KEY),
            exportDate: new Date().toISOString(),
            games: getGames(),
            players: getPlayers()
        };
    }

    /**
     * Import data from JSON
     */
    function importData(data) {
        try {
            if (!data.games || !data.players) {
                throw new Error('Invalid data format');
            }
            localStorage.setItem(GAMES_KEY, JSON.stringify(data.games));
            localStorage.setItem(PLAYERS_KEY, JSON.stringify(data.players));
            validateData();
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    /**
     * Clear all data
     */
    function clearAll() {
        if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
            resetStorage();
            return true;
        }
        return false;
    }

    /**
     * Generate UUID
     */
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Get storage size info
     */
    function getStorageInfo() {
        const games = localStorage.getItem(GAMES_KEY);
        const players = localStorage.getItem(PLAYERS_KEY);
        const gamesSize = games ? games.length : 0;
        const playersSize = players ? players.length : 0;
        return {
            totalGames: getGames().length,
            totalPlayers: Object.keys(getPlayers()).length,
            approximateSize: (gamesSize + playersSize) / 1024, // KB
            storageQuota: 5120 // 5MB typical for localStorage
        };
    }

    // Public API
    return {
        init,
        getGames,
        saveGame,
        updateGame,
        getGame,
        deleteGame,
        getPlayers,
        getOrCreatePlayer,
        getPlayerGames,
        updatePlayersFromGame,
        exportData,
        importData,
        clearAll,
        getStorageInfo,
        validateData,
        generateUUID
    };
})();

// Initialize storage on load
Storage.init();
