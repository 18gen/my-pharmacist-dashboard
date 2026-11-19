# My Pharmacist dashboard

The pharmacy side of the My Pharmacist demo: a web page where a (fictional) pharmacy sees
which doses the people sharing from the app took, missed, or were told not to take.

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
resets the local demo and adds four made-up people built around the time now (Maria's
week is the app's "sample week"), and prints the link to open, with the key in it.

## The dashboard

One page, nothing to click during a demo. It asks the API for changes every 2 seconds.

- A card per person, the latest update first: today's counts, the last 7 days (✓ taken,
  ✗ missed, clock due now, · later), and "What happened": doses taken today, missed
  doses, what the app told them not to take and why, unknown pills, when-needed tablets.
- Anything that changed since the last look glows once; a new person's whole card does.
- Facts only, no triage: nothing says "needs a call", and the page says the pharmacy
  isn't alerted.
- Reset demo removes everyone; Remove takes one person off. Their phones stop sharing.
- The key: open `/#key=<DASHBOARD_KEY>` once and this browser keeps it; otherwise the
  page asks for it.
- The app's colours (cream and espresso), light or dark as the computer is set.

The wording and states are worked out in `src/lib/card.ts`, tested in `test/card.test.ts`.

## API

The iOS app sends `X-App-Token: <APP_TOKEN>`; the dashboard sends
`Authorization: Bearer <DASHBOARD_KEY>`. No accounts: a person is the name they type.

| Route | Who | Does |
|---|---|---|
| `POST /api/patients` | app | `{name}` → 201 `{id}`: starts sharing |
| `PUT /api/patients/:id` | app | the phone's whole snapshot (`src/lib/snapshot.ts`) → 204; 404 once reset or removed |
| `DELETE /api/patients/:id` | app or dashboard | stops sharing / removes someone → 204 |
| `GET /api/patients` | dashboard | `{patients}`; 304 when the ETag still matches; people idle 14 days are removed |
| `POST /api/reset` | dashboard | removes everyone → 204 |

Rate limits (with Redis): 60 joins a minute per network address, 120 snapshots a minute
per person. At most 200 people at once.

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

## Demo checklist

1. Before: open the dashboard's link with the key, and press Reset demo. On the phone:
   About & privacy → Reset demo → With a sample week.
2. On the phone: My pharmacy → Share my doses → a name → Start sharing. Their card
   appears with the week: three missed doses, two "told not to take", one unknown pill.
3. Scan the pills due now: today's cells turn ✓ and glow. Scan one again: "Told not to
   take … already taken".
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
