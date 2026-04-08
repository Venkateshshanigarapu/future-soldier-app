-- Zone membership tracking for breach/return detection
-- Tracks last known state per (user_id, zone_id) to detect transitions

CREATE TABLE IF NOT EXISTS zone_membership (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone_id INTEGER NOT NULL,
    last_state VARCHAR(20) NOT NULL DEFAULT 'unknown', -- 'inside', 'outside', 'unknown'
    last_event_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_push_at TIMESTAMP,
    last_state_change_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one record per user-zone pair
    UNIQUE(user_id, zone_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_zone_membership_user_id ON zone_membership(user_id);
CREATE INDEX IF NOT EXISTS idx_zone_membership_zone_id ON zone_membership(zone_id);
CREATE INDEX IF NOT EXISTS idx_zone_membership_last_state ON zone_membership(last_state);
CREATE INDEX IF NOT EXISTS idx_zone_membership_last_event_at ON zone_membership(last_event_at);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_zone_membership_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_zone_membership_updated_at ON zone_membership;
CREATE TRIGGER trigger_zone_membership_updated_at
    BEFORE UPDATE ON zone_membership
    FOR EACH ROW
    EXECUTE FUNCTION update_zone_membership_updated_at();
