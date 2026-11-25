# Venture Adda

A marketplace for student-run ventures on campus. **Live: [ventureadda.vercel.app](https://ventureadda.vercel.app)**

- Every venture gets its own storefront, and every product gets its own shareable page.
- Cart and orders, including ordering for a friend.
- A moderated billboard features what is on offer; moderators manage ventures and users.

## Stack
React, TypeScript, Vite, Firebase (Auth and Firestore with security rules) and a small server in `server/` that checks sign-in tokens. Hosted on Vercel.

## Run it
```
npm install
npm run dev
```
Copy `.env.example` to `.env` and fill in your own Firebase project first.
