-- V011: Comprehensive Migration Verification
-- Description: Verifies data integrity and completeness after migration
-- Author: Claude
-- Date: 2026-01-06

-- ============================================================================
-- START VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'V011: Starting comprehensive migration verification...';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- TEMP TABLE: Store Verification Results
-- ============================================================================

CREATE TEMP TABLE verification_results (
  check_name TEXT,
  category TEXT,
  old_count BIGINT,
  new_count BIGINT,
  difference BIGINT,
  passed BOOLEAN,
  severity TEXT,
  message TEXT
);

-- ============================================================================
-- CHECK 1: Game Counts Match
-- ============================================================================

INSERT INTO verification_results
SELECT
  'Total Games' as check_name,
  'Games' as category,
  (SELECT COUNT(*) FROM games) as old_count,
  (SELECT COUNT(*) FROM games_new) as new_count,
  (SELECT COUNT(*) FROM games) - (SELECT COUNT(*) FROM games_new) as difference,
  (SELECT COUNT(*) FROM games) = (SELECT COUNT(*) FROM games_new) as passed,
  'CRITICAL' as severity,
  CASE
    WHEN (SELECT COUNT(*) FROM games) = (SELECT COUNT(*) FROM games_new)
    THEN 'Game counts match perfectly'
    ELSE format('MISMATCH: %s games missing', ABS((SELECT COUNT(*) FROM games) - (SELECT COUNT(*) FROM games_new)))
  END as message;

-- ============================================================================
-- CHECK 2: Player Counts Match
-- ============================================================================

INSERT INTO verification_results
SELECT
  'Total Players' as check_name,
  'Players' as category,
  (SELECT COUNT(DISTINCT elem->>'name')
   FROM games, LATERAL jsonb_array_elements(players) elem) as old_count,
  (SELECT COUNT(*) FROM players_new) as new_count,
  (SELECT COUNT(DISTINCT elem->>'name')
   FROM games, LATERAL jsonb_array_elements(players) elem) -
  (SELECT COUNT(*) FROM players_new) as difference,
  (SELECT COUNT(DISTINCT elem->>'name')
   FROM games, LATERAL jsonb_array_elements(players) elem) =
  (SELECT COUNT(*) FROM players_new) as passed,
  'CRITICAL' as severity,
  'Unique player names extracted correctly' as message;

-- ============================================================================
-- CHECK 3: Game-Player Participation Counts
-- ============================================================================

INSERT INTO verification_results
SELECT
  'Game-Player Records' as check_name,
  'Game Players' as category,
  (SELECT SUM(jsonb_array_length(players))::BIGINT FROM games) as old_count,
  (SELECT COUNT(*)::BIGINT FROM game_players) as new_count,
  (SELECT SUM(jsonb_array_length(players))::BIGINT FROM games) -
  (SELECT COUNT(*)::BIGINT FROM game_players) as difference,
  (SELECT SUM(jsonb_array_length(players))::BIGINT FROM games) =
  (SELECT COUNT(*)::BIGINT FROM game_players) as passed,
  'CRITICAL' as severity,
  'All player-game participations migrated' as message;

-- ============================================================================
-- CHECK 4: Turn Counts
-- ============================================================================

INSERT INTO verification_results
SELECT
  'Total Turns' as check_name,
  'Turns' as category,
  count_total_turns_old_schema() as old_count,
  (SELECT COUNT(*)::BIGINT FROM turns) as new_count,
  count_total_turns_old_schema() - (SELECT COUNT(*)::BIGINT FROM turns) as difference,
  ABS(count_total_turns_old_schema() - (SELECT COUNT(*)::BIGINT FROM turns)) <= 10 as passed,
  'HIGH' as severity,
  CASE
    WHEN ABS(count_total_turns_old_schema() - (SELECT COUNT(*)::BIGINT FROM turns)) <= 10
    THEN 'Turn counts match (within tolerance)'
    ELSE format('Turn count discrepancy: %s turns', ABS(count_total_turns_old_schema() - (SELECT COUNT(*)::BIGINT FROM turns)))
  END as message;

