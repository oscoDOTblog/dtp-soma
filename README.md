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

Recipes live in SQLite at `./data/recipes.db` (override with `RECIPES_DB_PATH`).
The first run seeds five starter recipes into an empty database.

## Notes on the plan

- The plan's Sites/MongoDB-Atlas split is not available in this environment (no
  Sites tooling, no Atlas credentials), so this implements the plan's stated
  fallback: a full app on a Node runtime with SQLite as the source of truth.
- `lib/store.ts` exposes a `RecipeStore` interface, so the MongoDB API adapter
  from the plan can replace `SqliteRecipeStore` later without changing the UI.
- Same-origin API routes need no service credential; if the MongoDB adapter is
  added later, put its credential in server-side env only, never in client code.
