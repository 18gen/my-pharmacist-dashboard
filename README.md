# My Pharmacist dashboard

The pharmacy side of the My Pharmacist demo: a web page where a (fictional) pharmacy sees
which doses the people sharing from the app took, as their scans saw them, missed, or were
told not to take.

Built with Next.js (App Router, `src/` directory) and TypeScript, styled with Tailwind CSS
and [shadcn/ui](https://ui.shadcn.com/) (Base UI, "nova" preset), set up following
[the shadcn/ui Next.js guide](https://ui.shadcn.com/docs/installation/next).

## Develop

```sh
npm install
cp .env.example .env.local   # then fill in APP_TOKEN and DASHBOARD_KEY
npm run dev      # http://localhost:3000
npm test
npm run build
npm run lint
```

Without the Upstash variables, `npm run dev` keeps everyone in memory until it stops.
Hosted on Vercel, with Upstash Redis from the Vercel Marketplace; there the API refuses
to run without it.

To see the dashboard without phones, start `npm run dev`, then `npm run seed:local`: it
resets the local demo and adds five made-up people built around the time now, with scan
pictures from `scripts/fixtures` (Maria's week is the app's "sample week"; Sam started
today), and prints the link to open, with the key in it.

## The dashboard

One table for everyone, asking the API for changes every 2 seconds:

- The last 7 days across, today last. For each person, a row per dose time, then the
  medicines taken only when needed, then any pill the app didn't know. Each row starts
  with the medicine's own picture (the sample medicines'; a plain tablet for others).
- Each box is one dose on one day, drawn as on the app's Home, with its time under it:
  the pill as the scan saw it inside green corner marks (the medicine's own picture when
  the scan's isn't here), ✓ ticked by hand, an empty orange box not taken, a blue box due
  now, a dashed box later today, a faint box "no record yet" (before the phone's first
  record). A red ✗ marks a dose the app said "Don't take now" about.
- Click a box: what happened that day for that person, in the panel beside the table.
- Click a name to fold that person's rows. The corner orders people by latest update (so
  the phone on stage stays on top), when they joined, or name.
- Anything that changed since the last look glows once.
- Facts only, no triage: nothing says "needs a call", and the page says the pharmacy
  isn't alerted. Reset demo removes everyone; their phones stop sharing.
- The key: open `/#key=<DASHBOARD_KEY>` once and this browser keeps it; otherwise the
  page asks for it.
- Light only, in the app's colours (cream and espresso) and the system's fonts. On a
  phone the days scroll under the names, starting at today.

The table and its words are worked out in `src/lib/board.ts`, tested in
`test/board.test.ts`; the page is shadcn's Table, Toggle Group, Card and Alert Dialog.

## API

The iOS app sends `X-App-Token: <APP_TOKEN>`; the dashboard sends
`Authorization: Bearer <DASHBOARD_KEY>`. No accounts: a person is the name they type.

| Route | Who | Does |
|---|---|---|
| `POST /api/patients` | app | `{name}` → 201 `{id}`: starts sharing |
| `PUT /api/patients/:id` | app | the phone's whole snapshot (`src/lib/snapshot.ts`) → 204; 404 once reset or removed |
| `PUT /api/patients/:id/photos/:photoId` | app | a scanned pill's picture, a JPEG of at most 48 KB, sent before the snapshot that names it → 204; 404 once reset or removed |
| `GET /api/patients/:id/photos/:photoId?t=` | dashboard's `<img>` | the picture, with the person's `photoToken` from the list |
| `DELETE /api/patients/:id` | app or dashboard | stops sharing / removes someone, with their pictures → 204 |
| `GET /api/patients` | dashboard | `{patients}`, each with a `photoToken`; 304 when the ETag still matches; people idle 14 days are removed |
| `POST /api/reset` | dashboard | removes everyone and their pictures → 204 |

A picture's ID is a UUID the phone gives it; the snapshot names it on the dose, when-needed
tablet or scanned pill it shows, and gives `recordsSince`, the first day the phone has any
record of. Pictures expire after 8 days anyway, and at most 300 are kept per person.
`photoToken` is an HMAC of the person's ID with `DASHBOARD_KEY`, because an `<img>` can't
send the key.

Rate limits (with Redis): 60 joins a minute per network address, 120 snapshots and 240
pictures a minute per person. At most 200 people at once.

Add shadcn/ui components with `npx shadcn@latest add <name>`, checking the component's
page on ui.shadcn.com first. This Next.js version ships its own docs in
`node_modules/next/dist/docs/` (see `AGENTS.md`).

## With the iOS app

The app ([MyPharmacist](https://github.com/18gen/my-pharmacist)) shares from My pharmacy →
Share my doses, once its `Secrets.plist` has `PHARMACY_URL` (this dashboard's address)
and `PHARMACY_TOKEN` (its `APP_TOKEN`). Its snapshot is `ShareSnapshot.swift`, the
format `src/lib/snapshot.ts` checks.

To try the two together on a Mac, run `npm run dev` here and start a Debug build in the
Simulator with these launch arguments:

```
-pharmacyURL http://localhost:3000 -pharmacyToken <APP_TOKEN> -resetWithSampleWeek -shareAs Maria
```

The app resets to a sample week (a dose due now, the six days before filled in) and joins
as Maria. The Simulator can't scan, so try scans on a phone.

A phone can't reach `localhost` on the Mac (it is the phone itself). Without deploying,
give the dev server an HTTPS address with a tunnel, such as `ngrok http 3000`, and run the
app from Xcode on the phone with `-pharmacyURL <the tunnel's https address>
-pharmacyToken <APP_TOKEN>`. Xcode passes launch arguments only when it starts the app, so
open it with ▶, not from the home screen. Stop the tunnel when done: while it runs, the
dev server is reachable from the internet.

## Demo checklist

1. Before: open the dashboard's link with the key, and press Reset demo. On the phone:
   About & privacy → Reset demo → With a sample week.
2. On the phone: My pharmacy → Share my doses → a name → Start sharing. Their rows
   appear with the week: three doses not taken, two red ✗ ("Don't take now"), one
   unknown pill.
3. Scan the pills due now: today's boxes show the pills as scanned, with the time, and
   glow. Scan one again: a red ✗ on it; click it for "Don't take now: … already taken".
4. After: Reset demo on the dashboard. Phones that shared show "Sharing stopped" the next
   time they open.

## Deploy (Vercel)

1. Import this repository in Vercel.
2. Add Upstash for Redis from the Vercel Marketplace to the project; it sets
   `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Set `APP_TOKEN` and `DASHBOARD_KEY` to two long random values in the project's
   environment variables, and deploy.
4. In the iOS app's `Secrets.plist`: `PHARMACY_URL` = the deployment's address,
   `PHARMACY_TOKEN` = `APP_TOKEN`.
5. Open `https://<the address>/#key=<DASHBOARD_KEY>` once on the computer for demos.
