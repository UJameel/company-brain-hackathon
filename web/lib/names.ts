import type { User } from "./types";

/* The brain's user keys stay alice and bob (datasets, recordings, eval scenarios depend on them).
   The product shows David and Goliath. displayText rewrites what the brain says; toBackend
   rewrites what the person types. Emails and other words containing the names are left alone. */
export const PEOPLE: Record<User, { name: string; role: string; sources: string[]; brain: string }> = {
  alice: { name: "David", role: "Engineering lead", sources: ["Slack", "GitHub", "Notion"], brain: "David's brain" },
  bob: { name: "Goliath", role: "Frontend contractor", sources: ["Slack"], brain: "Goliath's brain" },
};

const NOT_EMAIL = "(?<![\\w.@-])";  // no email local part or domain before the match
const SHOW: [RegExp, string][] = [
  [new RegExp(`${NOT_EMAIL}alice-brain\\b`, "g"), PEOPLE.alice.brain],
  [new RegExp(`${NOT_EMAIL}bob-brain\\b`, "g"), PEOPLE.bob.brain],
  [new RegExp(`${NOT_EMAIL}Alice\\b(?!@)`, "g"), PEOPLE.alice.name],
  [new RegExp(`${NOT_EMAIL}alice\\b(?!@)`, "g"), PEOPLE.alice.name],
  [new RegExp(`${NOT_EMAIL}Bob\\b(?!@)`, "g"), PEOPLE.bob.name],
  [new RegExp(`${NOT_EMAIL}bob\\b(?!@)`, "g"), PEOPLE.bob.name],
];
const BACK: [RegExp, string][] = [
  [/\bDavid's brain\b/g, "alice-brain"], [/\bGoliath's brain\b/g, "bob-brain"],
  [/\bDavid\b/g, "Alice"], [/\bGoliath\b/g, "Bob"],
];

export function displayText(s: string): string {
  return SHOW.reduce((t, [re, to]) => t.replace(re, to), s);
}
export function toBackend(s: string): string {
  return BACK.reduce((t, [re, to]) => t.replace(re, to), s);
}
export function displayDataset(name: string | null | undefined): string {
  return name ? displayText(name) : "";
}
