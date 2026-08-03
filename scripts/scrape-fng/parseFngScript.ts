// Parses an FNG generator script (nm* fragment arrays + a nameGen(type)
// function doing plain string concatenation) into a GeneratedConfig.
//
// Two passes:
//  1. Execute the script in a sandboxed vm context to read the nm* arrays
//     and get nameGen's source text (robust to quote style/formatting).
//  2. Statically analyze nameGen's source text to recover the two-branch
//     gender structure and each branch's concatenation expression. Anything
//     beyond "plain concatenation of nm*[index] picks and string literals,
//     branched once on a type flag" is flagged for manual review rather than
//     guessed at.
import vm from "node:vm";

import type {
  GeneratedConfig,
  NamePatternElement,
  NmLists,
  ParseResult,
} from "./types.ts";

const ANNOTATION_SUFFIX = /\s*\(.*\)\s*$/;

export function parseFngScript(source: string): ParseResult {
  const extracted = extractNmListsAndNameGen(source);
  if ("error" in extracted)
    return { status: "flagged", reason: extracted.error };
  const { lists, nameGenSource } = extracted;

  const branches = extractGenderBranches(nameGenSource);
  if ("error" in branches) return { status: "flagged", reason: branches.error };

  const variables = extractPrecomputedVariables(nameGenSource);

  const femaleTokens = tokenizeAssignedExpression(
    branches.femaleBody,
    variables,
  );
  if ("error" in femaleTokens) {
    return {
      status: "flagged",
      reason: `female branch: ${femaleTokens.error}`,
    };
  }
  const maleTokens = tokenizeAssignedExpression(branches.maleBody, variables);
  if ("error" in maleTokens) {
    return { status: "flagged", reason: `male branch: ${maleTokens.error}` };
  }

  const female = splitGivenAndSurname(femaleTokens.tokens);
  const male = splitGivenAndSurname(maleTokens.tokens);

  const surnameNonEmpty = female.surname.length > 0 || male.surname.length > 0;
  const surname = female.surname.length > 0 ? female.surname : male.surname;

  const usedListKeys = new Set<string>();
  for (const element of [...female.given, ...male.given, ...surname]) {
    if (Array.isArray(element)) element.forEach((key) => usedListKeys.add(key));
  }

  const parts: NmLists = {};
  for (const key of usedListKeys) {
    const list = lists[key];
    if (list === undefined) {
      return {
        status: "flagged",
        reason: `expression references unknown list "${key}"`,
      };
    }
    parts[key] = normalizeEntries(list);
  }

  const config: GeneratedConfig = {
    type: "generated",
    convention: surnameNonEmpty ? "pool" : "none",
    parts,
    patterns: {
      female_given: female.given,
      male_given: male.given,
      surname,
    },
  };

  return { status: "converted", config };
}

function normalizeEntries(entries: string[]): string[] {
  const cleaned = entries
    .map((entry) => entry.replace(ANNOTATION_SUFFIX, "").trim())
    .filter((entry) => entry.length > 0 && entry.length <= 64);
  return Array.from(new Set(cleaned)).slice(0, 500);
}

