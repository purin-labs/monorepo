-- The maximum Wallet Session budget that the tenant sets for one environment:
-- {"maxTtlMs":…,"maxRemainingUses":…}. NULL means that the tenant set none,
-- and the wallet gateway uses its defaults.
ALTER TABLE environments ADD COLUMN wallet_session_limits_json TEXT
  CHECK (wallet_session_limits_json IS NULL OR json_valid(wallet_session_limits_json));
