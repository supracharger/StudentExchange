# Implementation

- `mobile/App.js`: Expo startup, welcome and sample-account login. The archive contains the original SDK 54 starter. Replace `mobile/` with the source and lockfile from the locally tested iPhone version before committing.
- `web/dist/app.mjs` and `model.mjs`: local web marketplace, basic text search, category/price/condition filters, favorites, posting with photos, and practice messages. Marketplace records stay in the browser.
- `scripts/backend-bridge.mjs`: optional Node bridge for school lookup and account operations. The shared application credential remains on the server. See [Backend integration](BACKEND_INTEGRATION.md).
- `tests/backend-bridge.test.mjs`: HTTP tests with a simulated upstream. Live accounts need staging verification.
- Purchase requests, barter offers, cross-device listings and messaging, and ranked or typo-tolerant search remain future work.