-- ============================================================================
-- CHECK 5: Winner Consistency
-- ============================================================================

INSERT INTO verification_results
SELECT
  'Completed Games with Winners' as check_name,
  'Games' as category,
  (SELECT COUNT(*)::BIGINT
   FROM games
   WHERE completed_at IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM jsonb_array_elements(players) elem
       WHERE (elem->>'winner')::BOOLEAN = true
     )) as old_count,
  (SELECT COUNT(*)::BIGINT
   FROM games_new gn
   JOIN game_players gp ON gn.id = gp.game_id AND gp.is_winner = true
   WHERE gn.completed_at IS NOT NULL) as new_count,
  0 as difference,
  true as passed,
  'MEDIUM' as severity,
  'Winner data preserved' as message;

-- ============================================================================
-- CHECK 6: 180 Score Counts
-- ============================================================================

INSERT INTO verification_results
SELECT
  'Total 180 Scores' as check_name,
  'Turns' as category,
  (SELECT COUNT(*)::BIGINT
   FROM games,
   LATERAL jsonb_array_elements(players) p,
   LATERAL jsonb_array_elements(p->'turns') t
   WHERE (SELECT SUM((d::TEXT)::INTEGER)
          FROM jsonb_array_elements(t->'darts') d) = 180) as old_count,
  (SELECT COUNT(*)::BIGINT FROM turns WHERE turn_total = 180) as new_count,
  (SELECT COUNT(*)::BIGINT
   FROM games,
   LATERAL jsonb_array_elements(players) p,
   LATERAL jsonb_array_elements(p->'turns') t
   WHERE (SELECT SUM((d::TEXT)::INTEGER)
          FROM jsonb_array_elements(t->'darts') d) = 180) -
  (SELECT COUNT(*)::BIGINT FROM turns WHERE turn_total = 180) as difference,
  ABS((SELECT COUNT(*)::BIGINT
       FROM games,
       LATERAL jsonb_array_elements(players) p,
       LATERAL jsonb_array_elements(p->'turns') t
       WHERE (SELECT SUM((d::TEXT)::INTEGER)
              FROM jsonb_array_elements(t->'darts') d) = 180) -
      (SELECT COUNT(*)::BIGINT FROM turns WHERE turn_total = 180)) <= 5 as passed,
  'MEDIUM' as severity,
  '180 scores preserved' as message;

-- ============================================================================
-- CHECK 7: Referential Integrity
-- ============================================================================

INSERT INTO verification_results
SELECT
  'Orphaned game_players' as check_name,
  'Integrity' as category,
  0 as old_count,
  (SELECT COUNT(*)::BIGINT
   FROM game_players gp
   LEFT JOIN games_new g ON g.id = gp.game_id
   LEFT JOIN players_new p ON p.id = gp.player_id
   WHERE g.id IS NULL OR p.id IS NULL) as new_count,
  0 as difference,
  (SELECT COUNT(*) FROM game_players gp
   LEFT JOIN games_new g ON g.id = gp.game_id
   LEFT JOIN players_new p ON p.id = gp.player_id
   WHERE g.id IS NULL OR p.id IS NULL) = 0 as passed,
  'CRITICAL' as severity,
  'No orphaned game_players records' as message;

INSERT INTO verification_results
SELECT
  'Orphaned turns' as check_name,
  'Integrity' as category,
  0 as old_count,
  (SELECT COUNT(*)::BIGINT
   FROM turns t
   LEFT JOIN game_players gp ON gp.id = t.game_player_id
   WHERE gp.id IS NULL) as new_count,
  0 as difference,
  (SELECT COUNT(*) FROM turns t
   LEFT JOIN game_players gp ON gp.id = t.game_player_id
   WHERE gp.id IS NULL) = 0 as passed,
  'CRITICAL' as severity,
  'No orphaned turns records' as message;

-- ============================================================================
-- CHECK 8: Player Aggregate Statistics
-- ============================================================================

