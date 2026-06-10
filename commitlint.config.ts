import type { SyncRule, UserConfig } from "@commitlint/types";

// Forbid Co-Authored-By trailers. Commits are authored solely by the human
// committer; AI assistance is not credited as a co-author.
const noCoauthors: SyncRule = (parsed) => {
  const hasCoauthor = /^[ \t]*co-authored-by:/im.test(parsed.raw ?? "");
  return [
    !hasCoauthor,
    "Co-Authored-By trailers are not allowed in commit messages.",
  ];
};

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  plugins: [{ rules: { "no-coauthors": noCoauthors } }],
  rules: {
    "no-coauthors": [2, "always"],
    "body-leading-blank": [2, "always"],
    "body-max-line-length": [2, "always", 100],
    "footer-leading-blank": [2, "always"],
    "footer-max-line-length": [2, "always", 100],
    "header-max-length": [2, "always", 72],
    "scope-case": [2, "always", "lower-case"],
    "scope-enum": [
      2,
      "always",
      [
        // Gubernator feature domains
        "auth",
        "worlds",
        "turns",
        "calendar",
        "permissions",
        "nations",
        "settlements",
        "citizens",
        "resources",
        "jobs",
        "buildings",
        "deposits",
        "managed-populations",
        "trade",
        "events",
        "notifications",
        "reports",
        "templates",
        // General scopes
        "app",
        "ci",
        "config",
        "deps",
        "docs",
        "github",
        "home",
        "repo",
        "supabase",
        "testing",
        "tooling",
      ],
    ],
    "scope-empty": [2, "never"],
    "subject-case": [2, "always", "lower-case"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "perf",
        "refactor",
        "revert",
        "style",
        "test",
      ],
    ],
  },
};

export default config;
