-- Stage 3: hack sessions support

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS security_components JSONB,
  ADD COLUMN IF NOT EXISTS faction TEXT NOT NULL DEFAULT 'shady',
  ADD COLUMN IF NOT EXISTS filesystem JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS alarm_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS offense_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS rig_tools (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, tool_id)
);

CREATE INDEX IF NOT EXISTS rig_tools_account_id_idx ON rig_tools(account_id);

CREATE TABLE IF NOT EXISTS rig_loot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  loot_type TEXT NOT NULL CHECK (loot_type IN ('data', 'credentials', 'source_code')),
  label TEXT NOT NULL,
  source_ipv6 TEXT,
  exfiled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rig_loot_account_id_idx ON rig_loot(account_id);
