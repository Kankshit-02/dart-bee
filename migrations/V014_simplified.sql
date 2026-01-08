-- V014: Fix Dart Counts for Per-Turn Games
-- Run this in Supabase SQL Editor

-- Step 1: Fix total_darts for per-turn games
UPDATE game_players gp
SET total_darts = gp.total_turns * 3
FROM games g
WHERE gp.game_id = g.id
  AND g.scoring_mode = 'per-turn'
  AND gp.total_darts != gp.total_turns * 3;

-- Step 2: Recalculate player aggregates
UPDATE players p
SET
  total_darts_thrown = COALESCE(stats.total_darts, 0),
  total_score = COALESCE(stats.total_score, 0),
  total_games_played = COALESCE(stats.games_played, 0),
  total_games_won = COALESCE(stats.games_won, 0),
  total_180s = COALESCE(stats.total_180s, 0),
  total_140_plus = COALESCE(stats.total_140_plus, 0),
  max_dart_score = COALESCE(stats.max_dart, 0),
  max_turn_score = COALESCE(stats.max_turn, 0),
  updated_at = NOW()
FROM (
  SELECT
    gp.player_id,
    COUNT(*) as games_played,
    COUNT(*) FILTER (WHERE gp.is_winner = true) as games_won,
    SUM(gp.total_darts) as total_darts,
    SUM(gp.total_score) as total_score,
    SUM(gp.count_180s) as total_180s,
    SUM(gp.count_140_plus) as total_140_plus,
    MAX(gp.max_dart) as max_dart,
    MAX(gp.max_turn) as max_turn
  FROM game_players gp
  JOIN games g ON g.id = gp.game_id
  WHERE g.completed_at IS NOT NULL
  GROUP BY gp.player_id
) stats
WHERE p.id = stats.player_id;

-- Step 3: Refresh materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY player_leaderboard;

-- Step 4: Verify (optional - just to check)
SELECT
  COUNT(*) as wrong_count,
  'Should be 0 if all fixed' as note
FROM game_players gp
JOIN games g ON g.id = gp.game_id
WHERE g.scoring_mode = 'per-turn'
  AND gp.total_darts != gp.total_turns * 3;
