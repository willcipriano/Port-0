-- Stage 5: PvP sieges, fleet resources, intel, viruses

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS cpu INTEGER,
  ADD COLUMN IF NOT EXISTS ram INTEGER,
  ADD COLUMN IF NOT EXISTS storage INTEGER;

UPDATE machines SET cpu = 2, ram = 4, storage = 35
WHERE cpu IS NULL AND os_archetype_id = 'cheap_server';
UPDATE machines SET cpu = 3, ram = 6, storage = 75
WHERE cpu IS NULL AND os_archetype_id = 'generic_linux';
UPDATE machines SET cpu = 6, ram = 12, storage = 175
WHERE cpu IS NULL AND os_archetype_id = 'corp_workstation';
UPDATE machines SET cpu = 12, ram = 24, storage = 375
WHERE cpu IS NULL AND os_archetype_id = 'mainframe';
UPDATE machines SET cpu = 2, ram = 4, storage = 35
WHERE cpu IS NULL;

ALTER TABLE machines
  ALTER COLUMN cpu SET NOT NULL,
  ALTER COLUMN ram SET NOT NULL,
  ALTER COLUMN storage SET NOT NULL;

ALTER TABLE fleet_membership
  DROP CONSTRAINT IF EXISTS fleet_membership_role_check;

ALTER TABLE fleet_membership
  ADD CONSTRAINT fleet_membership_role_check
  CHECK (role IN ('owner', 'staging', 'passive_income', 'defensive'));

CREATE TABLE account_intel (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_ipv6 TEXT NOT NULL,
  owner_hint TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, target_ipv6)
);

CREATE INDEX account_intel_account_id_idx ON account_intel (account_id);

CREATE TABLE sieges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_ipv6 TEXT NOT NULL,
  target_machine_id UUID NOT NULL REFERENCES machines(id),
  attacker_account_id UUID NOT NULL REFERENCES accounts(id),
  defender_account_id UUID NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL DEFAULT 'interactive'
    CHECK (status IN ('declared', 'interactive', 'resolving', 'completed')),
  outcome TEXT CHECK (outcome IN ('attacker_win', 'defender_win', 'cancelled')),
  declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  interactive_window_ends_at TIMESTAMPTZ NOT NULL,
  resolve_at_tick BIGINT,
  committed_cpu INTEGER NOT NULL DEFAULT 0,
  committed_ram INTEGER NOT NULL DEFAULT 0,
  deployed_virus_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX sieges_status_idx ON sieges (status);
CREATE INDEX sieges_attacker_idx ON sieges (attacker_account_id);
CREATE INDEX sieges_defender_idx ON sieges (defender_account_id);
CREATE INDEX sieges_resolve_at_tick_idx ON sieges (resolve_at_tick) WHERE status = 'resolving';

CREATE TABLE virus_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  effect_type TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  uses_remaining INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX virus_inventory_account_id_idx ON virus_inventory (account_id);

CREATE TABLE virus_craft_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  effect_type TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finishes_at TIMESTAMPTZ NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX virus_craft_jobs_finishes_at_idx ON virus_craft_jobs (finishes_at) WHERE NOT completed;
