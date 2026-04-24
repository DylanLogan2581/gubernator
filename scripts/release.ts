import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

function runInherit(command: string): void {
  execSync(command, { stdio: "inherit" });
}

function getCurrentBranch(): string {
  return execSync("git rev-parse --abbrev-ref HEAD", { stdio: "pipe" })
    .toString()
    .trim();
}

function assertOnMainBranch(): void {
  const branch = getCurrentBranch();

  if (branch !== "main") {
    throw new Error(
      `Releases must be run from the main branch. Currently on: ${branch}`,
    );
  }
}

function buildReleaseCommand(): string {
  const commandParts = ["npx semantic-release", "--no-ci"];

  if (isDryRun) {
    commandParts.push("--dry-run");
  }

  return commandParts.join(" ");
}

const releaseCommand = buildReleaseCommand();
assertOnMainBranch();
runInherit(releaseCommand);
