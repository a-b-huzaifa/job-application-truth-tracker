-- 002_strategist_actions.sql: Table for persisting candidate strategist decision records

CREATE TABLE IF NOT EXISTS strategist_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(64) NOT NULL CHECK (action_type IN ('REWRITE_SUGGESTED', 'APPLY_WITH_CAVEAT', 'SKIP_ROLE_RECOMMENDED')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    applied BOOLEAN NOT NULL DEFAULT FALSE,
    applied_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategist_actions_app_id ON strategist_actions(application_id);
CREATE INDEX IF NOT EXISTS idx_strategist_actions_user_id ON strategist_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_strategist_actions_status ON strategist_actions(status);
