# Demo and test plan

1. From the project root, run `npm test` and `npm run check`.
2. Start the web demo with `npm run web` and open http://127.0.0.1:8080/. Choose **Explore without logging in**.
3. Search for a sample item and combine category, price and condition filters. Clear the filters to restore the feed.
4. Save an item and verify it appears under Saved. Post a demo listing with a photo, reload, and verify it remains in the same browser.
5. Open a sample listing and try messaging. Verify the practice message appears locally; it is not delivered to another account.
6. Run the locally upgraded Expo copy on iPhone and show the welcome and demo login screens. Attach a screenshot of the app itself to the PR.

For future staging acceptance, use two test accounts on separate devices: post a listing with a photo, find it with search and filters, send a message, and confirm that both users see the outcome of a purchase request or barter offer. These shared marketplace flows are not implemented in this package.
