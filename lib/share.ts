import { Coss } from "coss";
import { Recipe, formatQuantity } from "./recipes";

/** Sender shown on shared recipes. Any address works with a test key. */
export function shareFrom(): string {
  return process.env.COSS_SHARE_FROM ?? "Soma Recipes <recipes@soma.local>";
}

export function isValidRecipient(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (email.length > 254 || email.includes(" ")) return false;
  const [local, domain] = email.split("@");
  return Boolean(local) && Boolean(domain) && domain.includes(".");
}

function ingredientLine(ing: Recipe["ingredients"][number]): string {
  const parts: string[] = [];
  if (ing.quantity !== null) parts.push(formatQuantity(ing.quantity));
  if (ing.unit) parts.push(ing.unit);
  parts.push(ing.name);
  const line = parts.join(" ");
  return ing.note ? `${line} (${ing.note})` : line;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Subject and bodies for the "email this recipe" share action. */
export function buildShareEmail(recipe: Recipe): { subject: string; text: string; html: string } {
  const subject = `${recipe.title} — a recipe from Soma`;
  const time =
    recipe.prepMinutes !== null || recipe.cookMinutes !== null
      ? `${(recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)} min total`
      : null;
  const lines: string[] = [recipe.title, ""];
  if (recipe.description) lines.push(recipe.description, "");
  lines.push([time, `Serves ${recipe.servings}`].filter(Boolean).join(" · "), "");
  if (recipe.ingredients.length > 0) {
    lines.push("Ingredients", ...recipe.ingredients.map((ing) => `- ${ingredientLine(ing)}`), "");
  }
  lines.push("Method", "", recipe.bodyMarkdown.trimEnd(), "");

  const items = recipe.ingredients
    .map((ing) => `<li>${escapeHtml(ingredientLine(ing))}</li>`)
    .join("");
  const html = [
    `<h1>${escapeHtml(recipe.title)}</h1>`,
    recipe.description ? `<p>${escapeHtml(recipe.description)}</p>` : "",
    `<p>${escapeHtml([time, `Serves ${recipe.servings}`].filter(Boolean).join(" · "))}</p>`,
    items ? `<h2>Ingredients</h2><ul>${items}</ul>` : "",
    `<h2>Method</h2><pre>${escapeHtml(recipe.bodyMarkdown.trimEnd())}</pre>`,
  ].join("\n");

  return { subject, text: lines.join("\n"), html };
}

export interface ShareResult {
  ok: boolean;
  message: string;
}

/** Email one recipe through coss.com. Never throws for API failures. */
export async function sendRecipeShare(recipe: Recipe, to: string): Promise<ShareResult> {
  if (!process.env.COSS_API_KEY) {
    return {
      ok: false,
      message: "Email is not set up yet. Run `npx coss-cli init` to add a COSS_API_KEY.",
    };
  }
  const email = buildShareEmail(recipe);
  const coss = new Coss();
  const { error } = await coss.email.send(
    { from: shareFrom(), to, subject: email.subject, text: email.text, html: email.html },
    { idempotencyKey: `share-${recipe.id}-${to}` },
  );
  if (error) {
    const hint = error.hint ? ` ${error.hint}` : "";
    return { ok: false, message: `Could not send the email: ${error.message}.${hint}`.trimEnd() };
  }
  return { ok: true, message: `Sent to ${to}.` };
}
