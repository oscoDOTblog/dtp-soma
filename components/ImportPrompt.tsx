"use client";

import { useState } from "react";
import { IMPORT_PROMPT } from "@/lib/import-prompt";

async function copyPrompt(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(IMPORT_PROMPT);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = IMPORT_PROMPT;
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/** Collapsible AI-import prompt with a copy button, shown on the new page. */
export default function ImportPrompt() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  async function onCopy(): Promise<void> {
    setCopied(await copyPrompt() ? "done" : "failed");
    window.setTimeout(() => setCopied("idle"), 2500);
  }

  return (
    <section className="panel prompt-panel" aria-labelledby="import-prompt-heading">
      <div className="prompt-head">
        <h2 id="import-prompt-heading">Have an AI format it for you</h2>
        <button type="button" className="btn btn-small btn-quiet" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Hide prompt" : "Show prompt"}
        </button>
      </div>
      <p className="card-meta">
        Copy this prompt, send it to your AI agent along with the recipe, then paste the answer
        into the Markdown tab.
      </p>
      {open && (
        <>
          <pre className="prompt-pre">{IMPORT_PROMPT}</pre>
          <div className="toolbar-row">
            <button type="button" className="btn btn-small btn-primary" onClick={() => void onCopy()}>
              {copied === "done" ? "Copied" : "Copy prompt"}
            </button>
            {copied === "failed" && (
              <span className="error-text" role="alert">
                Copy failed — select the text manually.
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
