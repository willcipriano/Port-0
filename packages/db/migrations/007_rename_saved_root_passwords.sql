-- Rename vault table to clarify root credentials (future types get separate tables)

ALTER TABLE account_stored_passwords RENAME TO account_saved_root_passwords;

ALTER INDEX account_stored_passwords_account_updated_idx
  RENAME TO account_saved_root_passwords_account_updated_idx;
