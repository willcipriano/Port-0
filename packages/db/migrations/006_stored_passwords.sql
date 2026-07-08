-- Player-stored cracked passwords (Password Vault)

CREATE TABLE account_stored_passwords (
  account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_ipv6  TEXT NOT NULL,
  password     TEXT NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, target_ipv6)
);

CREATE INDEX account_stored_passwords_account_updated_idx
  ON account_stored_passwords (account_id, last_updated DESC);
