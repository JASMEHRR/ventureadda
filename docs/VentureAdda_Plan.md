# VentureAdda — Build Plan

A directory and community site for the ventures started by people in your class. Instead of every venture spamming the WhatsApp group and buyers scrolling through hundreds of messages, everything lives in one place, sorted by category, with a shared chat for feedback.

Name: **VentureAdda**. Tagline: *Every venture on campus, one adda.*

---

## Part 1 — What this actually is, in plain language

Think of it like a mini Zomato crossed with a class noticeboard.

A buyer opens the link, browses ventures grouped into categories like Food, Fashion, Services. They tap into a venture and see its photos, opening hours, and full menu or catalogue with prices. They tap a specific item — say Chocolate Cake — and get asked "Want to message them on WhatsApp about Chocolate Cake?". They tap yes, WhatsApp opens with a message already written: *"Hi, I found you on VentureAdda and wanted to ask about your Chocolate Cake — is it available and what's the price?"*. They take it from there.

Alongside that there's an **All Chat** — one shared room where verified students post bugs, feature requests, and general feedback about the site. It's your free feedback channel and it makes the site feel alive rather than static.

Anyone with a Thapar email can sign up. Any signed-up user can optionally add their own venture from a button next to their profile icon, top right. Ventures go into a pending queue for you to approve before they appear.

Money never touches the site. Buyer and seller settle payment themselves — cash, UPI, whatever. That's what lets you launch this week instead of next term, because payment gateways need a registered business, PAN, and bank verification for every single seller.

### How you make money (later, not now)

Phase 1 is free for everyone. Your only job is getting ventures listed and buyers actually using the link. You cannot charge for a directory nobody visits.

When you do monetize, the plan is a **commission on reported sales**. Ventures tell you what sold through VentureAdda and you take a cut. The obvious weakness: it runs on trust and people will under-report. Your defence is the click counter — if a venture got 40 item-level inquiry taps and reports two sales, you have a real conversation to have. That's why lead tracking is in v1 even though you're not charging yet: you're collecting the evidence that makes the ask credible later.

Backups worth keeping in your pocket: paid featured listings (flat fee, cash, to sit at the top of a category) and sponsor slots. Both are simpler than commission because there's nothing to verify — but they only work once traffic exists.

---

## Part 2 — Accounts and login (read this carefully, it changed)

You described three separate login systems: username-only for users, Thapar email for chat access, and a separate email+password for ventures. **Building three is unnecessary and confusing.** This plan collapses them into one account:

**One account per person.** They sign up with their Thapar email. They pick a display username (what everyone sees in chat and on their venture). If they later want to list a venture, they just tap "Add Venture" — no second account, no second password. The venture is attached to the account they already have.

### How verification actually works

Typing `you@thapar.edu` into a box proves nothing — anyone can type anything. To genuinely verify, use **Firebase Authentication's email-link sign-in** (also called passwordless sign-in):

1. User enters their Thapar email.
2. The site checks the domain ends in `@thapar.edu` and rejects anything else.
3. Firebase emails them a sign-in link.
4. They click it, and they're logged in — proving they own that inbox.

No password to forget, no password to store, no Google Auth needed, and it's free on Firebase's free tier. When you add Google Auth later it slots in alongside this without breaking anything.

### What each type of person can do

| | Browse ventures | Post in All Chat | Own a venture |
|---|---|---|---|
| Not logged in | Yes | No (read-only) | No |
| Verified Thapar user | Yes | Yes | Yes, after your approval |
| You (moderator) | Yes | Yes, plus delete any message | Approve, edit, remove any venture |

Letting logged-out people browse and read chat matters — you want someone to be able to open a shared link and immediately see value, not hit a login wall. The wall only appears when they try to post or list.

---

## Part 3 — What gets built

### The customer side

**Home / browse.** Category sections, search bar, venture cards showing a photo, name, owner, short description, star rating. Top right: profile icon and an "Add Venture" button.

**Venture detail page.** Photo gallery, opening hours, full menu or catalogue with item names and prices, star rating, all reviews, and a form to leave your own rating.

**Item-level WhatsApp inquiry.** This is the core interaction, so it's worth spelling out. Each item in the menu has a tap target. Tapping it opens a small confirmation — *"Message [Venture] on WhatsApp about [Item]?"* — with Yes and Cancel. Yes opens WhatsApp (`wa.me` link) with a pre-written message naming the specific item and mentioning VentureAdda. Every tap increments that item's inquiry counter, so you know not just which ventures get interest, but which *products* do. That's genuinely useful data to hand back to venture owners.

**All Chat.** One shared room, newest messages at the bottom, showing username and timestamp. Verified users post; everyone can read. You can delete any message.

### The venture owner side

**Add Venture form** (from the top-right button): venture name, category, description, opening hours, photos, and a menu builder where they add items with names and prices. Submits to your pending queue.

