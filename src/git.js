const { execSync } = require("child_process");
const path = require("path");

/**
 * Get all commits from a specific user in a repo.
 * Returns an array of { hash, date, message }.
 */
function getCommitsByUser(repoPath, username) {
  return getCommitsFiltered(repoPath, { author: username });
}

/**
 * Get commits with flexible filtering by author and/or branch.
 * Returns an array of { hash, date, message, author }.
 */
function getCommitsFiltered(repoPath, filters = {}) {
  const absolutePath = path.resolve(repoPath);
  const args = [];

  if (filters.author) {
    args.push(`--author="${filters.author}"`);
  }
  if (filters.branch) {
    args.push(filters.branch);
  }

  const log = execSync(
    `git -C "${absolutePath}" log ${args.join(" ")} --pretty=format:"%H||%aI||%s||%aN" --no-merges`,
    { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
  );

  if (!log.trim()) return [];

  return log
    .trim()
    .split("\n")
    .map((line) => {
      const [hash, date, message, author] = line.split("||");
      return { hash, date, message, author };
    });
}

/**
 * Get the diff for a specific commit.
 */
function getDiffForCommit(repoPath, commitHash) {
  const absolutePath = path.resolve(repoPath);
  try {
    return execSync(
      `git -C "${absolutePath}" diff-tree -p ${commitHash}`,
      { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
    );
  } catch {
    return "";
  }
}

/**
 * List all authors in a repo.
 */
function listAuthors(repoPath) {
  const absolutePath = path.resolve(repoPath);
  const output = execSync(
    `git -C "${absolutePath}" log --pretty=format:"%aN" | sort -u`,
    { encoding: "utf-8", shell: true }
  );
  return output.trim().split("\n").filter(Boolean);
}

/**
 * List all branches (local + remote tracking) in a repo.
 */
function listBranches(repoPath) {
  const absolutePath = path.resolve(repoPath);
  const output = execSync(
    `git -C "${absolutePath}" branch -a --format="%(refname:short)"`,
    { encoding: "utf-8" }
  );
  return output.trim().split("\n").filter(Boolean);
}

module.exports = { getCommitsByUser, getCommitsFiltered, getDiffForCommit, listAuthors, listBranches };
