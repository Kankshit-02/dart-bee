-- V007: Update Player Aggregate Statistics
-- Description: Calculates and updates aggregate stats in players_new from game_players and turns
-- Author: Claude
-- Date: 2026-01-06

-- ============================================================================
-- START MIGRATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V007: Starting player aggregate statistics update...';
END $$;

-- Update progress
UPDATE migration_progress
SET started_at = NOW(), status = 'running'
WHERE step = 'V007_update_aggregates';

-- ============================================================================
-- STEP 1: Update Player Aggregates from game_players
-- ============================================================================

UPDATE players_new p
SET
  total_games_played = stats.games_played,
  total_games_won = stats.games_won,
  total_darts_thrown = stats.total_darts,
  total_score = stats.total_score,
  total_180s = stats.total_180s,
  total_140_plus = stats.total_140_plus,
  max_dart_score = stats.max_dart,
  max_turn_score = stats.max_turn,
  total_checkout_attempts = stats.checkout_attempts,
  total_checkout_successes = stats.checkout_successes,
  best_checkout = stats.best_checkout,
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
    MAX(gp.max_turn) as max_turn,
    SUM(gp.checkout_attempts) as checkout_attempts,
    SUM(gp.checkout_successes) as checkout_successes,
    MAX(gp.final_score) as best_checkout
  FROM game_players gp
  GROUP BY gp.player_id
) stats
WHERE p.id = stats.player_id;

-- ============================================================================
-- STEP 2: Verification
-- ============================================================================

DO $$
DECLARE
  players_with_stats INTEGER;
  players_without_stats INTEGER;
  total_players INTEGER;
BEGIN
  -- Count players with game stats
  SELECT COUNT(*) INTO players_with_stats
  FROM players_new
  WHERE total_games_played > 0;

  -- Count players without game stats
  SELECT COUNT(*) INTO players_without_stats
  FROM players_new
  WHERE total_games_played = 0;

  -- Total players
  SELECT COUNT(*) INTO total_players FROM players_new;

  RAISE NOTICE 'Player aggregate stats updated:';
  RAISE NOTICE '  Players with stats: %', players_with_stats;
  RAISE NOTICE '  Players without stats: %', players_without_stats;
  RAISE NOTICE '  Total players: %', total_players;

  -- Update progress
  UPDATE migration_progress
  SET
    completed_at = NOW(),
    status = 'completed',
    rows_processed = players_with_stats
  WHERE step = 'V007_update_aggregates';
END $$;

-- ============================================================================
-- STEP 3: Display Top Players
-- ============================================================================

DO $$
DECLARE
  top_winners TEXT;
  top_scorers TEXT;
  top_180s TEXT;
BEGIN
  -- Top 5 by wins
  SELECT string_agg(format('%s (%s wins)', name, total_games_won), ', ')
  INTO top_winners
  FROM (
    SELECT name, total_games_won
    FROM players_new
    WHERE total_games_played > 0
    ORDER BY total_games_won DESC
    LIMIT 5
  ) subq;

  -- Top 5 by total score
  SELECT string_agg(format('%s (%s pts)', name, total_score), ', ')
  INTO top_scorers
  FROM (
    SELECT name, total_score
    FROM players_new
    WHERE total_games_played > 0
    ORDER BY total_score DESC
    LIMIT 5
  ) subq;

  -- Top 5 by 180s
  SELECT string_agg(format('%s (%s × 180)', name, total_180s), ', ')
  INTO top_180s
  FROM (
    SELECT name, total_180s
    FROM players_new
    WHERE total_180s > 0
    ORDER BY total_180s DESC
    LIMIT 5
  ) subq;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Top Players:';
  RAISE NOTICE '  Most wins: %', COALESCE(top_winners, 'None');
  RAISE NOTICE '  Top scorers: %', COALESCE(top_scorers, 'None');
  RAISE NOTICE '  Most 180s: %', COALESCE(top_180s, 'None');
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- STEP 4: Display Summary Statistics
-- ============================================================================

DO $$
DECLARE
  total_games_played INTEGER;
  total_darts_thrown BIGINT;
  total_180s INTEGER;
  avg_games_per_player NUMERIC;
  avg_win_rate NUMERIC;
BEGIN
  SELECT
    SUM(total_games_played),
    SUM(total_darts_thrown),
    SUM(total_180s),
    AVG(total_games_played),
    AVG(CASE WHEN total_games_played > 0
      THEN (total_games_won::NUMERIC / total_games_played) * 100
      ELSE 0 END)
  INTO total_games_played, total_darts_thrown, total_180s, avg_games_per_player, avg_win_rate
  FROM players_new;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Overall Statistics:';
  RAISE NOTICE '  Total game participations: %', total_games_played;
  RAISE NOTICE '  Total darts thrown: %', total_darts_thrown;
  RAISE NOTICE '  Total 180s: %', total_180s;
  RAISE NOTICE '  Avg games per player: %', ROUND(avg_games_per_player, 1);
  RAISE NOTICE '  Avg win rate: %%', ROUND(avg_win_rate, 1);
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('V007', 'Update player aggregate statistics from game data')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V007: Player aggregate statistics updated';
  RAISE NOTICE 'Next step: Run V008 to create performance indexes';
END $$;
