-- ============================================================================
-- Migration V014: Fix Dart Counts for Per-Turn Games
-- Created: 2026-01-08
-- Description: Fix total_darts in game_players for per-turn mode games
--              (should be turns * 3, not turns * 1)
-- ============================================================================

DO $$
DECLARE
  games_fixed INTEGER;
  players_fixed INTEGER;
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'V014: Fixing dart counts for per-turn games';
  RAISE NOTICE '============================================================================';

  -- Step 1: Fix total_darts for per-turn games
  RAISE NOTICE '';
  RAISE NOTICE 'Step 1: Fixing game_players.total_darts for per-turn games...';

  UPDATE game_players gp
  SET total_darts = gp.total_turns * 3
  FROM games g
  WHERE gp.game_id = g.id
    AND g.scoring_mode = 'per-turn'
    AND gp.total_darts != gp.total_turns * 3;  -- Only fix if wrong

  GET DIAGNOSTICS games_fixed = ROW_COUNT;
  RAISE NOTICE '  ✓ Fixed % game_players records', games_fixed;

  -- Step 2: Recalculate player aggregates from game_players
  RAISE NOTICE '';
  RAISE NOTICE 'Step 2: Recalculating player aggregates...';

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

  GET DIAGNOSTICS players_fixed = ROW_COUNT;
  RAISE NOTICE '  ✓ Updated % player records', players_fixed;

  -- Step 3: Refresh materialized view
  RAISE NOTICE '';
  RAISE NOTICE 'Step 3: Refreshing materialized view...';
  REFRESH MATERIALIZED VIEW CONCURRENTLY player_leaderboard;
  RAISE NOTICE '  ✓ Refreshed player_leaderboard';

  -- Step 4: Verify fix
  RAISE NOTICE '';
  RAISE NOTICE 'Step 4: Verification...';

  -- Check if any per-turn games still have wrong dart counts
  DECLARE
    wrong_count INTEGER;
  BEGIN
    SELECT COUNT(*)
    INTO wrong_count
    FROM game_players gp
    JOIN games g ON g.id = gp.game_id
    WHERE g.scoring_mode = 'per-turn'
      AND gp.total_darts != gp.total_turns * 3;

    IF wrong_count > 0 THEN
      RAISE WARNING '  ⚠ Still have % game_players with wrong dart counts!', wrong_count;
    ELSE
      RAISE NOTICE '  ✓ All per-turn games have correct dart counts';
    END IF;
  END;

  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration V014 completed successfully!';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Fixed % game_players records', games_fixed;
  RAISE NOTICE '  - Updated % player records', players_fixed;
  RAISE NOTICE '  - Refreshed player_leaderboard materialized view';
  RAISE NOTICE '============================================================================';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Migration V014 failed: %', SQLERRM;
END $$;
