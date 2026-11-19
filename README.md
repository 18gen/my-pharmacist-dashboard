# My Pharmacist dashboard

The pharmacy side of the My Pharmacist demo: a web page where a (fictional) pharmacy sees
which doses the people sharing from the app took, missed, or were told not to take.

Built with Next.js (App Router, `src/` directory) and TypeScript, styled with Tailwind CSS
and [shadcn/ui](https://ui.shadcn.com/) (Base UI, "nova" preset), set up following
[the shadcn/ui Next.js guide](https://ui.shadcn.com/docs/installation/next).

## Develop

```sh
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Add shadcn/ui components with `npx shadcn@latest add <name>`, checking the component's
page on ui.shadcn.com first. This Next.js version ships its own docs in
`node_modules/next/dist/docs/` (see `AGENTS.md`).
