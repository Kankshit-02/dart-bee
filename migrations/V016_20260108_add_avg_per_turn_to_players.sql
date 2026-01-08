-- ============================================================================
-- Migration V016: Add avg_per_turn to players table
-- Created: 2026-01-08
-- Description: Adds total_turns tracking and avg_per_turn calculated column
--              to players table for proper "average per turn" statistics
-- ============================================================================

-- Step 1: Add total_turns column to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS total_turns INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN players.total_turns IS 'Total number of turns played across all games';

-- Step 2: Populate total_turns from game_players
UPDATE players p
SET total_turns = COALESCE(stats.total_turns, 0)
FROM (
  SELECT
    gp.player_id,
    SUM(gp.total_turns) as total_turns
  FROM game_players gp
  GROUP BY gp.player_id
) stats
WHERE p.id = stats.player_id;

-- Step 3: Add avg_per_turn as a generated column
ALTER TABLE players
ADD COLUMN IF NOT EXISTS avg_per_turn NUMERIC(6,2)
GENERATED ALWAYS AS (
  CASE
    WHEN total_turns = 0 THEN 0
    ELSE ROUND(total_score::NUMERIC / total_turns, 2)
  END
) STORED;

COMMENT ON COLUMN players.avg_per_turn IS 'Average score per turn (total_score / total_turns)';

-- Step 4: Update the trigger to also update total_turns
CREATE OR REPLACE FUNCTION update_player_aggregates_from_game()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if game is being marked as completed
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR OLD IS NULL) THEN
    -- Update all players in this game
    UPDATE players p
    SET
      total_games_played = p.total_games_played + 1,
      total_games_won = p.total_games_won + CASE WHEN gp.is_winner THEN 1 ELSE 0 END,
      total_turns = p.total_turns + gp.total_turns,
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

-- Step 5: Drop and recreate the materialized view to include avg_per_turn
DROP MATERIALIZED VIEW IF EXISTS player_leaderboard CASCADE;

CREATE MATERIALIZED VIEW player_leaderboard AS
SELECT
  p.id,
  p.name,
  p.created_at,
  p.total_games_played,
  p.total_games_won,
  p.win_rate,
  p.total_turns,
  p.total_darts_thrown,
  p.total_score,
  p.avg_per_turn,
  p.avg_per_dart,
  p.total_180s,
  p.total_140_plus,
  p.max_dart_score,
  p.max_turn_score,
  p.total_checkout_attempts,
  p.total_checkout_successes,
  p.checkout_percentage,
  p.best_checkout,
  -- Ranking columns for different metrics
  ROW_NUMBER() OVER (ORDER BY p.total_games_won DESC, p.win_rate DESC, p.total_games_played DESC) as rank_by_wins,
  ROW_NUMBER() OVER (ORDER BY p.win_rate DESC, p.total_games_played DESC) as rank_by_win_rate,
  ROW_NUMBER() OVER (ORDER BY p.avg_per_turn DESC, p.total_turns DESC) as rank_by_avg,
  ROW_NUMBER() OVER (ORDER BY p.total_180s DESC, p.total_darts_thrown DESC) as rank_by_180s,
  ROW_NUMBER() OVER (ORDER BY p.checkout_percentage DESC, p.total_checkout_attempts DESC) as rank_by_checkout,
  p.updated_at
FROM players p
WHERE p.total_games_played > 0;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_player_leaderboard_id ON player_leaderboard(id);

-- Create indexes on ranking columns
CREATE INDEX idx_leaderboard_rank_wins ON player_leaderboard(rank_by_wins);
CREATE INDEX idx_leaderboard_rank_win_rate ON player_leaderboard(rank_by_win_rate);
CREATE INDEX idx_leaderboard_rank_avg ON player_leaderboard(rank_by_avg);
CREATE INDEX idx_leaderboard_rank_180s ON player_leaderboard(rank_by_180s);

COMMENT ON MATERIALIZED VIEW player_leaderboard IS 'Pre-computed leaderboard rankings for all metrics (now includes avg_per_turn)';

-- Step 6: Refresh the materialized view
REFRESH MATERIALIZED VIEW player_leaderboard;

-- Verification
DO $$
DECLARE
  players_count INTEGER;
  total_turns_sum BIGINT;
BEGIN
  SELECT COUNT(*), SUM(total_turns)
  INTO players_count, total_turns_sum
  FROM players
  WHERE total_games_played > 0;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'V016: avg_per_turn added to players';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Players with games: %', players_count;
  RAISE NOTICE 'Total turns tracked: %', total_turns_sum;
  RAISE NOTICE '✓ Added total_turns column';
  RAISE NOTICE '✓ Added avg_per_turn generated column';
  RAISE NOTICE '✓ Updated trigger function';
  RAISE NOTICE '✓ Recreated materialized view';
  RAISE NOTICE '========================================';
END $$;
