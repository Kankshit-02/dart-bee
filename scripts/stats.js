/**
 * Statistics Module
 * Calculates and aggregates player statistics
 */

const Stats = (() => {
    /**
     * Calculate player statistics from all their games
     */
    async function calculatePlayerStats(playerName) {
        const playerProfile = await Storage.getOrCreatePlayer(playerName);
        const games = await Storage.getPlayerGames(playerName);

        const stats = {
            gamesPlayed: 0,
            gamesWon: 0,
            winRate: 0,
            totalDarts: 0,
            totalScore: 0,
            avgPerDart: 0,
            avgPerTurn: 0,
            maxDart: 0,
            maxTurn: 0,
            maxTurnCount: 0,
            total180s: 0,
            total140plus: 0,
            bestCheckout: 0,
            checkoutPercentage: 0,
            headToHead: {},
            recentGames: []
        };

        games.forEach(game => {
            const player = game.players.find(p => p.name === playerName);
            if (!player) return;

            stats.gamesPlayed++;
            if (player.winner) {
                stats.gamesWon++;
            }

            // Record opponent records
            game.players.forEach(opponent => {
                if (opponent.name !== playerName) {
                    if (!stats.headToHead[opponent.name]) {
                        stats.headToHead[opponent.name] = { wins: 0, losses: 0 };
                    }
                    if (player.winner) {
                        stats.headToHead[opponent.name].wins++;
                    } else {
                        stats.headToHead[opponent.name].losses++;
                    }
                }
            });

            // Dart and score stats
            stats.totalDarts += player.stats.totalDarts;
            stats.totalScore += player.stats.totalScore;
            stats.maxDart = Math.max(stats.maxDart, player.stats.maxDart);
            stats.maxTurn = Math.max(stats.maxTurn, player.stats.maxTurn);
            stats.maxTurnCount++;

            // Analyze turns for 180s and 140+
            player.turns.forEach(turn => {
                const turnTotal = turn.darts.reduce((a, b) => a + b, 0);
                if (turnTotal === 180) {
                    stats.total180s++;
                }
                if (turnTotal >= 140 && turnTotal < 180) {
                    stats.total140plus++;
                }
            });

            // Checkout stats
            if (player.stats.checkoutAttempts > 0) {
                stats.checkoutPercentage = (player.stats.checkoutSuccess / player.stats.checkoutAttempts * 100).toFixed(1);
                stats.bestCheckout = Math.max(stats.bestCheckout, player.stats.checkoutSuccess);
            }
        });

        // Calculate averages (both per 3 darts/per turn)
        if (stats.totalDarts > 0) {
            stats.avgPerDart = (stats.totalScore / stats.totalDarts * 3).toFixed(2);
            stats.avgPerTurn = (stats.totalScore / stats.totalDarts * 3).toFixed(2);
        }

        if (stats.gamesPlayed > 0) {
            stats.winRate = (stats.gamesWon / stats.gamesPlayed * 100).toFixed(1);
        }

        // Recent games (last 5)
        stats.recentGames = games.slice(-5).map(game => {
            const player = game.players.find(p => p.name === playerName);
            return {
                id: game.id,
                date: new Date(game.created_at).toLocaleDateString(),
                opponent: game.players.filter(p => p.name !== playerName).map(p => p.name).join(', '),
                won: player.winner,
                darts: player.stats.totalDarts,
                score: player.stats.totalScore
            };
        }).reverse();

        return stats;
    }

    /**
     * Get leaderboard rankings
     */
    async function getLeaderboard(metric = 'wins', timeFilter = 'all-time') {
        const players = await Storage.getPlayers();
        const games = await Storage.getGames();

        // Filter games by time
        const cutoffDate = getTimeFilterDate(timeFilter);
        const filteredGames = games.filter(g => {
            const gameDate = new Date(g.created_at).getTime();
            return gameDate >= cutoffDate && g.completed_at;
        });

        const rankings = [];
        for (const [name, profile] of Object.entries(players)) {
            // Count games in filtered period
            const playerGames = filteredGames.filter(g =>
                g.players.some(p => p.name === name)
            );

            if (playerGames.length === 0) {
                continue;
            }

            const stats = await calculatePlayerStats(name);
            const statsInPeriod = calculateStatsForGames(playerGames, name);

            rankings.push({
                name: name,
                metric: getMetricValue(metric, statsInPeriod),
                stats: statsInPeriod,
                fullStats: stats
            });
        }

        // Sort by metric
        rankings.sort((a, b) => {
            const aVal = parseFloat(a.metric) || 0;
            const bVal = parseFloat(b.metric) || 0;
            return bVal - aVal;
        });

        return rankings;
    }

    /**
     * Calculate stats for specific games
     */
    function calculateStatsForGames(gamesArray, playerName) {
        const stats = {
            gamesPlayed: 0,
            gamesWon: 0,
            winRate: 0,
            totalDarts: 0,
            total180s: 0,
            avgPerDart: 0
        };

        gamesArray.forEach(game => {
            const player = game.players.find(p => p.name === playerName);
            if (!player) return;

            stats.gamesPlayed++;
            if (player.winner) {
                stats.gamesWon++;
            }

            stats.totalDarts += player.stats.totalDarts;

            player.turns.forEach(turn => {
                const turnTotal = turn.darts.reduce((a, b) => a + b, 0);
                if (turnTotal === 180) {
                    stats.total180s++;
                }
            });
        });

        if (stats.totalDarts > 0) {
            const totalScore = gamesArray.reduce((sum, game) => {
                const player = game.players.find(p => p.name === playerName);
                return sum + (player?.stats.totalScore || 0);
            }, 0);
            // Calculate average per 3 darts (per turn)
            stats.avgPerDart = (totalScore / stats.totalDarts * 3).toFixed(2);
        }

        if (stats.gamesPlayed > 0) {
            stats.winRate = (stats.gamesWon / stats.gamesPlayed * 100).toFixed(1);
        }

        return stats;
    }

    /**
     * Get time filter date
     */
    function getTimeFilterDate(filter) {
        const now = Date.now();
        switch (filter) {
            case '7-days':
                return now - (7 * 24 * 60 * 60 * 1000);
            case '30-days':
                return now - (30 * 24 * 60 * 60 * 1000);
            case 'all-time':
            default:
                return 0;
        }
    }

    /**
     * Get metric value for ranking
     */
    function getMetricValue(metric, stats) {
        switch (metric) {
            case 'wins':
                return stats.gamesWon;
            case 'win-rate':
                return stats.winRate;
            case 'avg-dart':
                return stats.avgPerDart;
            case '180s':
                return stats.total180s;
            default:
                return 0;
        }
    }

    /**
     * Get quick stats overview for home page
     */
    async function getQuickStats() {
        const allGames = await Storage.getGames();
        const games = allGames.filter(g => g.completed_at);
        const players = await Storage.getPlayers();

        if (games.length === 0) {
            return {
                totalGames: 0,
                totalPlayers: 0,
                topPlayer: null,
                highestAvg: 0
            };
        }

        const playerStats = [];
        for (const playerName of Object.keys(players)) {
            const stats = await calculatePlayerStats(playerName);
            playerStats.push({ name: playerName, ...stats });
        }

        playerStats.sort((a, b) => parseFloat(b.avgPerDart) - parseFloat(a.avgPerDart));

        return {
            totalGames: games.length,
            totalPlayers: Object.keys(players).length,
            topPlayer: playerStats[0]?.name || null,
            highestAvg: playerStats[0]?.avgPerDart || '0'
        };
    }

    /**
     * Format stat value for display
     */
    function formatStat(value, type = 'number') {
        if (value === null || value === undefined) return '—';

        switch (type) {
            case 'percentage':
                return `${parseFloat(value).toFixed(1)}%`;
            case 'decimal':
                return parseFloat(value).toFixed(2);
            case 'integer':
                return Math.floor(value);
            default:
                return value.toString();
        }
    }

    /**
     * Get comparison between two players
     */
    async function comparePlayerStats(playerName1, playerName2) {
        const stats1 = await calculatePlayerStats(playerName1);
        const stats2 = await calculatePlayerStats(playerName2);

        return {
            player1: { name: playerName1, ...stats1 },
            player2: { name: playerName2, ...stats2 },
            headToHeadRecord: await getHeadToHeadRecord(playerName1, playerName2)
        };
    }

    /**
     * Get head to head record between two players
     */
    async function getHeadToHeadRecord(playerName1, playerName2) {
        const allGames = await Storage.getGames();
        const games = allGames.filter(g => g.completed_at);
        let wins1 = 0, wins2 = 0;

        games.forEach(game => {
            const player1 = game.players.find(p => p.name === playerName1);
            const player2 = game.players.find(p => p.name === playerName2);

            if (player1 && player2) {
                if (player1.winner) wins1++;
                else if (player2.winner) wins2++;
            }
        });

        return { wins: wins1, losses: wins2, total: wins1 + wins2 };
    }

    // Public API
    return {
        calculatePlayerStats,
        getLeaderboard,
        calculateStatsForGames,
        getTimeFilterDate,
        getMetricValue,
        getQuickStats,
        formatStat,
        comparePlayerStats,
        getHeadToHeadRecord
    };
})();
