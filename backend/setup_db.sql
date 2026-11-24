-- Run this file as the PostgreSQL superuser (postgres) to set up
-- the speech_to_text application database and user.
--
-- HOW TO RUN:
--   Option A (pgAdmin): Open Query Tool → paste and execute
--   Option B (psql CLI):
--     psql -U postgres -h localhost -f setup_db.sql

-- Create the application role if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'speech_user') THEN
    CREATE ROLE speech_user LOGIN PASSWORD 'speech_password';
    RAISE NOTICE 'Role speech_user created.';
  ELSE
    -- Update the password in case it was set differently
    ALTER ROLE speech_user WITH LOGIN PASSWORD 'speech_password';
    RAISE NOTICE 'Role speech_user already exists – password updated.';
  END IF;
END
$$;

-- Create the database if it doesn't already exist
SELECT 'CREATE DATABASE speech_db OWNER speech_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'speech_db')\gexec

-- Grant all privileges on the database to the user
GRANT ALL PRIVILEGES ON DATABASE speech_db TO speech_user;

\echo '-------------------------------------------'
\echo 'Database setup complete.'
\echo 'User:     speech_user'
\echo 'Password: speech_password'
\echo 'Database: speech_db'
\echo '-------------------------------------------'
