/* Shared by the native app and offline browser preview. No network or storage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StudentExchangeAuth = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEMO_EMAIL = 'demo@studentexchange.test';
  const DEMO_PASSWORD = 'CampusDemo!23';
  function normalizeEmail(email) { return email.trim().toLowerCase(); }
  function validate(email, password) {
    const errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email)))
      errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Enter your password.';
    return errors;
  }
  function demoSignIn(email, password) {
    const errors = validate(email, password);
    if (Object.keys(errors).length) return { ok: false, errors };
    if (normalizeEmail(email) !== DEMO_EMAIL || password !== DEMO_PASSWORD)
      return { ok: false, errors: { form: 'This prototype accepts only the sample account. Use “Fill demo account” or “Explore the demo”.' } };
    return { ok: true, user: { name: 'Alex', email: DEMO_EMAIL } };
  }
  return { DEMO_EMAIL, DEMO_PASSWORD, normalizeEmail, validate, demoSignIn };
});
