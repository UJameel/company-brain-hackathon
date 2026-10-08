"use client";
import { useState } from "react";
const CMDS = `git clone https://github.com/UJameel/company-brain-hackathon && cd company-brain-hackathon
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install cognee scalekit-sdk-python openai python-dotenv respan-ai pytest
python -m pantheon ingest
python -m pantheon eval --label before-coverage && python -m pantheon grant --owner alice --to bob
python -m pantheon eval --label after --stage after-grant && python -m pantheon compare before-coverage after`;
export function Quickstart() {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(CMDS); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } };
  return (
    <section className="border-t border-line py-28">
      <h2 className="max-w-[20ch] text-[clamp(34px,4.4vw,60px)]">Clone to eval score in six commands.</h2>
      <div className="relative mt-12">
        <pre className="overflow-x-auto border border-line bg-bg-2 px-6 py-5 font-mono text-[13px] leading-[1.75] text-fg-2">{CMDS}</pre>
        <button onClick={copy} className="btn btn-sm absolute right-3 top-3">{copied ? "Copied" : "Copy"}</button>
      </div>
    </section>
  );
}
