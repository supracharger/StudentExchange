# Student Exchange mobile web prototype

Buildless HTML/CSS/JavaScript for iPhone Safari and Android Chrome. Run from the package root with `npm run web` for the local demo, or configure the Node server and use `npm run web:backend` for backend account login, registration, school selection and profile updates. See [../docs/BACKEND_INTEGRATION.md](../docs/BACKEND_INTEGRATION.md).

Account credentials are sent only through the backend-account forms. Demo marketplace listings, saves, photos and practice messages stay in browser localStorage; they do not sync with real users. The separate local demo profile remains distinct from the connected account.

Static hosting serves demo features but cannot execute the account bridge. New account integration is covered by simulated HTTP tests, not a live Azure or physical-phone test. The earlier demo had browser layout checks at 320px and 390px.
