# Soma — Personal Recipe Library

A single-user recipe library that treats Markdown as the format: save, organize,
find, and cook recipes. Built from [`.agents/plans/2026-11-01-inital.md`](.agents/plans/2026-11-01-inital.md)
(V1 scope).

## What V1 does

- Library with search (title, tag, ingredient), tag filters, favorites, and sorting
- Recipe detail with rendered Markdown, ingredient checklists, serving scaling, cooking mode, notes, favorite toggle, and mark-cooked
- Add/edit flow with guided fields and raw Markdown paste/`.md` upload, validation, preview, export, and delete
- Markdown with YAML frontmatter at the import/export boundary; structured ingredients with conservative canonicalization for future pantry matching

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

Other commands:

```bash
npm test    # unit + store tests (vitest)
npm run build && npm start
npm run seed  # refill the starter recipes (only when the library is empty)
```

Recipes live in MongoDB Atlas. Dev and prod use separate collections in the
same database: `soma_dev_recipes` and `soma_prod_recipes` (database defaults to
`dtp-soma`, override with `MONGODB_DB`). `APP_ENV=dev|prod` selects the
collection (defaults to `prod` when `NODE_ENV=production`, else `dev`); an
explicit `MONGODB_COLLECTION` overrides the name entirely.
The first run creates both collections (with indexes) and seeds five starter
recipes into the current environment's collection when it is empty.

Set `MONGODB_URI` in server-side env only, never in client code. See
[.env.example](.env.example) for all variables.

The header toggles light and dark mode; the choice persists per browser and
otherwise follows the OS preference. While recipes load from Atlas, the library
and detail pages show skeleton placeholders.

The detail page can email a recipe through coss.com ("Email recipe"). It needs
a `COSS_API_KEY`: run `npx coss-cli init` and approve the browser prompt to get
a test key, which records mail without delivering. Going live (verified domain,
production key) is a dashboard step.

## Notes on the plan

- `lib/store.ts` exposes a `RecipeStore` interface backed by
  `MongoRecipeStore`; tests use `InMemoryRecipeStore` so they run without Atlas.
