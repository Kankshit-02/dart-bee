#!/bin/bash

# Database Migration Script for Dart Bee
# This script will:
# 1. Take a backup of your database
# 2. Run all migrations in sequence
# 3. Verify the migration

set -e  # Exit on any error

echo "=========================================="
echo "Dart Bee Database Migration Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Supabase project details
PROJECT_URL="https://hdiesaupdtjtazkxtylt.supabase.co"
PROJECT_REF="hdiesaupdtjtazkxtylt"

echo "Project URL: $PROJECT_URL"
echo ""

# Check if database password is provided
if [ -z "$DB_PASSWORD" ]; then
    echo -e "${YELLOW}Database password not found in environment.${NC}"
    echo ""
    echo "To get your database password:"
    echo "1. Go to https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
    echo "2. Look for 'Database Password' section"
    echo "3. Click 'Reset Database Password' if you don't have it"
    echo ""
    read -sp "Enter your database password: " DB_PASSWORD
    echo ""
fi

# Database connection details
DB_HOST="db.$PROJECT_REF.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

# Build connection string
export PGPASSWORD="$DB_PASSWORD"
DB_CONNECTION="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

echo ""
echo -e "${YELLOW}Step 1: Testing database connection...${NC}"

# Test connection
if psql "$DB_CONNECTION" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
    echo "Please check your password and try again."
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Creating backup...${NC}"

# Create backup directory
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Backup filename with timestamp
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

# Create backup (only the games and players tables)
echo "Creating backup at: $BACKUP_FILE"
pg_dump "$DB_CONNECTION" \
    --table=games \
    --table=players \
    --data-only \
    --inserts \
    > "$BACKUP_FILE" 2>/dev/null || {
    echo -e "${YELLOW}Note: Tables may not exist yet (first time setup)${NC}"
}

if [ -s "$BACKUP_FILE" ]; then
    echo -e "${GREEN}✓ Backup created: $BACKUP_FILE ($(wc -l < "$BACKUP_FILE") lines)${NC}"
else
    echo -e "${YELLOW}⚠ Backup file is empty (database may be empty or tables don't exist yet)${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Running migrations...${NC}"
echo ""

# Array of migration files in order
MIGRATIONS=(
    "V001_20260106_create_base_schema.sql"
    "V002_20260106_create_helper_functions.sql"
    "V003_20260106_migrate_players.sql"
    "V004_20260106_migrate_games.sql"
    "V005_20260106_migrate_game_players.sql"
    "V006_20260106_migrate_turns.sql"
    "V007_20260106_update_aggregates.sql"
    "V008_20260106_create_indexes.sql"
    "V009_20260106_add_constraints.sql"
    "V010_20260106_create_triggers.sql"
    "V011_20260106_verify_migration.sql"
    "V012_20260106_create_materialized_views.sql"
    "V013_20260106_cleanup_old_schema.sql"
)

# Run each migration
for migration in "${MIGRATIONS[@]}"; do
    if [ ! -f "$migration" ]; then
        echo -e "${RED}✗ Migration file not found: $migration${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Running: $migration${NC}"

    if psql "$DB_CONNECTION" -f "$migration" 2>&1 | tee /tmp/migration_output.log; then
        echo -e "${GREEN}✓ Completed: $migration${NC}"
    else
        echo -e "${RED}✗ Failed: $migration${NC}"
        echo ""
        echo "Migration failed! Please check the error above."
        echo ""
        echo "To rollback:"
        echo "1. Restore from backup: psql '$DB_CONNECTION' < '$BACKUP_FILE'"
        echo "2. Or manually run rollback commands from V013 migration"
        exit 1
    fi
    echo ""
done

echo ""
echo -e "${GREEN}=========================================="
echo "✓ All migrations completed successfully!"
echo "==========================================${NC}"
echo ""

echo "Next steps:"
echo "1. Test the application with the new schema"
echo "2. Monitor query performance in Supabase dashboard"
echo "3. After 30 days, run cleanup to drop backup tables:"
echo "   psql '$DB_CONNECTION' -c 'DROP TABLE IF EXISTS games_backup_20260106 CASCADE;'"
echo ""
echo "Backup saved at: $BACKUP_FILE"
echo ""

# Unset password
unset PGPASSWORD
