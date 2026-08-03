import type { GeneratedConfig, LibraryEntry } from "./types.ts";

const NAME_SUFFIX = /\s*-\s*(New!?|New)\s*$/i;

export function slugFromHref(href: string): string {
  return href.replace(/\.php$/, "");
}

export function displayNameFromLinkText(text: string): string {
  return text.replace(NAME_SUFFIX, "").trim();
}

export function buildLibraryEntry(input: {
  href: string;
  linkText: string;
  category: string;
  config: GeneratedConfig;
}): LibraryEntry {
  return {
    id: slugFromHref(input.href),
    displayName: displayNameFromLinkText(input.linkText),
    category: input.category,
    sourceUrl: `https://fantasynamegenerators.com/${input.href}`,
    config: input.config,
  };
}
