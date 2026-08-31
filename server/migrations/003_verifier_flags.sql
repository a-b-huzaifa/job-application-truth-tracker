-- 003_verifier_flags.sql: Table for persisting historical verifier audit flags per resume variant

CREATE TABLE IF NOT EXISTS verifier_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    claim_text TEXT NOT NULL,
    flag_type VARCHAR(32) NOT NULL CHECK (flag_type IN ('unsupported', 'phrasing_risk')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifier_flags_resume_id ON verifier_flags(resume_id);
CREATE INDEX IF NOT EXISTS idx_verifier_flags_resume_flag_type ON verifier_flags(resume_id, flag_type);