**Edit their own venture** once it's live, without needing you.

### Your moderator side

Passcode or moderator-flagged account. Four tabs:

- **Pending** — new venture submissions to approve or reject.
- **Live listings** — edit or remove anything published; see click and inquiry counts.
- **Chat moderation** — delete messages, see reported ones.
- **Categories** — add or remove categories.

### Where the data lives

Firebase, free tier. Firestore for the database, Storage for photos, Authentication for login. When you approve a listing on your laptop it appears on everyone's phone instantly, no refresh.

Rough shape:

- **users** — Thapar email, display username, verified flag, moderator flag, join date.
- **ventures** — owner's user ID, name, category, description, opening hours, photo URLs, status (pending/live/rejected), click count, average rating.
- **menuItems** — which venture, item name, price, description, inquiry tap count.
- **reviews** — which venture, rating 1–5, comment, reviewer user ID, date.
- **chatMessages** — user ID, username, message text, timestamp, deleted flag.
- **categories** — list of category names you control.

Compress photos before upload so the free Storage quota lasts.

### What it's built with

**Match Ascend's stack**, so the design system ports over directly instead of being translated: React, Tailwind CSS v4 (CSS-first config via `@theme`, no `tailwind.config.js`), Framer Motion for animation, `lucide-react` for icons. All free and open source.

This is a change from the throwaway single-HTML-file prototype. A multi-page app with login, chat, and submission forms needs real components, and using the same stack as Ascend means the glass classes, tokens, and motion values copy across unchanged.

### Where it gets hosted

Code in a free GitHub repo. Vercel connects to it and gives you a live URL like `ventureadda.vercel.app`, free, redeploying automatically on every code change. Vercel handles React builds with zero configuration. Total cost across Firebase, GitHub and Vercel: zero.

---

## Part 4 — Build order

Build in this order so you always have something working rather than a half-finished everything.

**Step 1 — Skeleton and browsing.** Firebase project set up, customer view reading live ventures from the database, grouped by category, with search. Venture detail page with photos, hours, and menu. Item-level WhatsApp inquiry flow working end to end. No login yet — hardcode two or three ventures directly in the database to test against. At the end of this step you have a real, shareable link that does the main thing.

**Step 2 — Login.** Firebase email-link sign-in restricted to `@thapar.edu`, username selection on first sign-in, profile icon top right, logged-out users can still browse.

**Step 3 — Venture submission and approval.** "Add Venture" button, the submission form with menu builder and photo upload, pending queue, your approve/reject panel. Owners can edit their own listing.

**Step 4 — All Chat.** Shared room, verified users post, everyone reads, moderator delete built in the same step. Do not ship chat without the delete button — in a class-sized group where everyone knows each other, one nasty message is a real problem and you want that control from day one.

**Step 5 — Reviews and ratings.** Star rating plus comment on the detail page, average rating on cards, moderator delete. Same reasoning as chat.

**Step 6 — Analytics and polish.** Inquiry counts per item and per venture surfaced in your panel, mobile layout pass, empty states, loading states, the Ascend design language applied throughout (see Part 6).

---

## Part 5 — Decisions already made, and why

**No payment gateway.** The compliance burden — PAN, business registration, bank verification per seller — is wildly out of proportion to hostel-room brownie sales.

**One account, not three.** Collapsing username login, chat verification, and venture credentials into a single account removes a whole class of confusion and bugs.

**Email-link sign-in over password.** Nothing to store, nothing to leak, nothing to forget, and it actually proves the person owns a Thapar email. Passwords would need a reset flow you'd have to build and secure.

**Approval queue rather than open posting.** Slightly more to build, but nothing fake or embarrassing goes live under your name.

**Logged-out users can browse.** A login wall on the homepage kills word-of-mouth sharing dead.

**Moderation tools ship with the features they moderate.** Chat delete ships with chat. Review delete ships with reviews. Retrofitting moderation after something goes wrong is how small communities blow up.

### Honest limitations

- **Fake reviews are still possible.** A verified account can leave a dishonest review. Your defence is deletion and the fact that everyone knows each other. Real review integrity needs purchase verification, which you don't have because payment is off-site.
- **The moderator passcode is not real security** if you go that route rather than a moderator flag on your account. Prefer the account flag.
- **All Chat will need attention.** A single shared room in a class group can turn into noise or worse. Budget some of your time for it, and consider making it feedback-only in framing so it has a purpose.

---

## Part 6 — Design language

VentureAdda uses **Ascend's design system**, documented in full in `ASCEND-DESIGN-SYSTEM-SPEC.md` (sits alongside this file — hand both to Claude Code). That spec has real values pulled from Ascend's source, not descriptions, so it can be followed literally.

The short version: dark by default (`#02040a` app background), cyan accent (`#22d3ee` / `#06b6d4`), Plus Jakarta Sans for prose and JetBrains Mono for labels and numbers, everything built from white-at-low-opacity rather than solid greys, and liquid-glass panels using `backdrop-filter: blur(20px) saturate(135%)` over a photographic backdrop. Nothing is square-cornered.

