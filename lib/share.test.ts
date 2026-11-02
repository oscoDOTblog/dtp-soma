import { describe, expect, it } from "vitest";
import { parseRecipeMarkdown } from "./recipes";
import { buildShareEmail, isValidRecipient, sendRecipeShare } from "./share";

const SOURCE = `---
title: Garlic Egg Rice
servings: 1
ingredients:
  - name: garlic
    quantity: 3
    unit: clove
---

# Garlic Egg Rice

Fry it.
`;

describe("isValidRecipient", () => {
  it("accepts plain addresses and rejects junk", () => {
    expect(isValidRecipient("friend@example.com")).toBe(true);
    expect(isValidRecipient("  friend@example.com  ")).toBe(true);
    expect(isValidRecipient("not-an-email")).toBe(false);
    expect(isValidRecipient("a@b")).toBe(false);
    expect(isValidRecipient("")).toBe(false);
    expect(isValidRecipient(null)).toBe(false);
    expect(isValidRecipient(42)).toBe(false);
  });
});

describe("buildShareEmail", () => {
  it("packs title, servings, ingredients, and method into text and html", () => {
    const recipe = { ...parseRecipeMarkdown(SOURCE), id: "garlic-egg-rice", sourceMarkdown: SOURCE, createdAt: "", updatedAt: "", lastCookedAt: null as string | null, favorite: false };
    const email = buildShareEmail(recipe);
    expect(email.subject).toContain("Garlic Egg Rice");
    expect(email.text).toContain("3 clove garlic");
    expect(email.text).toContain("Serves 1");
    expect(email.text).toContain("Fry it.");
    expect(email.html).toContain("<h1>Garlic Egg Rice</h1>");
    expect(email.html).toContain("3 clove garlic");
    expect(email.html).not.toContain("<script");
  });
});

describe("sendRecipeShare", () => {
  it("explains setup instead of failing when no API key is configured", async () => {
    const prev = process.env.COSS_API_KEY;
    try {
      delete process.env.COSS_API_KEY;
      const recipe = { ...parseRecipeMarkdown(SOURCE), id: "garlic-egg-rice", sourceMarkdown: SOURCE, createdAt: "", updatedAt: "", lastCookedAt: null as string | null, favorite: false };
      const result = await sendRecipeShare(recipe, "friend@example.com");
      expect(result.ok).toBe(false);
      expect(result.message).toContain("COSS_API_KEY");
    } finally {
      if (prev === undefined) delete process.env.COSS_API_KEY;
      else process.env.COSS_API_KEY = prev;
    }
  });
});
