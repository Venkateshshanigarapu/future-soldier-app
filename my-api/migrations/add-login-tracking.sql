-- Migration: Add login tracking columns to users table
-- Run this in your PostgreSQL database

-- Add login tracking columns if they don't exist
DO $$ 
BEGIN
    -- Add last_login_attempt column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='last_login_attempt') THEN
        ALTER TABLE users ADD COLUMN last_login_attempt TIMESTAMP;
    END IF;

    -- Add last_login_success column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='last_login_success') THEN
        ALTER TABLE users ADD COLUMN last_login_success TIMESTAMP;
    END IF;

    -- Add login_attempts_count column (optional, for tracking failed attempts)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='login_attempts_count') THEN
        ALTER TABLE users ADD COLUMN login_attempts_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create index for faster queries on login tracking
CREATE INDEX IF NOT EXISTS idx_users_last_login_success ON users(last_login_success);
CREATE INDEX IF NOT EXISTS idx_users_last_login_attempt ON users(last_login_attempt);

-- Add comment to columns for documentation
COMMENT ON COLUMN users.last_login_attempt IS 'Timestamp of the last login attempt (successful or failed)';
COMMENT ON COLUMN users.last_login_success IS 'Timestamp of the last successful login';
COMMENT ON COLUMN users.login_attempts_count IS 'Counter for tracking failed login attempts';

