# Android local integration checks

Source contracts, limits, and live-deployment requirements are in
[BACKEND_INTEGRATION_STATUS.md](BACKEND_INTEGRATION_STATUS.md).

1. Start the local mock adapter in a terminal:

   ```sh
   cd development-adapter
   npm start
   ```

2. Run adapter tests from another terminal:

   ```sh
   cd development-adapter
   npm test
   ```

3. From the Android project root, build and run available checks:

   ```sh
   ./gradlew --offline --no-configuration-cache assembleDebug test lintDebug
   ```

   If lint dependencies have never been cached, run `./gradlew --no-configuration-cache lintDebug`
   with dependency-repository access, then repeat offline. Android currently has
   no JVM unit-test source files. Node tests verify adapter contracts.

4. Start an Android Emulator (API 26+) and install:

   ```sh
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

   Debug network policy permits cleartext only for emulator host `10.0.2.2`.
   Android and adapter transports reject external backend destinations. A physical
   device needs a separately reviewed local connection setup; LAN access is not enabled.

5. Test with `demo@mock.invalid` or `seller@mock.invalid`, password `CampusDemo123!`.
   The login screen has fill buttons. Mock school is `Mock University`.
   Accounts from the old device-local prototype do not authenticate server sessions.

6. Run the smoke script for `emulator-5554`, with the mock adapter running:

   ```sh
   python3 tools/check-local-emulator.py
   ```

   The script uses UI Automator/ADB to check marketplace categories/detail,
   mock login, posting, messaging, profile navigation and logout. It creates one
   in-memory mock listing/conversation; it does not clear existing app saved finds.
   Display size/keyboard differences may require manual checks instead.

7. Manually verify registration/duplicate-account errors; profile edits and location;
   image picking, upload, gallery and removal; own-listing edits/sold/renew/delete;
   seller replies and unread counts; offers; multiple message pages; rotation;
   app/adapter restart; server unavailable/retry; logout. Saved IDs remain on-device,
   while restarting the mock resets its listing IDs and data.

Sessions and cookies are not persisted across process restarts. The mock contains
no real students or production data. No live backend request is permitted in this setup.

The HTTPS `connected` build is separate from the default emulator build. See
[ADAPTER_DEPLOYMENT.md](ADAPTER_DEPLOYMENT.md) before setting `SE_ADAPTER_URL`.
Backend credentials are server runtime inputs only. Building a connected APK does
not itself authorize deployment or production traffic.
