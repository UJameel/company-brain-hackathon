// Captures real /ask responses for the demo questions, both users, before and after the grant.
// Usage: API=http://localhost:8080 DEMO_KEY=dev node scripts/record.mjs
import { writeFileSync } from "node:fs";

const API = process.env.API ?? "http://localhost:8080";
const KEY = process.env.DEMO_KEY ?? "";
const QUESTIONS = [
  "What is blocking PR #3, who owns it, and which issue tracks the blocker?",
  "What will the Pro plan cost after the Atlas launch?",
  "Is the Atlas launch date at risk? If so, what is the fallback date and the deadline that decides it?",
  "Open a GitHub issue asking Marco to add exponential backoff to the Paddle webhook handler so PR #3 can merge.",
];
const norm = (q) => q.trim().split(/\s+/).join(" ").toLowerCase();
const post = (p, b, h = {}) => fetch(`${API}${p}`, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) }).then((r) => r.json());

const out = {};
for (const granted of [false, true]) {
  if (granted) await post("/grant", { owner: "alice", to: "bob" }, { "X-Demo-Key": KEY });
  for (const user of ["alice", "bob"]) for (const q of QUESTIONS) {
    out[`${user}|${norm(q)}|${granted ? "after" : "before"}`] = await post("/ask", { user, question: q });
    console.log(user, granted ? "after" : "before", q.slice(0, 40));
  }
}
await post("/revoke", { owner: "alice", to: "bob" }, { "X-Demo-Key": KEY });
writeFileSync(new URL("../data/recorded.json", import.meta.url), JSON.stringify(out, null, 2));
