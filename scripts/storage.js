/**
 * Storage Module - Supabase Backend
 * Replaces LocalStorage with Supabase for live sync and sharing
 */

const Storage = (() => {
    let supabase = null;
    let initialized = false;

    /**
     * Ensure Supabase is initialized
     */
    function ensureInitialized() {
        if (!supabase) {
            if (!SupabaseClient.isConnected()) {
                throw new Error('Supabase client not connected');
            }
            supabase = SupabaseClient.getClient();
        }
        return supabase;
    }

    /**
     * Initialize storage connection
     */
    async function init() {
        try {
            if (initialized) {
                return true;
            }

            ensureInitialized();

            // Test connection
            const { error } = await supabase
                .from('games')
                .select('id')
                .limit(1);

            if (error) {
                console.error('Database test failed:', error);
                UI.showToast('Failed to connect to database', 'error');
                return false;
            }

            initialized = true;
            console.log('✓ Storage initialized successfully');
            return true;
        } catch (error) {
            console.error('Storage initialization error:', error);
            return false;
        }
    }

    /**
     * Get all games (ordered by creation date, newest first)
     */
    async function getGames(limit = null) {
        try {
            const sb = ensureInitialized();
            let query = sb
                .from('games')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply limit at database level for efficiency
            if (limit !== null && limit > 0) {
                query = query.limit(limit);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching games:', error);
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('getGames error:', error);
            return [];
        }
    }

    /**
     * Save a new game
     */
    async function saveGame(game) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb
                .from('games')
                .insert([game])
                .select();

            if (error) {
                console.error('Error saving game:', error);
                throw error;
            }

            // Update player profiles
            await updatePlayersFromGame(game);

            return data ? data[0] : game;
        } catch (error) {
            console.error('saveGame error:', error);
            throw error;
        }
    }

    /**
     * Update an existing game
     */
    async function updateGame(gameId, updates) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb
                .from('games')
                .update(updates)
                .eq('id', gameId)
                .select();

            if (error) {
                console.error('Error updating game:', error);
                throw error;
            }

            return data ? data[0] : null;
        } catch (error) {
            console.error('updateGame error:', error);
            throw error;
        }
    }

    /**
     * Get a single game by ID
     */
    async function getGame(gameId) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb
                .from('games')
                .select('*')
                .eq('id', gameId)
                .single();

            if (error) {
                console.error('Error fetching game:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('getGame error:', error);
            return null;
        }
    }

    /**
     * Delete a game
     */
    async function deleteGame(gameId) {
        try {
            const { error } = await supabase
                .from('games')
                .delete()
                .eq('id', gameId);

            if (error) {
                console.error('Error deleting game:', error);
                throw error;
            }

            return true;
        } catch (error) {
            console.error('deleteGame error:', error);
            UI.showToast('Failed to delete game', 'error');
            return false;
        }
    }

    /**
     * Get all players
     */
    async function getPlayers() {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb
                .from('players')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching players:', error);
                throw error;
            }

            // Convert array to object with name as key (for compatibility with existing code)
            const playersObj = {};
            (data || []).forEach(player => {
                playersObj[player.name] = player;
            });

            return playersObj;
        } catch (error) {
            console.error('getPlayers error:', error);
            return {};
        }
    }

    /**
     * Get or create a player profile
     */
    async function getOrCreatePlayer(playerName) {
        try {
            const sb = ensureInitialized();

            // Try to fetch existing player
            const { data: existing, error: fetchError } = await sb
                .from('players')
                .select('*')
                .eq('name', playerName)
                .single();

            if (!fetchError && existing) {
                return existing;
            }

            // Create new player if doesn't exist
            const newPlayer = {
                id: generateUUID(),
                name: playerName,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                aggregate_stats: {
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

            const { data: created, error: insertError } = await sb
                .from('players')
                .insert([newPlayer])
                .select();

            if (insertError) {
                console.error('Error creating player:', insertError);
                throw insertError;
            }

            return created ? created[0] : newPlayer;
        } catch (error) {
            console.error('getOrCreatePlayer error:', error);
            // Return a temporary player object if creation fails
            return {
                name: playerName,
                aggregate_stats: {
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
        }
    }

    /**
     * Get all games for a specific player
     */
    async function getPlayerGames(playerName) {
        try {
            const sb = ensureInitialized();
            const { data, error } = await sb
                .from('games')
                .select('*')
                .filter('players', 'cs', `[{"name":"${playerName}"}]`)
                .order('created_at', { ascending: false });

            if (error) {
                // Fallback: fetch all games and filter client-side
                const allGames = await getGames();
                return allGames.filter(game =>
                    game.players.some(p => p.name === playerName)
                );
            }

            return data || [];
        } catch (error) {
            console.error('getPlayerGames error:', error);
            return [];
        }
    }

    /**
     * Update player aggregate stats from a completed game
     */
    async function updatePlayersFromGame(game) {
        try {
            const sb = ensureInitialized();
            const updates = {};

            // Calculate stats for each player
            game.players.forEach(player => {
                const playerName = player.name;

                updates[playerName] = {
                    gamesPlayed: 1,
                    gamesWon: player.winner ? 1 : 0,
                    totalDarts: player.stats.totalDarts,
                    total180s: 0,
                    total140plus: 0,
                    totalCheckoutAttempts: player.stats.checkoutAttempts,
                    totalCheckoutSuccess: player.stats.checkoutSuccess,
                    bestCheckout: player.stats.checkoutSuccess > 0 ? player.stats.checkoutSuccess : 0,
                    maxDart: player.stats.maxDart,
                    totalScore: player.stats.totalScore
                };

                // Count 180s and 140+
                player.turns.forEach(turn => {
                    const turnTotal = turn.darts.reduce((a, b) => a + b, 0);
                    if (turnTotal === 180) {
                        updates[playerName].total180s++;
                    } else if (turnTotal >= 140) {
                        updates[playerName].total140plus++;
                    }
                });
            });

            // Update or create player profiles
            for (const [playerName, stats] of Object.entries(updates)) {
                try {
                    // Try to fetch existing player
                    const { data: existing } = await sb
                        .from('players')
                        .select('aggregate_stats')
                        .eq('name', playerName)
                        .single();

                    if (existing) {
                        // Aggregate the stats
                        const current = existing.aggregate_stats;
                        const aggregated = {
                            gamesPlayed: (current.gamesPlayed || 0) + stats.gamesPlayed,
                            gamesWon: (current.gamesWon || 0) + stats.gamesWon,
                            totalDarts: (current.totalDarts || 0) + stats.totalDarts,
                            total180s: (current.total180s || 0) + stats.total180s,
                            total140plus: (current.total140plus || 0) + stats.total140plus,
                            totalCheckoutAttempts: (current.totalCheckoutAttempts || 0) + stats.totalCheckoutAttempts,
                            totalCheckoutSuccess: (current.totalCheckoutSuccess || 0) + stats.totalCheckoutSuccess,
                            bestCheckout: Math.max(current.bestCheckout || 0, stats.bestCheckout),
                            maxDart: Math.max(current.maxDart || 0, stats.maxDart),
                            totalScore: (current.totalScore || 0) + stats.totalScore
                        };

                        await sb
                            .from('players')
                            .update({ aggregate_stats: aggregated, updated_at: new Date().toISOString() })
                            .eq('name', playerName);
                    } else {
                        // Create new player
                        await sb
                            .from('players')
                            .insert([{
                                id: generateUUID(),
                                name: playerName,
                                aggregate_stats: stats,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }]);
                    }
                } catch (error) {
                    console.error(`Error updating player ${playerName}:`, error);
                    // Continue with next player
                }
            }
        } catch (error) {
            console.error('updatePlayersFromGame error:', error);
            // Don't throw - game was already saved, just stats update failed
        }
    }

    /**
     * Export all data as JSON
     */
    async function exportData() {
        try {
            const games = await getGames();
            const players = await getPlayers();

            return {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                games: games,
                players: players
            };
        } catch (error) {
            console.error('Export error:', error);
            throw error;
        }
    }

    /**
     * Generate UUID v4
     */
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
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
        generateUUID
    };
})();

// Initialize storage when Supabase client is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Supabase to initialize
    setTimeout(async () => {
        if (SupabaseClient.isConnected()) {
            await Storage.init();
        }
    }, 500);
});
