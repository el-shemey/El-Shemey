import { PASSWORD_MAX_LENGTH } from "./policy";

/**
 * Argon2id password hashing (Phase 4).
 *
 * - Unique random salt per hash (handled by argon2).
 * - OWASP-aligned work factors.
 * - Raw passwords are never stored or logged anywhere.
 *
 * The native module is loaded lazily: this module sits in the server-action
 * import graph, and static inclusion would force bundlers to resolve
 * argon2's (empty) browser entrypoint for edge/client graphs.
 */

const ARGON_OPTS = {
  memory: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

/** Max length aligned with bcrypt-compatible limits and abuse resistance. */
export { PASSWORD_MAX_LENGTH };

async function loadArgon() {
  return import("@node-rs/argon2");
}

export async function hashPassword(password: string): Promise<string> {
  const { hash } = await loadArgon();
  return hash(password, ARGON_OPTS);
}

/** Constant-time verification inside the native binding. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    const { verify } = await loadArgon();
    return await verify(hash, password);
  } catch {
    // Malformed hash stored — treat as failed credential, never throw details.
    return false;
  }
}
