import "server-only";
import { hashPassword } from "./hash";

export { hashPassword, verifyPassword, needsRehash, passwordPolicyError } from "./hash";

/** A valid hash used to equalise timing when the user does not exist. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash() {
  dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
  return dummyHash;
}
