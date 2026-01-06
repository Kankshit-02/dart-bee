-- V002: Create Helper Functions for Data Migration
-- Description: Utility functions to assist with JSONB extraction and data transformation
-- Author: Claude
-- Date: 2026-01-06

-- ============================================================================
-- HELPER FUNCTION: Extract Player Names from Games
-- ============================================================================

CREATE OR REPLACE FUNCTION extract_player_names_from_games()
RETURNS TABLE (player_name TEXT, first_seen TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    elem->>'name' as player_name,
    MIN(g.created_at) as first_seen
  FROM games g,
  LATERAL jsonb_array_elements(g.players) elem
  WHERE elem->>'name' IS NOT NULL
  GROUP BY elem->>'name'
  ORDER BY MIN(g.created_at);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION extract_player_names_from_games IS 'Extracts unique player names from games JSONB';

-- ============================================================================
-- HELPER FUNCTION: Count Total Turns in Old Schema
-- ============================================================================

CREATE OR REPLACE FUNCTION count_total_turns_old_schema()
RETURNS INTEGER AS $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT SUM(jsonb_array_length(player_elem->'turns'))::INTEGER INTO total_count
  FROM games,
  LATERAL jsonb_array_elements(players) player_elem;

  RETURN COALESCE(total_count, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION count_total_turns_old_schema IS 'Counts total turns in old JSONB schema for verification';

-- ============================================================================
-- HELPER FUNCTION: Extract Turns from JSONB for a Specific Player
-- ============================================================================

CREATE OR REPLACE FUNCTION extract_turns_for_player(
  p_game_id UUID,
  p_player_name TEXT
)
RETURNS TABLE (
  turn_index INTEGER,
  turn_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (ordinality - 1)::INTEGER as turn_index,
    turn_elem as turn_data
  FROM games g,
  LATERAL (
    SELECT player_jsonb
    FROM jsonb_array_elements(g.players) player_jsonb
    WHERE player_jsonb->>'name' = p_player_name
    LIMIT 1
  ) player_data,
  LATERAL jsonb_array_elements(player_data.player_jsonb->'turns') WITH ORDINALITY turn_elem
  WHERE g.id = p_game_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION extract_turns_for_player IS 'Extracts turn history for a specific player in a game';

-- ============================================================================
-- HELPER FUNCTION: Safe Integer Extraction from JSONB
-- ============================================================================

CREATE OR REPLACE FUNCTION safe_jsonb_int(
  json_obj JSONB,
  key_path TEXT,
  default_val INTEGER DEFAULT 0
)
RETURNS INTEGER AS $$
DECLARE
  result INTEGER;
BEGIN
  result := (json_obj #>> string_to_array(key_path, '.'))::INTEGER;
  RETURN COALESCE(result, default_val);
EXCEPTION WHEN OTHERS THEN
  RETURN default_val;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION safe_jsonb_int IS 'Safely extracts integer from JSONB with default fallback';

-- ============================================================================
-- HELPER FUNCTION: Safe Boolean Extraction from JSONB
-- ============================================================================

CREATE OR REPLACE FUNCTION safe_jsonb_bool(
  json_obj JSONB,
  key_path TEXT,
  default_val BOOLEAN DEFAULT false
)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  result := (json_obj #>> string_to_array(key_path, '.'))::BOOLEAN;
  RETURN COALESCE(result, default_val);
EXCEPTION WHEN OTHERS THEN
  RETURN default_val;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION safe_jsonb_bool IS 'Safely extracts boolean from JSONB with default fallback';

-- ============================================================================
-- HELPER FUNCTION: Extract Dart Scores Array from Turn JSONB
-- ============================================================================

CREATE OR REPLACE FUNCTION extract_dart_scores(turn_jsonb JSONB)
RETURNS INTEGER[] AS $$
DECLARE
  dart_array INTEGER[];
BEGIN
  SELECT ARRAY(
    SELECT (dart_elem::TEXT)::INTEGER
    FROM jsonb_array_elements(turn_jsonb->'darts') dart_elem
  ) INTO dart_array;

  RETURN COALESCE(dart_array, ARRAY[]::INTEGER[]);
EXCEPTION WHEN OTHERS THEN
  RETURN ARRAY[]::INTEGER[];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION extract_dart_scores IS 'Converts JSONB dart array to PostgreSQL integer array';

-- ============================================================================
-- TEMPORARY TABLE: Migration Progress Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS migration_progress (
  step TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  rows_processed INTEGER DEFAULT 0,
  errors TEXT[]
);

COMMENT ON TABLE migration_progress IS 'Tracks migration progress and errors';

-- Initialize progress tracking
INSERT INTO migration_progress (step, status)
VALUES
  ('V003_migrate_players', 'pending'),
  ('V004_migrate_games', 'pending'),
  ('V005_migrate_game_players', 'pending'),
  ('V006_migrate_turns', 'pending'),
  ('V007_update_aggregates', 'pending')
ON CONFLICT (step) DO NOTHING;

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('V002', 'Create helper functions for data migration')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'V002: Helper functions created successfully';
  RAISE NOTICE 'Functions available:';
  RAISE NOTICE '  - extract_player_names_from_games()';
  RAISE NOTICE '  - count_total_turns_old_schema()';
  RAISE NOTICE '  - extract_turns_for_player()';
  RAISE NOTICE '  - safe_jsonb_int() / safe_jsonb_bool()';
  RAISE NOTICE '  - extract_dart_scores()';
  RAISE NOTICE 'Next step: Run V003 to migrate players';
END $$;
