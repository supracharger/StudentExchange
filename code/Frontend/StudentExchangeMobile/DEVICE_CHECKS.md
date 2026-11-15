# Device checks

These are manual checks to run on an emulator or device. They have not been executed in the socket-restricted build environment.

1. Install and open the APK on Android API 26 or newer. Verify onboarding artwork, wordmark, readable text, Continue, Skip, and Log in.
2. Create an account. Check invalid email, short password, empty name, duplicate address, and reserved demo address. Rotate during a form and check entered text is retained. Log out and log in with the new account.
3. Autofill the demo account on Login. Check show/hide password and the offline recovery explanation. Explore as a guest.
4. On Explore, inspect headphones and book artwork, product cards, categories, and all five navigation targets on a narrow phone and a tablet. Increase the system font size and check scrolling remains usable.
5. Search for headphones and a term with no matches. Apply and reset category, maximum price, and used-only filters. Reject negative and malformed prices without closing the filter dialog.
6. Open each product. Check price, artwork, title, condition, campus, and description. Save/unsave; check Saved, force-close the app, reopen, and confirm persistence.
7. As a guest, try to post and message a seller. Confirm login is required. As a signed-in user, post with invalid then valid fields, choose each sample illustration, and choose a personal photo. Verify preview, detail display, and photo access after an app restart. Cancel the picker and confirm the form remains intact.
8. Open your own listing from Account and remove it. Confirm cancellation preserves it and confirmation removes it from Explore and Saved.
9. Send an empty then valid message from a sample listing. Confirm validation and the Inbox entry, timestamp, and listing link. Confirm the UI describes messages as local and never implies delivery.
10. Check back navigation, keyboard dismissal, orientation changes, logout, app restart, and onboarding replay. Check Android logcat for crashes during all flows.