### Five things to get right or the whole thing falls apart

1. **Build with the opacity ladder, not solid colours.** Surfaces are `bg-white/[0.03]`, borders are `border-white/10`, text is `text-white/60`. Using solid greys produces a generic dark app even with identical blur values.
2. **You need a photographic backdrop.** Glass only reads as glass when there's something behind it worth blurring. Ascend uses a full-bleed atmospheric photo behind the entire shell. Budget for finding one — a flat dark background makes the same CSS look like frosted plastic.
3. **Bold is the default weight.** Nav items, buttons, card titles are `font-bold`/`font-extrabold`. Regular weight is only for paragraph prose.
4. **Mono means "this is data."** Category tags, item prices, inquiry counts, chat timestamps → `font-mono`, uppercase, wide tracking. Venture descriptions and chat messages → Plus Jakarta Sans.
5. **Copy the glass CSS exactly** from §2 of the spec, including the `--glass-opacity` and `--glass-blur` custom properties. Those two variables let you tune the entire look from one place later.

### Deliberate departures from Ascend, and why

**WhatsApp green stays green.** Ascend has no green anywhere and uses cyan even for success states. But the WhatsApp button is a third-party brand affordance — people recognise `#25D366` instantly and it tells them what happens when they tap. Keeping it is a scoped, intentional exception, not a mistake. Everything else in the app stays cyan-only.

**Body text goes up in size.** Ascend's 11–12px body text works for a dense desktop dashboard used by one motivated person. VentureAdda is a consumer browsing site used mostly on phones by people who are half-paying-attention. Push body copy to 14–15px and venture names to 16–18px. Keep the tiny mono eyebrows at 9–10px — those are labels, not reading material.

**Photography is a first-class citizen.** Ascend is almost entirely text and data; VentureAdda is photos of cake. The spec has no image-treatment pattern to copy, so establish one: venture photos at `rounded-2xl`, 4:3 aspect, sitting inside a `.liquid-glass-panel` card with a subtle inner border. Menu item thumbnails at `rounded-xl`, square.

### Gaps in the spec that VentureAdda actually needs

The spec honestly flags things Ascend never built. Several of them are things you'll need on day one, so budget time to design them rather than assuming they exist to copy:

- **A dropdown/select component.** You need one immediately for the category picker on both the browse filter and the submission form. Ascend has one bespoke instance and no reusable pattern.
- **A destructive/danger button.** You need this for reject-submission, delete-listing, and delete-chat-message. Ascend builds these ad hoc with inline red classes. Make a proper variant.
- **Image avatars.** Ascend uses coloured initials only. That's actually fine for VentureAdda user avatars in chat — keep initials, it's less to build and looks consistent.
- **Focus rings.** Ascend has none and relies on browser defaults. A public site used by a whole class should do better; add a visible focus style (a cyan ring at low opacity fits the language).
- **Press states.** No `active:scale-95` pattern exists in Ascend. On a mobile-first site, tap feedback matters more than on desktop — add a subtle press scale to buttons and cards.

### One thing worth porting outright

The spec calls out the Jarvis orb as the single most Ascend-feeling piece of motion. VentureAdda has no AI assistant, so skip it — but if you ever add one, port that canvas particle system directly rather than rebuilding, so the two products read as siblings.

Getting all of this settled *before* Step 1 matters. Retrofitting a glass system onto finished components is significantly more work than building with it from the start.

---

## Part 7 — Open questions to settle before building

1. **Are you seeding the first listings yourself** from the WhatsApp group, or waiting for submissions? Seed first — strongly recommended. An empty directory gets no submissions.
2. **Which categories at launch?** Suggested: Food & Snacks, Fashion & Accessories, Art & Craft, Services, Tech & Gadgets, Other.
3. **Is `@thapar.edu` the right domain**, or do students use a different one (some institutes use subdomains like `@student.thapar.edu`)? Check an actual student email before building the domain restriction.
4. **Should All Chat be one room or split** into #bugs, #features, #general? One room is simpler and correct until volume demands otherwise.
5. **Does a venture owner need to be a Thapar student?** Currently yes, since venture creation requires an account. Confirm that's what you want.

---

## Handing this to Claude Code

Give it **both** files: this plan and `ASCEND-DESIGN-SYSTEM-SPEC.md`. The spec is the visual source of truth; this plan is the functional one.

Build one step at a time, in the order in Part 4, and have it complete and verify each step before starting the next. The most common way projects like this stall is trying to build everything at once and ending up with nothing that runs.

Before Step 1, do the design setup: Tailwind v4 `@theme` block with Ascend's tokens, the four glass utility classes from §2 of the spec, the fonts imported, and the photographic backdrop in place. Everything after that inherits it for free.
