# VentureAdda — next round

Paste everything below the line into Claude Code.

---

## Done, don't redo

- Item 1 (permissions blocker) — root cause was a failed Vercel deploy, not rules. Fixed, deployed, verified.
- Item 2 (optional photos) — form, VentureCard, Moderator row, PhotoGallery all handle zero photos. Verified live: submitted a real venture with one item and zero photos, landed in the pending queue.
- Hero image capped at `max-h-[60vh]`, side-by-side with details from `lg`. Verified live.
- Duplicate-adjacent-photo bug fixed at the cause — categories now sort by name before lead photos are assigned, so the assignment is against a fixed order instead of Firestore's arbitrary document order.
- Demo data re-seeded under the new photo assignment. 14 ventures, 42 items, confirmed live.
- Paste-a-list and voice input for menu items — MenuImport now covers Scan photo, Paste list, and Speak, all through the same draft rows and validation. Found and fixed a real thousands-separator bug (`Rs. 1,200` parsed as price `1`, description `200`) via manual testing, then pinned it with tests. Voice input verified live on a real phone/mic: spoken items parsed into correct names and prices.

---

## Done, don't redo (this round)

- Sidebar/TopBar build break — resolved by committing the rest of the uncommitted logo work alongside the syntax fix, so `Logo` module and the `AppShell` `user: Profile | null` prop are no longer dangling. Deploy `28678c8` ("Ship logo work, paste-list column-shift fix, and Scan Photo size...") is live and green — confirmed in the Vercel dashboard, not just page-load.
- Logos shipped in this deploy. Not yet visually verified live — check the wordmark renders correctly (sidebar, top bar, favicon) and per-venture logo field works, same pass as the two bugs below.

---

## 1. BLOCKER — paste-list still fails on real input: 24/24 items, no price

The `Kurkure Masala Munch — ₹23` case you pinned passed, but the actual list a real owner pastes looks like this (exact text, tested live on `28678c8`):

```
SNACKS

* Kurkure Masala Munch — ₹23
* Lays — ₹23
* Uncle Chips — ₹23
* Lotte Choco Pie — ₹15

INSTANT MEALS

* Maggi Cup Noodles Chilly — ₹60
* Maggi Cup Noodles Masala — ₹60
* Maggi Masala Noodles — ₹40
* Wai Wai Cup Noodles — ₹60

PROTEIN BITES

* RiteBite Max Protein Grain Cookies 55g — ₹50
* RiteBite Max Protein Choco Almond Cookies 60g — ₹65
* RiteBite Max Protein Cheese & Jalapeno Chips 60g — ₹50
* RiteBite Max Protein Cream & Onion 60g — ₹50
* RiteBite Max Protein Peri Peri 60g — ₹50

DRINKS

* Water Bottle 1 L — ₹15
* Diet Coke — ₹55
* Monster Energy Drink — ₹115
* Red Bull — ₹115

BOYS HOSTEL ROOM NO. 311
GIRLS HOSTEL ROOM NO. 211
YOUR NEW CAMPUS CRAVING IS COMING
```

Result: "Added 24 items. 24 had no price I could read — fill those in." 24 is every line (4 category headers + 17 real items + 3 footer lines) — meaning the 17 real items with clean `Name — ₹NN` pricing failed too, not just the headers/footer that are correctly supposed to fail.

The one difference from your pinned test case: every real line here starts with `* ` (markdown bullet). Strong suspicion, not confirmed — the trailing-em-dash-price detection is anchored to the start of the line and the leading `* ` isn't being stripped before it runs, so it never matches. Confirm against the code before fixing, and add this exact block as a pinned test once you know why — a single-line fix that doesn't survive a real bulleted paste isn't done.

---

## 2. BLOCKER — Scan Photo hangs 5 minutes, then 504s

Different failure from before (that one failed fast at 1.9s on ECONNRESET — the 4MB fix for that is presumably fine, this is downstream of it). Real log, `28678c8`, today:

```
POST /api/extract-menu → 504
Vercel Runtime Timeout Error: Task timed out after 300 seconds
```

Matches what was reported live: the UI sits on "READING... READING" indefinitely — it's not a cosmetic stuck spinner, the function is actually hanging for the full 5 minutes before Vercel kills it. Most likely candidate: the outbound call to Groq has no timeout of its own and is hanging rather than erroring. Get the real cause from the code — same rule as always — before changing anything.

---

## 3. Logos — already shipped, see "Done" above; verify visually only

---

## 4. Sign out

Add a reachable **Sign out** action (profile menu). `/signin` redirects when already authenticated, so right now there's no way to switch accounts without clearing storage.

---

## 5. Small cleanup, low priority

No way to delete a pending or rejected venture from the UI — they accumulate forever. Add a delete button on pending/rejected rows in the owner's own listing view. Not urgent; the one live rejected test venture is fine to leave or delete by hand in the Firestore console.

---

## Still outstanding — mine, not yours

- Five Unsplash photos into `public/seed`: `repair.jpg`, `cycle.jpg`, `notes.jpg`, `camera.jpg`, `cables.jpg`.
- Glood's real venture details (items, prices, hours, WhatsApp number, photos) for the flagship listing.
- Three handset checks (bottom nav with 5 cells for moderator, chat composer height, landing shot at 390px) — blocked on window resize on both our ends.
- Cloudinary Admin API call to set `allowed_formats`/`max_file_size` on the upload preset — still client-side only.
- Delete the orphaned Cloudinary test asset from the failed early upload.

---

Before testing anything: confirm the deploy is GREEN in the Vercel dashboard, not just that the page loads. Both blockers above are on the current live deploy — get the real cause from the code before changing anything, same as always.