// nm* arrays are sometimes declared at module scope and sometimes local to
// nameGen itself, so lists are extracted by scanning the raw source text
// (covers both) rather than by executing the script and reading globals.
function extractNmListsAndNameGen(
  source: string,
): { lists: NmLists; nameGenSource: string } | { error: string } {
  const nameGenMatch = /function\s+nameGen\s*\([^)]*\)\s*\{/.exec(source);
  if (nameGenMatch === null) return { error: "no nameGen function found" };
  const bodyOpen = nameGenMatch.index + nameGenMatch[0].length - 1;
  const bodyClose = findMatchingBrace(source, bodyOpen);
  if (bodyClose === -1)
    return { error: "unbalanced braces in nameGen function" };
  const nameGenSource = source.slice(nameGenMatch.index, bodyClose + 1);

  const lists: NmLists = {};
  const declPattern = /\b(?:var|let|const)\s+(nm\d+)\s*=\s*\[/g;
  let match: RegExpExecArray | null;
  while ((match = declPattern.exec(source)) !== null) {
    const key = match[1];
    if (key === undefined) continue;
    const arrayOpen = declPattern.lastIndex - 1;
    const arrayClose = findMatchingBracket(source, arrayOpen);
    if (arrayClose === -1) continue;
    const literal = source.slice(arrayOpen, arrayClose + 1);
    try {
      const value: unknown = vm.runInNewContext(
        `(${literal})`,
        {},
        { timeout: 2000 },
      );
      if (Array.isArray(value)) {
        lists[key] = value.filter(
          (entry): entry is string => typeof entry === "string",
        );
      }
    } catch {
      // Not a plain string-array literal; skip it.
    }
  }
  if (Object.keys(lists).length === 0) return { error: "no nm* arrays found" };

  return { lists, nameGenSource };
}

function findMatchingBracket(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findMatchingBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractGenderBranches(
  nameGenSource: string,
): { femaleBody: string; maleBody: string } | { error: string } {
  const ifMatch = /if\s*\(\s*tp\s*(===|==)\s*1\s*\)\s*\{/.exec(nameGenSource);
  if (ifMatch === null)
    return {
      error: "no gender branch found (tp === 1 condition not detected)",
    };

  const ifOpen = ifMatch.index + ifMatch[0].length - 1;
  const ifClose = findMatchingBrace(nameGenSource, ifOpen);
  if (ifClose === -1) return { error: "unbalanced braces in if branch" };
  const femaleBody = nameGenSource.slice(ifOpen + 1, ifClose);

  const rest = nameGenSource.slice(ifClose + 1).trimStart();
  if (/^else\s+if\s*\(/.test(rest)) {
    return { error: "more than two gender branches (else if present)" };
  }
  const elseMatch = /^else\s*\{/.exec(rest);
  if (elseMatch === null)
    return { error: "no else branch found for gender split" };
  const elseOpenOffset =
    nameGenSource.indexOf(elseMatch[0], ifClose + 1) + elseMatch[0].length - 1;
  const elseClose = findMatchingBrace(nameGenSource, elseOpenOffset);
  if (elseClose === -1) return { error: "unbalanced braces in else branch" };
  const maleBody = nameGenSource.slice(elseOpenOffset + 1, elseClose);

  const trailing = nameGenSource.slice(elseClose + 1);
  if (/\belse\s+if\s*\(/.test(trailing.split(/\bfor\s*\(/)[0] ?? "")) {
    return { error: "more than two gender branches (else if present)" };
  }
  if (/\bwhile\s*\(/.test(femaleBody) || /\bwhile\s*\(/.test(maleBody)) {
    return { error: "re-roll loop (while) present in gender branch" };
  }

  return { femaleBody, maleBody };
}

function extractPrecomputedVariables(
  nameGenSource: string,
): Map<string, string> {
  const variables = new Map<string, string>();
  const pattern = /\bvar\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(nameGenSource)) !== null) {
    const [, name, expr] = match;
    if (name === undefined || expr === undefined) continue;
    if (name === "tp" || name === "br" || name === "element") continue;
    if (/^nm\d+\[/.test(expr.trim())) {
      variables.set(name, expr.trim());
    } else if (
      /^[A-Za-z_]\w*(\s*\+\s*[A-Za-z_]\w*\[\w+\]|\s*\+\s*["'])+/.test(
        expr.trim(),
      )
    ) {
      variables.set(name, expr.trim());
    }
  }
  return variables;
}

function tokenizeAssignedExpression(
  branchBody: string,
  variables: Map<string, string>,
): { tokens: NamePatternElement[] } | { error: string } {
  const assignMatch = /\bnames\s*=\s*([^;]+);/.exec(branchBody);
  if (assignMatch === null)
    return { error: "no names = <expr> assignment found" };
  const expr = assignMatch[1];
  if (expr === undefined)
    return { error: "no names = <expr> assignment found" };

  if (/\?|while\s*\(|\.\w+\s*\(/.test(expr)) {
    return { error: `unsupported expression construct: ${expr.trim()}` };
  }

  return tokenizeExpression(expr, variables, new Set());
}

function tokenizeExpression(
  expr: string,
  variables: Map<string, string>,
  seen: Set<string>,
): { tokens: NamePatternElement[] } | { error: string } {
  const rawTokens = splitTopLevelPlus(expr);
  const tokens: NamePatternElement[] = [];
  for (const raw of rawTokens) {
    const token = raw.trim();
    const stringMatch = /^(["'])([\s\S]*)\1$/.exec(token);
    if (stringMatch !== null) {
      const literal = stringMatch[2];
      if (literal === undefined)
        return { error: `malformed string literal: ${token}` };
      tokens.push(literal);
      continue;
    }
    const listMatch = /^(nm\d+)\[\w+\]$/.exec(token);
    if (listMatch !== null) {
      const listKey = listMatch[1];
      if (listKey === undefined)
        return { error: `malformed list reference: ${token}` };
      tokens.push([listKey]);
      continue;
    }
    const identMatch = /^[A-Za-z_]\w*$/.exec(token);
    if (identMatch !== null) {
      if (seen.has(token))
        return { error: `circular variable reference: ${token}` };
      const resolved = variables.get(token);
      if (resolved === undefined)
        return { error: `unresolvable identifier: ${token}` };
      const nested = tokenizeExpression(
        resolved,
        variables,
        new Set([...seen, token]),
      );
      if ("error" in nested) return nested;
      tokens.push(...nested.tokens);
      continue;
    }
    return { error: `unsupported expression fragment: ${token}` };
  }
  return { tokens };
}

function splitTopLevelPlus(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    if (quote !== null) {
      current += char;
      if (char === quote && expr[i - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "[" || char === "(") depth++;
    if (char === "]" || char === ")") depth--;
    if (char === "+" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

function splitGivenAndSurname(tokens: NamePatternElement[]): {
  given: NamePatternElement[];
  surname: NamePatternElement[];
} {
  let separatorIndex = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (typeof token === "string" && /^\s+$/.test(token)) {
      separatorIndex = i;
      break;
    }
  }
  if (separatorIndex === -1) return { given: tokens, surname: [] };
  return {
    given: tokens.slice(0, separatorIndex),
    surname: tokens.slice(separatorIndex + 1),
  };
}
