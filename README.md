# My Pharmacist dashboard

The pharmacy side of the My Pharmacist demo: a web page where a (fictional) pharmacy sees
which doses the people sharing from the app took, missed, or were told not to take.

Built with Vite, React and TypeScript, styled with Tailwind CSS and
[shadcn/ui](https://ui.shadcn.com/) (Base UI, "nova" preset). Set up following
[the shadcn/ui Vite guide](https://ui.shadcn.com/docs/installation/vite); TypeScript 7
removed `baseUrl`, so the `@/` alias is `paths` alone in `tsconfig.json` and
`tsconfig.app.json`.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and build into dist/
npm run lint
```

Add shadcn/ui components with `npx shadcn@latest add <name>`, checking the component's
page on ui.shadcn.com first.
