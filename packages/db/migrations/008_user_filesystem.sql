-- Player rig filesystem (separate from machines.filesystem JSONB)

CREATE TABLE IF NOT EXISTS user_fs_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES user_fs_nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('directory', 'file')),
  category TEXT NOT NULL CHECK (category IN (
    'tool', 'loot', 'qrypted', 'credential', 'intel', 'contract',
    'log', 'module', 'archive', 'trash'
  )),
  size_qgb INTEGER NOT NULL DEFAULT 0 CHECK (size_qgb >= 0),
  value_credits INTEGER NOT NULL DEFAULT 0 CHECK (value_credits >= 0),
  heat TEXT NOT NULL DEFAULT 'cold' CHECK (heat IN (
    'cold', 'warm', 'hot', 'burned', 'collapsed'
  )),
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN (
    'ok', 'installed', 'in_custody', 'sealed', 'hot', 'laundered',
    'corrupted', 'burned', 'collapsed', 'deleted'
  )),
  tool_id TEXT,
  origin_ipv6 TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  protected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, path),
  CHECK (
    (node_type = 'directory' AND size_qgb = 0)
    OR (node_type = 'file')
  ),
  CHECK (name <> '' AND name NOT LIKE '%/%' AND name NOT LIKE '%\\%'),
  CHECK (path ~ '^(/[^/]+)+$')
);

CREATE INDEX IF NOT EXISTS user_fs_nodes_account_id_idx ON user_fs_nodes (account_id);
CREATE INDEX IF NOT EXISTS user_fs_nodes_account_parent_idx ON user_fs_nodes (account_id, parent_id);
CREATE INDEX IF NOT EXISTS user_fs_nodes_account_tool_idx
  ON user_fs_nodes (account_id, tool_id)
  WHERE tool_id IS NOT NULL AND category = 'tool';

-- Align rig storage with QGB capacity used by the filesystem (starter tools need ~144 QGB).
UPDATE rigs SET storage = 1000 WHERE storage < 1000;
