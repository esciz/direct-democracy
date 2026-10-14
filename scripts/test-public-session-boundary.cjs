const assert = require('node:assert/strict');
const Module = require('node:module');
Object.assign(process.env, { NODE_ENV: 'test', NEXT_PUBLIC_ENABLE_DEMO_MODE: 'false' });
const originalLoad = Module._load;
let verificationCookieReads = 0;
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') return {};
  if (request === 'next/headers') return { cookies: async () => ({ get(name) {
    if (name === 'dd_session_user') return { value: '__public__' };
    if (name === 'dd_user_verification_state') { verificationCookieReads++; return { value: JSON.stringify({ user_guest_browse: 'voterVerified', identity_fixture: 'voterVerified' }) }; }
    return undefined;
  } }) };
  return originalLoad.call(this, request, parent, isMain);
};
async function main() {
  const { getCurrentUser } = require('../lib/server/auth-session.ts');
  const { resolveUserVerification } = require('../lib/server/auth-verification.ts');
  const { canUserVote } = require('../lib/auth/guards.ts');
  const guest = await getCurrentUser();
  assert.equal(guest.id, 'user_guest_browse');
  assert.equal(canUserVote(guest), false, 'Anonymous voting cannot inherit a verified demo identity');
  const account = { ...guest, id: 'identity_fixture', isAnonymousPublic: false };
  const checked = await resolveUserVerification(account);
  assert.equal(checked.verificationState, 'unverified');
  assert.equal(canUserVote(checked), false, 'An unsigned verification cookie cannot promote a real account');
  assert.equal(verificationCookieReads, 0, 'Production must not consult demo verification overrides');
  console.log('Public session boundary passed: guest stays unverified and forged demo verification cannot grant production voting access.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = originalLoad; });
