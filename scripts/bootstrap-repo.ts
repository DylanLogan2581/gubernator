#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_SOURCE_REPO = "DylanLogan2581/web-application-template";
const TEMPLATE_REPO_NAME = "web-application-template";
const TEMPLATE_USER_LOGIN = "DylanLogan2581";

type BootstrapOptions = {
  help?: boolean;
  maintainer?: string;
  repo?: string;
  source?: string;
};

type CommandResult = {
  status: number;
  stderr: string;
  stdout: string;
};

type FeatureToggle = {
  enabled: boolean;
};

type PullRequestReviews = {
  dismiss_stale_reviews: boolean;
  require_code_owner_reviews: boolean;
  require_last_push_approval: boolean;
  required_approving_review_count: number;
};

type BranchProtection = {
  allow_deletions: FeatureToggle;
  allow_force_pushes: FeatureToggle;
  block_creations: FeatureToggle;
  enforce_admins: FeatureToggle;
  lock_branch: FeatureToggle;
  required_conversation_resolution: FeatureToggle;
  required_linear_history: FeatureToggle;
  required_pull_request_reviews: PullRequestReviews | null;
  required_status_checks: {
    contexts: string[];
    strict: boolean;
  } | null;
};

type Autolink = {
  is_alphanumeric: boolean;
  key_prefix: string;
  url_template: string;
};

type SecuritySetting = {
  status: string;
};

type SecurityAndAnalysis = Record<string, SecuritySetting>;

type RepositoryDetails = {
  allow_auto_merge: boolean;
  allow_merge_commit: boolean;
  allow_rebase_merge: boolean;
  allow_squash_merge: boolean;
  allow_update_branch: boolean;
  default_branch: string;
  delete_branch_on_merge: boolean;
  has_discussions?: boolean;
  has_issues: boolean;
  has_projects: boolean;
  has_wiki: boolean;
  security_and_analysis?: SecurityAndAnalysis;
  web_commit_signoff_required?: boolean;
};

type RewriteTemplateReferencesOptions = {
  maintainerLogin: string;
  normalizedRepoName: string;
};

type JsonObject = Record<string, unknown>;

function main(): void {
  const options = parseArguments(process.argv.slice(2));

  if (options.help === true) {
    printHelp();
    return;
  }

  ensureCommand("git");
  ensureCommand("gh");

  const targetRepo = options.repo ?? inferTargetRepo();
  const sourceRepo = options.source ?? DEFAULT_SOURCE_REPO;
  const maintainerLogin = options.maintainer ?? getAuthenticatedGitHubLogin();
  const targetRepoName = targetRepo.split("/")[1];
  const normalizedRepoName = normalizeRepositoryName(targetRepoName);

  logStep(`Bootstrapping ${targetRepo} from ${sourceRepo}`);
  logInfo(
    `Using GitHub maintainer login ${maintainerLogin} for local owner references.`,
  );

  const sourceRepository = getRepositoryDetails(sourceRepo);
  const sourceBranchProtection = getBranchProtection(
    sourceRepo,
    sourceRepository.default_branch,
  );
  const sourceVulnerabilityAlertsEnabled = isFeatureEnabled(
    `repos/${sourceRepo}/vulnerability-alerts`,
  );
  const sourceAutomatedSecurityFixesEnabled = isFeatureEnabled(
    `repos/${sourceRepo}/automated-security-fixes`,
  );
  const sourceAutolinks = getAutolinks(sourceRepo);

  applyRepositorySettings(targetRepo, sourceRepository);
  applySecurityFeatures(targetRepo, sourceRepository.security_and_analysis);
  syncVulnerabilityAlerts(targetRepo, sourceVulnerabilityAlertsEnabled);
  syncAutomatedSecurityFixes(targetRepo, sourceAutomatedSecurityFixesEnabled);
  syncLabels(sourceRepo, targetRepo);
  syncAutolinks(targetRepo, sourceAutolinks);
  syncBranchProtection(
    targetRepo,
    sourceRepository.default_branch,
    sourceBranchProtection,
  );
  rewriteTemplateReferences({
    maintainerLogin,
    normalizedRepoName,
  });

  logSuccess("Bootstrap complete.");
}

