-- Initialize AdStrategist Database for PostgreSQL 17
-- This script runs when the PostgreSQL container starts for the first time

-- Grant privileges to the user
GRANT ALL PRIVILEGES ON DATABASE adstrategist TO adstrategist_user;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PostgreSQL 17 has built-in gen_random_uuid(), but ensure compatibility
DO $$
BEGIN
    -- Check if gen_random_uuid() function exists, if not create it
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid') THEN
        CREATE OR REPLACE FUNCTION gen_random_uuid() RETURNS uuid AS $$
        BEGIN
            RETURN uuid_generate_v4();
        END;
        $$ LANGUAGE plpgsql;
    END IF;
END
$$;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO adstrategist_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO adstrategist_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO adstrategist_user;

-- Optimize PostgreSQL 17 settings for performance
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET log_min_duration_statement = 1000;