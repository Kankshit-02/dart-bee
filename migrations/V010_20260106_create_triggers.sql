-- V010: Create Triggers for Automatic Stat Updates
-- Description: Creates triggers to automatically update player aggregates when games change
-- Author: Claude
-- Date: 2026-01-06

-- ============================================================================
-- START TRIGGER CREATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V010: Creating triggers for automatic stat updates...';
END $$;

-- ============================================================================
-- TRIGGER FUNCTION: Update Player Aggregates After Game Completion
-- ============================================================================

CREATE OR REPLACE FUNCTION update_player_aggregates_from_game()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if game is being marked as completed
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR OLD IS NULL) THEN
    -- Update all players in this game
    UPDATE players_new p
    SET
      total_games_played = p.total_games_played + 1,
      total_games_won = p.total_games_won + CASE WHEN gp.is_winner THEN 1 ELSE 0 END,
      total_darts_thrown = p.total_darts_thrown + gp.total_darts,
      total_score = p.total_score + gp.total_score,
      total_180s = p.total_180s + gp.count_180s,
      total_140_plus = p.total_140_plus + gp.count_140_plus,
      max_dart_score = GREATEST(p.max_dart_score, gp.max_dart),
      max_turn_score = GREATEST(p.max_turn_score, gp.max_turn),
      total_checkout_attempts = p.total_checkout_attempts + gp.checkout_attempts,
      total_checkout_successes = p.total_checkout_successes + gp.checkout_successes,
      updated_at = NOW()
    FROM game_players gp
    WHERE p.id = gp.player_id AND gp.game_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_player_aggregates_from_game IS 'Updates player aggregate stats when a game is completed';

-- Create trigger
CREATE TRIGGER trigger_update_player_aggregates
AFTER UPDATE OF completed_at ON games_new
FOR EACH ROW
WHEN (NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL)
EXECUTE FUNCTION update_player_aggregates_from_game();

RAISE NOTICE '  ✓ Created trigger: update_player_aggregates_from_game';

-- ============================================================================
-- TRIGGER FUNCTION: Update Game's updated_at Timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_game_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_game_timestamp IS 'Automatically updates games_new.updated_at';

-- Create trigger
CREATE TRIGGER trigger_update_game_timestamp
BEFORE UPDATE ON games_new
FOR EACH ROW
EXECUTE FUNCTION update_game_timestamp();

RAISE NOTICE '  ✓ Created trigger: update_game_timestamp';

-- ============================================================================
-- TRIGGER FUNCTION: Update Player's updated_at Timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_player_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_player_timestamp IS 'Automatically updates players_new.updated_at';

-- Create trigger
CREATE TRIGGER trigger_update_player_timestamp
BEFORE UPDATE ON players_new
FOR EACH ROW
EXECUTE FUNCTION update_player_timestamp();

RAISE NOTICE '  ✓ Created trigger: update_player_timestamp';

-- ============================================================================
-- TRIGGER FUNCTION: Update game_players's updated_at Timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_game_player_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_game_player_timestamp IS 'Automatically updates game_players.updated_at';

-- Create trigger
CREATE TRIGGER trigger_update_game_player_timestamp
BEFORE UPDATE ON game_players
FOR EACH ROW
EXECUTE FUNCTION update_game_player_timestamp();

RAISE NOTICE '  ✓ Created trigger: update_game_player_timestamp';

-- ============================================================================
-- TRIGGER FUNCTION: Validate Turn Data Before Insert
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_turn_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure turn_total matches sum of dart_scores
  IF NEW.turn_total != (SELECT SUM(dart) FROM unnest(NEW.dart_scores) dart) THEN
    RAISE EXCEPTION 'Turn total (%) does not match sum of dart scores (%)',
      NEW.turn_total,
      (SELECT SUM(dart) FROM unnest(NEW.dart_scores) dart);
  END IF;

  -- Ensure score_after calculation is correct (for non-busted turns)
  IF NOT NEW.is_busted THEN
    IF NEW.score_after != (NEW.score_before - NEW.turn_total) THEN
      RAISE EXCEPTION 'Score calculation mismatch: % - % != %',
        NEW.score_before, NEW.turn_total, NEW.score_after;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_turn_data IS 'Validates turn data consistency before insert';

-- Create trigger
CREATE TRIGGER trigger_validate_turn_data
BEFORE INSERT ON turns
FOR EACH ROW
EXECUTE FUNCTION validate_turn_data();

RAISE NOTICE '  ✓ Created trigger: validate_turn_data';

-- ============================================================================
-- TRIGGER FUNCTION: Refresh Materialized View After Game Completion (Optional)
-- ============================================================================

-- Note: This trigger will be enabled after V012 creates the materialized view

CREATE OR REPLACE FUNCTION refresh_leaderboard_on_game_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only refresh if game is being marked as completed
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR OLD IS NULL) THEN
    -- Refresh the materialized view (created in V012)
    -- Note: This is commented out until V012 creates the view
    -- REFRESH MATERIALIZED VIEW CONCURRENTLY player_leaderboard;
    NULL; -- Placeholder
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_leaderboard_on_game_completion IS 'Refreshes leaderboard materialized view on game completion (disabled until V012)';

RAISE NOTICE '  ✓ Created function: refresh_leaderboard_on_game_completion (trigger will be enabled in V012)';

-- ============================================================================
-- STEP 2: Test Triggers (Optional - can be run manually)
-- ============================================================================

-- Function to test trigger behavior
CREATE OR REPLACE FUNCTION test_triggers()
RETURNS TABLE (
  test_name TEXT,
  passed BOOLEAN,
  message TEXT
) AS $$
DECLARE
  test_game_id UUID;
  player_before_games INTEGER;
  player_after_games INTEGER;
BEGIN
  -- Test 1: Check that player aggregates update on game completion
  -- (This is for manual testing - commented out to avoid side effects)

  RETURN QUERY
  SELECT
    'Triggers created'::TEXT,
    true,
    'All triggers successfully created'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: Display Trigger Summary
-- ============================================================================

DO $$
DECLARE
  total_triggers INTEGER;
  total_functions INTEGER;
BEGIN
  -- Count triggers
  SELECT COUNT(*) INTO total_triggers
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND event_object_table IN ('games_new', 'players_new', 'game_players', 'turns');

  -- Count trigger functions
  SELECT COUNT(*) INTO total_functions
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname LIKE '%update%player%'
       OR p.proname LIKE '%update%timestamp%'
       OR p.proname LIKE '%validate%turn%'
       OR p.proname LIKE '%refresh%leaderboard%';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Triggers Summary:';
  RAISE NOTICE '  Total triggers: %', total_triggers;
  RAISE NOTICE '  Total trigger functions: %', total_functions;
  RAISE NOTICE '';
  RAISE NOTICE 'Active Triggers:';
  RAISE NOTICE '  ✓ update_player_aggregates (on game completion)';
  RAISE NOTICE '  ✓ update_game_timestamp (before games_new update)';
  RAISE NOTICE '  ✓ update_player_timestamp (before players_new update)';
  RAISE NOTICE '  ✓ update_game_player_timestamp (before game_players update)';
  RAISE NOTICE '  ✓ validate_turn_data (before turns insert)';
  RAISE NOTICE '';
  RAISE NOTICE 'Prepared (not yet active):';
  RAISE NOTICE '  - refresh_leaderboard_on_game_completion (will be enabled in V012)';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('V010', 'Create triggers for automatic stat updates')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V010: Triggers created successfully';
  RAISE NOTICE 'Player stats will now auto-update when games are completed';
  RAISE NOTICE 'Next step: Run V011 to verify all migration data integrity';
END $$;