function parseArguments(args: string[]): BootstrapOptions {
  const options: BootstrapOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (argument.startsWith("--source=")) {
      options.source = argument.slice("--source=".length);
      continue;
    }

    if (argument === "--source") {
      options.source = getRequiredArgumentValue(args, index, "--source");
      index += 1;
      continue;
    }

    if (argument.startsWith("--repo=")) {
      options.repo = argument.slice("--repo=".length);
      continue;
    }

    if (argument === "--repo") {
      options.repo = getRequiredArgumentValue(args, index, "--repo");
      index += 1;
      continue;
    }

    if (argument.startsWith("--maintainer=")) {
      options.maintainer = argument.slice("--maintainer=".length);
      continue;
    }

    if (argument === "--maintainer") {
      options.maintainer = getRequiredArgumentValue(
        args,
        index,
        "--maintainer",
      );
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function getRequiredArgumentValue(
  args: string[],
  index: number,
  flag: string,
): string {
  const value = args[index + 1];

  if (value === undefined || value.length === 0 || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function printHelp(): void {
  process.stdout.write(`Bootstrap a repo created from this template.

Usage:
  npm run bootstrap:repo
  npm run bootstrap:repo -- --repo OWNER/REPO
  npm run bootstrap:repo -- --source OWNER/TEMPLATE --repo OWNER/REPO

Options:
  --repo         Explicit target repository in OWNER/REPO format.
  --source       Template repository to copy GitHub settings from.
  --maintainer   GitHub login to write into local maintainer references.
  --help, -h     Show this message.

Notes:
  - Requires gh auth with admin access to the target repository.
  - If --repo is omitted, the script infers it from the origin remote.
`);
}

function ensureCommand(command: string): void {
  try {
    execFileSync("bash", ["-lc", `command -v ${command}`], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "ignore",
    });
  } catch {
    throw new Error(`Required command not found: ${command}`);
  }
}

function inferTargetRepo(): string {
  const remoteUrl = runCommand("git", ["remote", "get-url", "origin"]).trim();
  const parsedRepository = parseRepositoryFromRemoteUrl(remoteUrl);

  if (parsedRepository === null) {
    throw new Error(
      "Could not infer the target repository from origin. Pass --repo OWNER/REPO explicitly.",
    );
  }

  return parsedRepository;
}

function parseRepositoryFromRemoteUrl(remoteUrl: string): string | null {
  const patterns = [
    /^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/,
    /^git@github\.com:(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/,
    /^ssh:\/\/git@github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/,
  ];

  for (const pattern of patterns) {
    const match = remoteUrl.match(pattern);
    const owner = match?.groups?.owner;
    const repo = match?.groups?.repo;

    if (
      owner !== undefined &&
      owner.length > 0 &&
      repo !== undefined &&
      repo.length > 0
    ) {
      return `${owner}/${repo}`;
    }
  }

  return null;
}

function getAuthenticatedGitHubLogin(): string {
  try {
    return ghApiText(["api", "user", "--jq", ".login"]).trim();
  } catch (error) {
    throw new Error(
      [
        "gh authentication is required before bootstrapping.",
        "Run `gh auth login -h github.com` and try again.",
        `Original error: ${formatError(error)}`,
      ].join(" "),
      { cause: error },
    );
  }
}

function getRepositoryDetails(repository: string): RepositoryDetails {
  const output = ghApiText(["api", `repos/${repository}`]);
  return JSON.parse(output) as RepositoryDetails;
}

function getBranchProtection(
  repository: string,
  branch: string,
): BranchProtection | null {
  const result = runCommandResult("gh", [
    "api",
    `repos/${repository}/branches/${branch}/protection`,
  ]);

  if (result.status === 0) {
    return JSON.parse(result.stdout) as BranchProtection;
  }

  if (isNotFoundResult(result)) {
    return null;
  }

  throw new Error(
    `Failed to read branch protection for ${repository}:${branch}: ${result.stderr}`,
  );
}

function getAutolinks(repository: string): Autolink[] {
  const output = ghApiText(["api", `repos/${repository}/autolinks`]);
  return JSON.parse(output) as Autolink[];
}

function isFeatureEnabled(endpoint: string): boolean {
  const result = runCommandResult("gh", ["api", "-i", endpoint]);

  if (result.status === 0) {
    return /^HTTP\/[0-9.]+ (?:200|204)\b/m.test(result.stdout);
  }

  if (isNotFoundResult(result)) {
    return false;
  }

  throw new Error(`Failed to inspect ${endpoint}: ${result.stderr}`);
}

function applyRepositorySettings(
  targetRepository: string,
  sourceRepository: RepositoryDetails,
): void {
  logStep("Applying repository settings");

  const arguments_ = [
    "repo",
    "edit",
    targetRepository,
    "--default-branch",
    sourceRepository.default_branch,
    `--enable-auto-merge=${sourceRepository.allow_auto_merge}`,
    `--enable-discussions=${Boolean(sourceRepository.has_discussions)}`,
    `--enable-issues=${sourceRepository.has_issues}`,
    `--enable-merge-commit=${sourceRepository.allow_merge_commit}`,
    `--enable-projects=${sourceRepository.has_projects}`,
    `--enable-rebase-merge=${sourceRepository.allow_rebase_merge}`,
    `--enable-squash-merge=${sourceRepository.allow_squash_merge}`,
    `--enable-wiki=${sourceRepository.has_wiki}`,
    `--allow-update-branch=${sourceRepository.allow_update_branch}`,
    `--delete-branch-on-merge=${sourceRepository.delete_branch_on_merge}`,
  ];

  runCommand("gh", arguments_);

  const apiPayload: JsonObject = {
    web_commit_signoff_required: Boolean(
      sourceRepository.web_commit_signoff_required,
    ),
  };

  ghApiWithBody("PATCH", `repos/${targetRepository}`, apiPayload);
}

function applySecurityFeatures(
  targetRepository: string,
  securityAndAnalysis?: SecurityAndAnalysis,
): void {
  if (
    securityAndAnalysis === undefined ||
    Object.keys(securityAndAnalysis).length === 0
  ) {
    return;
  }

  logStep("Applying code security settings");

  for (const [settingName, settingValue] of Object.entries(
    securityAndAnalysis,
  )) {
    try {
      ghApiWithBody("PATCH", `repos/${targetRepository}`, {
        security_and_analysis: {
          [settingName]: settingValue,
        },
      });
    } catch (error) {
      logWarn(
        [
          `Could not apply security setting ${settingName}.`,
          "This usually means the target repo plan or permissions do not support that feature.",
          formatError(error),
        ].join(" "),
      );
    }
  }
}

function syncVulnerabilityAlerts(
  targetRepository: string,
  isEnabled: boolean,
): void {
  logStep(`${isEnabled ? "Enabling" : "Disabling"} vulnerability alerts`);
  runCommand("gh", [
    "api",
    "-X",
    isEnabled ? "PUT" : "DELETE",
    `repos/${targetRepository}/vulnerability-alerts`,
  ]);
}

function syncAutomatedSecurityFixes(
  targetRepository: string,
  isEnabled: boolean,
): void {
  logStep(`${isEnabled ? "Enabling" : "Disabling"} automated security fixes`);
  runCommand("gh", [
    "api",
    "-X",
    isEnabled ? "PUT" : "DELETE",
    `repos/${targetRepository}/automated-security-fixes`,
  ]);
}

function syncLabels(sourceRepository: string, targetRepository: string): void {
  logStep("Syncing labels");
  runCommand("gh", [
    "label",
    "clone",
    sourceRepository,
    "--repo",
    targetRepository,
    "--force",
  ]);
}

function syncAutolinks(targetRepository: string, autolinks: Autolink[]): void {
  if (autolinks.length === 0) {
    logInfo("No autolinks configured in the template repository.");
    return;
  }

  logStep("Syncing autolinks");

  for (const autolink of autolinks) {
    const payload: JsonObject = {
      is_alphanumeric: autolink.is_alphanumeric,
      key_prefix: autolink.key_prefix,
      url_template: autolink.url_template,
    };

    try {
      ghApiWithBody("POST", `repos/${targetRepository}/autolinks`, payload);
    } catch (error) {
      if (formatError(error).includes("already_exists")) {
        continue;
      }

      throw error;
    }
  }
}

function syncBranchProtection(
  targetRepository: string,
  branch: string,
  branchProtection: BranchProtection | null,
): void {
  if (branchProtection === null) {
    logInfo(
      `No branch protection is configured on ${branch} in the template repository.`,
    );
    return;
  }

  logStep(`Syncing branch protection for ${branch}`);

  const pullRequestReviews =
    branchProtection.required_pull_request_reviews !== null
      ? {
          dismiss_stale_reviews:
            branchProtection.required_pull_request_reviews
              .dismiss_stale_reviews,
          require_code_owner_reviews:
            branchProtection.required_pull_request_reviews
              .require_code_owner_reviews,
          require_last_push_approval:
            branchProtection.required_pull_request_reviews
              .require_last_push_approval,
          required_approving_review_count:
            branchProtection.required_pull_request_reviews
              .required_approving_review_count,
        }
      : null;

  const payload: JsonObject = {
    allow_deletions: branchProtection.allow_deletions.enabled,
    allow_force_pushes: branchProtection.allow_force_pushes.enabled,
    block_creations: branchProtection.block_creations.enabled,
    enforce_admins: branchProtection.enforce_admins.enabled,
    lock_branch: branchProtection.lock_branch.enabled,
    required_conversation_resolution:
      branchProtection.required_conversation_resolution.enabled,
    required_linear_history: branchProtection.required_linear_history.enabled,
    required_pull_request_reviews: pullRequestReviews,
    required_status_checks:
      branchProtection.required_status_checks !== null
        ? {
            contexts: branchProtection.required_status_checks.contexts,
            strict: branchProtection.required_status_checks.strict,
          }
        : null,
    restrictions: null,
  };

  try {
    ghApiWithBody(
      "PUT",
      `repos/${targetRepository}/branches/${branch}/protection`,
      payload,
    );
  } catch (error) {
    throw new Error(
      [
        `Failed to sync branch protection for ${targetRepository}:${branch}.`,
        formatError(error),
        `Payload: ${JSON.stringify(payload)}`,
      ].join(" "),
      { cause: error },
    );
  }
}

function rewriteTemplateReferences({
  maintainerLogin,
  normalizedRepoName,
}: RewriteTemplateReferencesOptions): void {
  logStep("Updating local template references");

  replaceAllInFile(".github/CODEOWNERS", /@[\w-]+/g, `@${maintainerLogin}`);
  replaceAllInFile(
    "SECURITY.md",
    new RegExp(`https://github\\.com/${TEMPLATE_USER_LOGIN}`, "g"),
    `https://github.com/${maintainerLogin}`,
  );
  replaceFirstInFile(
    "package.json",
    /"name": "[^"]+"/,
    `"name": "${normalizedRepoName}"`,
  );
  replaceFirstInFile(
    "package-lock.json",
    /^[ ]{2}"name": "[^"]+"/m,
    `"name": "${normalizedRepoName}"`,
  );
  replaceFirstInFile(
    "package-lock.json",
    /^[ ]{6}"name": "[^"]+"/m,
    `"name": "${normalizedRepoName}"`,
  );
  replaceFirstInFile(
    "supabase/config.toml",
    /^project_id = ".*"$/m,
    `project_id = "${normalizedRepoName}"`,
  );
  replaceAllInFile(
    "SECURITY.md",
    new RegExp(TEMPLATE_USER_LOGIN, "g"),
    maintainerLogin,
  );
  replaceAllInFile(
    "package.json",
    new RegExp(TEMPLATE_REPO_NAME, "g"),
    normalizedRepoName,
  );
  replaceAllInFile(
    "package-lock.json",
    new RegExp(TEMPLATE_REPO_NAME, "g"),
    normalizedRepoName,
  );
  replaceAllInFile(
    "supabase/config.toml",
    new RegExp(TEMPLATE_REPO_NAME, "g"),
    normalizedRepoName,
  );
}

function replaceFirstInFile(
  filePath: string,
  pattern: RegExp,
  replacement: string,
): void {
  let fileContents: string;

  try {
    fileContents = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }

    throw error;
  }

  const updatedContents = fileContents.replace(pattern, replacement);

  if (updatedContents !== fileContents) {
    fs.writeFileSync(filePath, updatedContents);
  }
}

