// The local secret files under ~/.seams: one folder per backend lane.
// ~/.seams/README.md describes the layout; the former flat file names are links to these files.
import { homedir } from 'node:os';
import { join } from 'node:path';

const LANES = new Set(['staging-testnet', 'production-testnet', 'production-mainnet']);
const LANE_BY_ENVIRONMENT_PREFIX = Object.freeze({
  staging: 'staging-testnet',
  'production-testnet': 'production-testnet',
  production: 'production-mainnet',
});

export function localSecretsRoot() {
  return join(homedir(), '.seams');
}

function laneFolder(laneId) {
  if (!LANES.has(laneId)) throw new Error(`No local secrets folder for lane ${laneId}`);
  return join(localSecretsRoot(), laneId);
}

/** Gateway, Router A/B, Wallet Runtime and control-plane values of one lane. */
export function localWalletSystemValuesFile(laneId) {
  return join(laneFolder(laneId), 'wallet-system.env');
}

/** Console values of one lane. */
export function localConsoleValuesFile(laneId) {
  return join(laneFolder(laneId), 'console.env');
}

/** The lane of a GitHub environment prefix (`staging`, `production-testnet`, `production`). */
export function laneForEnvironmentPrefix(prefix) {
  const lane = LANE_BY_ENVIRONMENT_PREFIX[prefix];
  if (!lane) throw new Error(`No lane for environment prefix ${prefix}`);
  return lane;
}
