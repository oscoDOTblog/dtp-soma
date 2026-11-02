# Recipe import prompt

The easiest path: open “Add recipe” in the app — the same prompt below is shown
there with a copy button.

Otherwise copy the block below and send it to your AI agent together with the
recipe (pasted text, a link, a photo, a cookbook scan — anything). Paste the
agent's answer straight into Soma via “Add recipe” or “Import .md”.

---

Reformat the recipe below into Markdown for my recipe library. Output ONLY the Markdown — no explanations, no code fences.

Rules:

1. Start with YAML frontmatter between two --- lines, then the method and notes as Markdown below it.
2. Frontmatter fields:
   - title (required): the recipe name.
   - description: one appetizing sentence. Write one if the source has none.
   - tags: lowercase list, e.g. italian, quick, dinner, vegetarian, dessert.
   - categories: lowercase list, usually one of breakfast, dinner, dessert, snack.
   - servings: a number greater than 0 (guess from the ingredient amounts if unstated).
   - prepMinutes, cookMinutes: whole numbers, 0 or more. Omit if unknown.
   - favorite: false.
   - ingredients: one entry per ingredient, each with a name and, when known, quantity (number only — 0.5 not "1/2"), unit (cup, tbsp, tsp, g, ml, whole, clove, slice), and note (e.g. "sliced"). Keep names simple; amounts and prep detail go in quantity, unit, and note.
3. Below the frontmatter: a # Title heading, then ## Instructions with numbered steps (one action per step, with times and temperatures), then ## Notes with 1–3 practical tips.
4. Convert all amounts to numbers. Ranges ("2–3 cloves") become the middle. "A pinch" or "to taste" means no quantity, with the detail in note.
5. Never invent ingredients or steps not in the source. If something is genuinely missing (oven temperature, servings), guess and say so in ## Notes.

Example:

---
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

Here is the recipe:
