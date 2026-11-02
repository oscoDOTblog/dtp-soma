import { RecipeInput, parseRecipeMarkdown } from "./recipes";
import { MongoRecipeStore, collectionName, ensureDevProdCollections } from "./store";

export const SEED_MARKDOWN: string[] = [
  `---
id: kimchi-fried-rice
title: Kimchi Fried Rice
description: Fast, savory fried rice that turns day-old rice and kimchi into dinner.
tags:
  - korean
  - quick
  - dinner
  - rice
categories:
  - dinner
servings: 2
prepMinutes: 5
cookMinutes: 15
favorite: true
ingredients:
  - name: cooked rice
    quantity: 2
    unit: cup
    note: day-old works best
  - name: kimchi
    quantity: 1
    unit: cup
  - name: sesame oil
    quantity: 1
    unit: tbsp
  - name: egg
    quantity: 2
    unit: whole
  - name: soy sauce
    quantity: 1
    unit: tsp
  - name: green onions
    quantity: 2
    unit: whole
    note: sliced
---

# Kimchi Fried Rice

## Instructions

1. Heat sesame oil in a large pan over medium-high heat.
2. Add kimchi and stir-fry for 2 minutes until fragrant.
3. Add rice, breaking up clumps, and toss for 4 minutes.
4. Stir in soy sauce. Push rice aside and fry the eggs in the same pan.
5. Top with sliced green onions and serve.

## Notes

- Day-old rice fries far better than fresh rice.
- Add gochujang for extra heat.
`,
  `---
id: garlic-egg-rice
title: Garlic Egg Rice
description: Pantry-friendly comfort bowl with crispy garlic and a fried egg.
tags:
  - quick
  - breakfast
  - budget
categories:
  - breakfast
servings: 1
prepMinutes: 5
cookMinutes: 10
favorite: false
ingredients:
  - name: cooked rice
    quantity: 1
    unit: cup
  - name: garlic
    quantity: 3
    unit: clove
    note: thinly sliced
  - name: egg
    quantity: 1
    unit: whole
  - name: soy sauce
    quantity: 1
    unit: tsp
  - name: butter
    quantity: 1
    unit: tbsp
---

# Garlic Egg Rice

## Instructions

1. Melt butter and crisp the garlic slices until golden. Remove and set aside.
2. Fry the egg in the same pan to your liking.
3. Warm the rice through in the garlicky butter.
4. Plate rice, top with egg and crispy garlic, finish with soy sauce.

## Notes

- Watch the garlic closely; it goes from golden to bitter fast.
`,
  `---
id: weeknight-tomato-pasta
title: Weeknight Tomato Pasta
description: A 25 minute pantry pasta with garlic, chili, and parmesan.
tags:
  - italian
  - quick
  - dinner
  - vegetarian
categories:
  - dinner
servings: 4
prepMinutes: 10
cookMinutes: 15
favorite: true
ingredients:
  - name: spaghetti
    quantity: 400
    unit: g
  - name: cherry tomatoes
    quantity: 500
    unit: g
    note: halved
  - name: garlic
    quantity: 4
    unit: clove
  - name: olive oil
    quantity: 3
    unit: tbsp
  - name: chili flakes
    quantity: 0.5
    unit: tsp
  - name: parmesan
    quantity: 40
    unit: g
    note: grated, plus more to serve
  - name: salt
    quantity: 1
    unit: tsp
---

# Weeknight Tomato Pasta

## Instructions

1. Boil pasta in well-salted water until just shy of al dente. Reserve a cup of pasta water.
2. Meanwhile, soften garlic and chili in olive oil over medium heat.
3. Add tomatoes and salt; crush and simmer 10 minutes.
4. Toss pasta through the sauce with parmesan, loosening with pasta water.
5. Serve with extra parmesan.

## Notes

- The pasta water is the sauce; do not skip reserving it.
- Swap in any short pasta; add a knob of butter for richness.
`,
  `---
id: chicken-fried-rice
title: Chicken Fried Rice
description: Takeout-style fried rice with chicken, peas, and scallions.
tags:
  - quick
  - dinner
  - rice
categories:
  - dinner
servings: 4
prepMinutes: 15
cookMinutes: 15
favorite: false
ingredients:
  - name: chicken breast
    quantity: 400
    unit: g
    note: diced small
  - name: cooked rice
    quantity: 4
    unit: cup
    note: day-old
  - name: eggs
    quantity: 3
    unit: whole
    note: beaten
  - name: frozen peas
    quantity: 1
    unit: cup
  - name: soy sauce
    quantity: 3
    unit: tbsp
  - name: sesame oil
    quantity: 2
    unit: tsp
  - name: scallions
    quantity: 4
    unit: whole
    note: sliced
  - name: garlic
    quantity: 2
    unit: clove
    note: minced
---

# Chicken Fried Rice

## Instructions

1. Sear the chicken in a hot wok until cooked through; set aside.
2. Scramble the eggs until just set; set aside with the chicken.
3. Stir-fry garlic, rice, and peas until the rice toasts lightly.
4. Return chicken and egg; season with soy sauce and sesame oil.
5. Finish with scallions and serve hot.

## Notes

- A screaming-hot pan is the whole recipe; cook in batches if needed.
`,
  `---
id: creamy-mac-and-cheese
title: Creamy Mac and Cheese
description: Stovetop mac and cheese with a silky cheddar sauce.
tags:
  - comfort
  - dinner
  - vegetarian
categories:
  - dinner
servings: 4
prepMinutes: 5
cookMinutes: 20
favorite: false
ingredients:
  - name: elbow macaroni
    quantity: 350
    unit: g
  - name: cheddar
    quantity: 250
    unit: g
    note: grated from a block
  - name: milk
    quantity: 500
    unit: ml
  - name: butter
    quantity: 40
    unit: g
  - name: flour
    quantity: 2
    unit: tbsp
  - name: salt
    quantity: 0.5
    unit: tsp
---

# Creamy Mac and Cheese

## Instructions

1. Boil macaroni in salted water until al dente; drain.
2. Melt butter, whisk in flour, and cook 1 minute.
3. Whisk in milk gradually; simmer until thickened.
4. Off the heat, melt in the cheddar a handful at a time.
5. Fold through the pasta and serve immediately.

## Notes

- Grate your own cheese; pre-grated cheese makes a grainy sauce.
- Add a spoon of mustard for depth.
`,
];

export async function seedDatabase(): Promise<{ seeded: number; skipped: boolean }> {
  await ensureDevProdCollections();
  const store = new MongoRecipeStore(collectionName());
  if ((await store.list()).length > 0) return { seeded: 0, skipped: true };
  let seeded = 0;
  for (const source of SEED_MARKDOWN) {
    const input: RecipeInput = parseRecipeMarkdown(source);
    await store.create(input);
    seeded += 1;
  }
  return { seeded, skipped: false };
}

if (require.main === module) {
  seedDatabase().then(
    (result) => {
      console.log(
        result.skipped
          ? "Database already has recipes; nothing seeded."
          : `Seeded ${result.seeded} recipes into ${collectionName()}.`,
      );
      process.exit(0);
    },
    (error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
