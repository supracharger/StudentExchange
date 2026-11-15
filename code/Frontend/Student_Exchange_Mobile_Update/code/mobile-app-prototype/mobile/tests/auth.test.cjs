const { test } = require('node:test');
const assert = require('node:assert/strict');
const auth = require('../src/auth.cjs');
test('empty and malformed inputs produce field errors', () => {
  assert.deepEqual(Object.keys(auth.validate('', '')), ['email', 'password']);
  for (const email of ['a@b', 'a b@campus.edu', 'x@@campus.edu'])
    assert.equal(auth.demoSignIn(email, 'anything').ok, false);
});
test('only the designated sample account signs in', () => {
  assert.equal(auth.demoSignIn(auth.DEMO_EMAIL, auth.DEMO_PASSWORD).ok, true);
  assert.equal(auth.demoSignIn(' '+auth.DEMO_EMAIL.toUpperCase()+' ', auth.DEMO_PASSWORD).ok, true);
  assert.equal(auth.demoSignIn('real@campus.edu', auth.DEMO_PASSWORD).ok, false);
  assert.equal(auth.demoSignIn(auth.DEMO_EMAIL, 'wrong').ok, false);
});
test('password is exact and never normalized', () => {
  assert.equal(auth.demoSignIn(auth.DEMO_EMAIL, ' '+auth.DEMO_PASSWORD).ok, false);
});
