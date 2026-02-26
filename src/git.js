const { execSync } = require("child_process");
const path = require("path");

/**
 * Get all commits from a specific user in a repo.
 * Returns an array of { hash, date, message }.
 */
function getCommitsByUser(repoPath, username) {
  const absolutePath = path.resolve(repoPath);
  const log = execSync(
    `git -C "${absolutePath}" log --author="${username}" --pretty=format:"%H||%aI||%s" --no-merges`,
    { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
  );

  if (!log.trim()) return [];

  return log
    .trim()
    .split("\n")
    .map((line) => {
      const [hash, date, message] = line.split("||");
      return { hash, date, message };
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
 * List all authors in a repo (for discovery/validation).
 */
function listAuthors(repoPath) {
  const absolutePath = path.resolve(repoPath);
  const output = execSync(
    `git -C "${absolutePath}" log --pretty=format:"%aN" | sort -u`,
    { encoding: "utf-8", shell: true }
  );
  return output.trim().split("\n").filter(Boolean);
}

module.exports = { getCommitsByUser, getDiffForCommit, listAuthors };