function replaceAllInFile(
  filePath: string,
  pattern: RegExp,
  replacement: string,
): void {
  let fileContents: string;

  try {
    fileContents = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }

    throw error;
  }

  const updatedContents = fileContents.replaceAll(pattern, replacement);

  if (updatedContents !== fileContents) {
    fs.writeFileSync(filePath, updatedContents);
  }
}

function normalizeRepositoryName(repositoryName: string): string {
  const normalized = repositoryName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length === 0) {
    throw new Error(
      `Could not derive a valid local name from repository ${repositoryName}`,
    );
  }

  return normalized;
}

function ghApiWithBody(
  method: string,
  endpoint: string,
  body: JsonObject,
): void {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "repo-bootstrap-"),
  );
  const inputPath = path.join(temporaryDirectory, "body.json");

  fs.writeFileSync(inputPath, JSON.stringify(body, null, 2));

  try {
    runCommand("gh", ["api", "-X", method, endpoint, "--input", inputPath]);
  } finally {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

function ghApiText(args: string[]): string {
  return runCommand("gh", args);
}

function runCommand(command: string, args: string[]): string {
  const result = runCommandResult(command, args);

  if (result.status !== 0) {
    const errorMessage =
      result.stderr.length > 0
        ? result.stderr
        : result.stdout.length > 0
          ? result.stdout
          : `${command} exited with status ${result.status}`;
    throw new Error(errorMessage);
  }

  return result.stdout;
}

function runCommandResult(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const errorMessage =
    result.error !== undefined ? result.error.message : undefined;
  const stderr = result.stderr ?? "";

  return {
    status: result.status ?? (result.error !== undefined ? 1 : 0),
    stderr:
      errorMessage !== undefined ? `${stderr}\n${errorMessage}`.trim() : stderr,
    stdout: result.stdout ?? "",
  };
}

function isNotFoundResult(result: CommandResult): boolean {
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  return /\b404\b/.test(combinedOutput) || /Not Found/i.test(combinedOutput);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function logStep(message: string): void {
  process.stdout.write(`\n[bootstrap] ${message}\n`);
}

function logInfo(message: string): void {
  process.stdout.write(`[bootstrap] ${message}\n`);
}

function logWarn(message: string): void {
  process.stderr.write(`[bootstrap] Warning: ${message}\n`);
}

function logSuccess(message: string): void {
  process.stdout.write(`[bootstrap] ${message}\n`);
}

main();
