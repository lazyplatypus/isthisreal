#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { getCommitsByUser, getDiffForCommit, listAuthors } = require("./git");
const { analyzeAndUpdateSkills } = require("./analyzer");

function parseArgs(argv) {
  const args = { repo: null, user: null, skillsFile: null, model: null, listAuthors: false };
  const raw = argv.slice(2);

  for (let i = 0; i < raw.length; i++) {
    switch (raw[i]) {
      case "--repo":
      case "-r":
        args.repo = raw[++i];
        break;
      case "--user":
      case "-u":
        args.user = raw[++i];
        break;
      case "--skills-file":
      case "-s":
        args.skillsFile = raw[++i];
        break;
      case "--model":
      case "-m":
        args.model = raw[++i];
        break;
      case "--list-authors":
        args.listAuthors = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
    }
  }

  return args;
}

function printUsage() {
  console.log(`
skill-analyzer - Analyze git commits to update a skills.md file

Usage:
  skill-analyzer --repo <path> --user <git-username> [options]

Options:
  -r, --repo <path>          Path to the git repository (required)
  -u, --user <username>      Git author name to filter commits by (required)
  -s, --skills-file <path>   Path to existing skills.md (default: <repo>/skills.md)
  -m, --model <model-id>     Anthropic model to use (default: claude-sonnet-4-20250514)
      --list-authors         List all commit authors in the repo and exit
  -h, --help                 Show this help message

Environment:
  ANTHROPIC_API_KEY          Required. Your Anthropic API key.

Examples:
  # Analyze all commits by "johndoe" and create/update skills.md
  skill-analyzer --repo ./my-project --user "johndoe"

  # Use an existing skills.md as the starting point
  skill-analyzer --repo ./my-project --user "johndoe" --skills-file ./skills.md

  # List all authors in a repo to find the right username
  skill-analyzer --repo ./my-project --list-authors
`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.repo) {
    console.error("Error: --repo is required. Use --help for usage.");
    process.exit(1);
  }

  const repoPath = path.resolve(args.repo);
  if (!fs.existsSync(repoPath)) {
    console.error(`Error: Repository path does not exist: ${repoPath}`);
    process.exit(1);
  }

  // List authors mode
  if (args.listAuthors) {
    const authors = listAuthors(repoPath);
    console.log("Authors in this repository:\n");
    authors.forEach((a) => console.log(`  - ${a}`));
    return;
  }

  if (!args.user) {
    console.error("Error: --user is required. Use --help for usage.");
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set.");
    process.exit(1);
  }

  const skillsPath = args.skillsFile
    ? path.resolve(args.skillsFile)
    : path.join(repoPath, "skills.md");

  // Read existing skills.md if it exists
  let existingSkills = "";
  if (fs.existsSync(skillsPath)) {
    existingSkills = fs.readFileSync(skillsPath, "utf-8");
    console.log(`Found existing skills.md at ${skillsPath}`);
  } else {
    console.log(`No existing skills.md found. Will create a new one at ${skillsPath}`);
  }

  // Get commits
  console.log(`\nFetching commits by "${args.user}" in ${repoPath}...`);
  const commits = getCommitsByUser(repoPath, args.user);

  if (commits.length === 0) {
    console.error(`No commits found for author "${args.user}".`);
    console.log("\nAvailable authors:");
    const authors = listAuthors(repoPath);
    authors.forEach((a) => console.log(`  - ${a}`));
    process.exit(1);
  }

  console.log(`Found ${commits.length} commits.`);

  // Get diffs for each commit
  console.log("Extracting diffs...");
  const diffs = commits.map((commit, i) => {
    if ((i + 1) % 10 === 0 || i === commits.length - 1) {
      process.stdout.write(`  Processing commit ${i + 1}/${commits.length}\r`);
    }
    return getDiffForCommit(repoPath, commit.hash);
  });
  console.log(`\nExtracted diffs for ${diffs.length} commits.`);

  // Analyze with LLM and update skills
  console.log("\nAnalyzing commits with LLM...");
  const updatedSkills = await analyzeAndUpdateSkills(commits, diffs, existingSkills, {
    model: args.model,
  });

  // Write updated skills.md
  fs.writeFileSync(skillsPath, updatedSkills, "utf-8");
  console.log(`\nUpdated skills.md written to ${skillsPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
