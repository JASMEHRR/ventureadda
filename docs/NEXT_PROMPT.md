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

## Code-fixed, not yet live — verify before touching anything else

- **Item 1, paste-list column-shift** — root cause found: separator-less lines (`Kurkure Masala Munch — ₹23`) fell through to the spreadsheet path and the name swallowed the price. Fixed in `src/data/menuParse.ts`, pinned with your exact line plus a digits-in-name case and a bare-header case. All 21 real items now parse correctly.
- **Item 2, Scan Photo ECONNRESET** — root cause found: Groq caps base64 data-URL images at 4MB (the 20MB limit is for hosted URLs only); past that it resets the connection mid-write instead of returning an error, which matches the trace exactly. Both ceilings dropped to 4MB in `api/extract-menu.ts` (server) and `src/lib/extractMenu.ts` (client courtesy check). Flagged, not fixed: real phone photos are often 3–8MB so this will legitimately reject plenty of them — client-side compression is the likely next move if that bites in practice, don't build it speculatively yet.

Neither is verified live. Both need a real deploy and a real test against production, same bar as every round before this.

---

## 1. BLOCKER — commit e2d4499 failed on Vercel, real cause found

The syntax fix to Sidebar.tsx/TopBar.tsx built clean locally but failed on Vercel:

```
src/components/layout/AppShell.tsx(64,19): error TS2322: Type '{ user: Profile | null; }' is not assignable to type 'IntrinsicAttributes'.
src/components/layout/Sidebar.tsx(4,32): error TS2307: Cannot find module '../ui/Logo'.
src/components/layout/TopBar.tsx(5,18): error TS2307: Cannot find module '../ui/Logo'.
```

Cause: Sidebar.tsx and TopBar.tsx already had uncommitted logo-work edits in them (importing `../ui/Logo`, AppShell passing a `user: Profile | null` prop) from before this session. Committing only the syntax fix left those two files referencing a `Logo` component and a prop type that only exist in the uncommitted tree — built fine locally where those files were still on disk, dangling reference once pushed to a repo that doesn't have them.

Decision: commit everything now, including the rest of the logo work and whatever else was sitting uncommitted (Profile changes, etc.), so the repo is self-consistent. This means the logo work ships in the same deploy as paste-list and Scan Photo, untested. Once green, live verification covers all three — not just the two originally planned.

---

## 2. Logos

**a. VentureAdda wordmark.** Inline SVG, cyan on dark, geometric, legible at 16px. No external image, nothing AI-generated. Use it in the sidebar header, the landing page header, and as favicon/apple-touch-icon.

**b. Per-venture logo field.** Optional, separate from photos — small square shown on the card and beside the venture name. Falls back to an initial on a tinted circle, same pattern as user avatars.

---

## 3. Sign out

Add a reachable **Sign out** action (profile menu). `/signin` redirects when already authenticated, so right now there's no way to switch accounts without clearing storage.

---

## 4. Small cleanup, low priority

No way to delete a pending or rejected venture from the UI — they accumulate forever. Add a delete button on pending/rejected rows in the owner's own listing view. Not urgent; the one live rejected test venture is fine to leave or delete by hand in the Firestore console.

---

## Still outstanding — mine, not yours

- Five Unsplash photos into `public/seed`: `repair.jpg`, `cycle.jpg`, `notes.jpg`, `camera.jpg`, `cables.jpg`.
- Glood's real venture details (items, prices, hours, WhatsApp number, photos) for the flagship listing.
- Three handset checks (bottom nav with 5 cells for moderator, chat composer height, landing shot at 390px) — blocked on window resize on both our ends.
- Cloudinary Admin API call to set `allowed_formats`/`max_file_size` on the upload preset — still client-side only.
- Delete the orphaned Cloudinary test asset from the failed early upload.

---

Before testing anything: confirm the deploy is GREEN in the Vercel dashboard, not just that the page loads. Fix the Sidebar/TopBar build break first — it blocks everything else from being verifiable.
