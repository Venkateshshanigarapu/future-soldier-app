-- Migration script to add read status columns to alerts table
-- Run this script to update existing alerts table

-- Add read status columns to alerts table
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS read_by INTEGER REFERENCES users(id);

-- Create index for read status queries
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);
CREATE INDEX IF NOT EXISTS idx_alerts_read_by ON alerts(read_by);

