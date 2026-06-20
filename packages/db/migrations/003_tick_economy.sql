-- Stage 4: tick economy (scans, ledger, sync summaries)

CREATE TABLE scan_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subnet_id TEXT NOT NULL REFERENCES world_subnets(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'complete', 'cancelled')),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolves_at_tick BIGINT NOT NULL,
  completed_at TIMESTAMPTZ,
  results JSONB
);

CREATE INDEX scan_queue_resolves_at_tick_idx ON scan_queue (resolves_at_tick) WHERE status = 'queued';
CREATE INDEX scan_queue_account_id_idx ON scan_queue (account_id);

CREATE UNIQUE INDEX scan_queue_one_active_per_account_idx
  ON scan_queue (account_id)
  WHERE status = 'queued';

CREATE TABLE account_discovered_machines (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, machine_id)
);

CREATE TABLE economy_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  tick_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX economy_transactions_account_id_idx ON economy_transactions (account_id);
CREATE INDEX economy_transactions_tick_id_idx ON economy_transactions (tick_id);

CREATE TABLE account_tick_summaries (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tick_id BIGINT NOT NULL,
  summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, tick_id)
);

CREATE INDEX account_tick_summaries_tick_id_idx ON account_tick_summaries (tick_id);
