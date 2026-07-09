# World Cup 2026 Fantasy Quiz

A tiny static pick 'em app for the remaining knockout stages of the 2026 FIFA
World Cup (Quarterfinals → Final). Friends "log in" with just a name + email
(no password — trust-based, meant for a small group), pick winners for each
match, and see a live leaderboard.

Bracket data (`js/matches.js`) is pre-filled with the real quarterfinalists
and kickoff times as of 2026-07-08:

- QF1: France vs Morocco — Jul 9, 4:00 PM ET
- QF2: Spain vs Belgium — Jul 10, 3:00 PM ET
- QF3: Norway vs England — Jul 11, 5:00 PM ET
- QF4: Argentina vs Switzerland — Jul 11, 9:00 PM ET
- Semifinals: Jul 14 & 15
- Third-place: Jul 18
- Final: Jul 19

Quarterfinal picks are the fixed, real matchups. Semifinal, third-place, and
final picks let you choose any of the 8 quarterfinalists — no need to wait
for earlier rounds to resolve, so everyone can fill out every stage in one
sitting. The two semifinal picks share one pool of teams: picking a team to
win one semifinal removes it from the other's options, since the same team
can't win both.

## Scoring

| Stage | Points per correct pick |
|---|---|
| Quarterfinal winner | 1 |
| Semifinal winner | 2 |
| Third-place winner | 3 |
| Final winner | 3 |

## One-time setup

### 1. Create a free Firebase project

1. Go to https://console.firebase.google.com, create a project (any name).
2. In the project, go to **Build → Firestore Database → Create database**.
   Start in **production mode** (we'll set rules below), pick any region.
3. Go to **Project settings → General → Your apps**, click the `</>` (Web)
   icon, register an app (no need for Firebase Hosting).
4. Copy the `firebaseConfig` object it shows you.

### 2. Paste your config

Open `webapp/js/firebase-config.js` and replace the placeholder values with
the ones Firebase gave you. These values are not secret — access control is
handled by Firestore Security Rules (next step), not by hiding this file.

### 3. Set Firestore Security Rules

In Firebase Console → Firestore Database → **Rules**, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /picks/{picksId} {
      allow read: if true;
      allow write: if request.resource.data.email is string
                   && request.resource.data.picks is map;
      allow delete: if true;
    }
    match /tournament/{docId} {
      allow read, write, delete: if true; // gated only by the soft admin key in admin.js
    }
  }
}
```

This app has **no real authentication**. Anyone with the site link could in
theory overwrite someone else's picks, and anyone with the `admin.html` link
and the admin key can overwrite results. That's an acceptable tradeoff for a
casual pool with friends — don't use it for anything with money on the line,
and don't publicize the admin link.

### 4. Set your admin key

Open `webapp/js/admin.js` and change `ADMIN_KEY` from `'change-me'` to
something only you know. Only share `admin.html` with yourself (the pool
organizer) — that's the page used to enter real match results as the
tournament progresses.

### 5. Enable GitHub Pages (one-time, in repo Settings)

This repo already has a GitHub Actions workflow
(`.github/workflows/deploy-pages.yml`) that deploys the `webapp/` folder to
GitHub Pages on every push to `main`/`master`. To turn it on:

1. Go to the repo's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Merge/push this branch to `master` (or run the workflow manually from the
   **Actions** tab) — the site will be published at
   `https://<owner>.github.io/<repo>/`.

## Running locally

No build step needed. From the `webapp/` folder:

```
npx serve .
```

(or any static file server — it just needs to serve plain files, ES modules
require http:// not file://).

## Updating results as the tournament progresses

Go to `/admin.html`, enter your admin key, and select the winner of each
match as results come in. The main page updates live for everyone (via
Firestore's real-time listeners) — no redeploy needed.
