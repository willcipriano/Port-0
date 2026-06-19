-- Port 0 initial schema (Stage 1)

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oauth_provider TEXT NOT NULL,
  oauth_sub TEXT NOT NULL,
  display_handle TEXT,
  crypto_balance INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hospital', 'prison')),
  status_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (oauth_provider, oauth_sub)
);

CREATE TABLE rigs (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  cpu INTEGER NOT NULL,
  ram INTEGER NOT NULL,
  storage INTEGER NOT NULL,
  bandwidth INTEGER NOT NULL,
  cyberware JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX auth_sessions_account_id_idx ON auth_sessions(account_id);

CREATE TABLE machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ipv6 TEXT NOT NULL UNIQUE,
  os_archetype_id TEXT NOT NULL,
  is_landmark BOOLEAN NOT NULL DEFAULT false,
  landmark_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE machine_ownership (
  machine_id UUID PRIMARY KEY REFERENCES machines(id) ON DELETE CASCADE,
  owner_account_id UUID NOT NULL REFERENCES accounts(id),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX machine_ownership_owner_account_id_idx ON machine_ownership(owner_account_id);

CREATE TABLE fleet_membership (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  PRIMARY KEY (account_id, machine_id)
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  account_id UUID REFERENCES accounts(id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_log_account_id_idx ON audit_log(account_id);
CREATE INDEX audit_log_event_type_idx ON audit_log(event_type);

CREATE TABLE world_subnets (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  ipv6_prefix TEXT NOT NULL,
  theme TEXT NOT NULL,
  machine_count INTEGER NOT NULL,
  landmark_count INTEGER NOT NULL,
  heat_level INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE market_catalog (
  tool_id TEXT PRIMARY KEY,
  price INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE world_ticks (
  tick_id BIGINT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);
