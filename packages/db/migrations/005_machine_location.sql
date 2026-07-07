-- Add physical geographic coordinates to machines (Stage 6 world map)
-- These are independent of IPv6 / subnet address (cyberspace location).

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