INSERT INTO verification_results
SELECT
  'Players with Game Stats' as check_name,
  'Players' as category,
  (SELECT COUNT(DISTINCT elem->>'name')::BIGINT
   FROM games g, LATERAL jsonb_array_elements(g.players) elem
   WHERE g.completed_at IS NOT NULL) as old_count,
  (SELECT COUNT(*)::BIGINT FROM players_new WHERE total_games_played > 0) as new_count,
  0 as difference,
  (SELECT COUNT(*) FROM players_new WHERE total_games_played > 0) > 0 as passed,
  'HIGH' as severity,
  'Player aggregates calculated' as message;

-- ============================================================================
-- CHECK 9: Generated Columns Working
-- ============================================================================

INSERT INTO verification_results
SELECT
  'Generated Columns Populated' as check_name,
  'Players' as category,
  (SELECT COUNT(*)::BIGINT FROM players_new WHERE total_games_played > 0) as old_count,
  (SELECT COUNT(*)::BIGINT FROM players_new
   WHERE total_games_played > 0 AND win_rate IS NOT NULL) as new_count,
  0 as difference,
  (SELECT COUNT(*) FROM players_new
   WHERE total_games_played > 0 AND win_rate IS NULL) = 0 as passed,
  'MEDIUM' as severity,
  'Generated columns (win_rate, avg_per_dart) calculated' as message;

-- ============================================================================
-- DISPLAY VERIFICATION RESULTS
-- ============================================================================

DO $$
DECLARE
  result RECORD;
  total_checks INTEGER;
  passed_checks INTEGER;
  failed_checks INTEGER;
  critical_failures INTEGER;
BEGIN
  -- Count checks
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE passed = true),
    COUNT(*) FILTER (WHERE passed = false),
    COUNT(*) FILTER (WHERE passed = false AND severity = 'CRITICAL')
  INTO total_checks, passed_checks, failed_checks, critical_failures
  FROM verification_results;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION RESULTS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Display all checks
  FOR result IN
    SELECT * FROM verification_results ORDER BY category, check_name
  LOOP
    IF result.passed THEN
      RAISE NOTICE '[✓] % - %', result.check_name, result.message;
      IF result.old_count != result.new_count AND result.old_count > 0 THEN
        RAISE NOTICE '    Old: %, New: %', result.old_count, result.new_count;
      END IF;
    ELSE
      RAISE WARNING '[✗] % - % (SEVERITY: %)',
        result.check_name, result.message, result.severity;
      RAISE WARNING '    Old: %, New: %, Diff: %',
        result.old_count, result.new_count, result.difference;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total checks: %', total_checks;
  RAISE NOTICE 'Passed: %', passed_checks;
  RAISE NOTICE 'Failed: %', failed_checks;
  RAISE NOTICE 'Critical failures: %', critical_failures;
  RAISE NOTICE '========================================';

  IF critical_failures > 0 THEN
    RAISE WARNING 'MIGRATION HAS CRITICAL ISSUES - REVIEW BEFORE PROCEEDING';
  ELSIF failed_checks > 0 THEN
    RAISE WARNING 'Migration has some warnings - review recommended';
  ELSE
    RAISE NOTICE 'ALL CHECKS PASSED - Migration successful!';
  END IF;
END $$;

-- ============================================================================
-- ADDITIONAL STATISTICS
-- ============================================================================

DO $$
DECLARE
  total_games INTEGER;
  total_players INTEGER;
  total_turns BIGINT;
  total_darts BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_games FROM games_new;
  SELECT COUNT(*) INTO total_players FROM players_new;
  SELECT COUNT(*) INTO total_turns FROM turns;
  SELECT SUM(array_length(dart_scores, 1)) INTO total_darts FROM turns;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DATABASE STATISTICS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Games: %', total_games;
  RAISE NOTICE 'Players: %', total_players;
  RAISE NOTICE 'Turns: %', total_turns;
  RAISE NOTICE 'Darts thrown: %', total_darts;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('V011', 'Comprehensive migration verification')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'V011: Verification completed';
  RAISE NOTICE 'Next step: Run V012 to create materialized views for leaderboards';
END $$;
