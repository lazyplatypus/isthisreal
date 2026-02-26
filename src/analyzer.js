const Anthropic = require("@anthropic-ai/sdk");

const MAX_DIFF_CHARS = 80000;

function truncateDiff(diff, maxChars = MAX_DIFF_CHARS) {
  if (diff.length <= maxChars) return diff;
  return diff.slice(0, maxChars) + "\n... [truncated]";
}

/**
 * Build a single combined summary of all diffs, then use it to update skills.md.
 */
async function analyzeAndUpdateSkills(commits, diffs, existingSkills, options = {}) {
  const client = new Anthropic();
  const model = options.model || "claude-sonnet-4-20250514";

  // Build a condensed representation of all commits + diffs
  const commitSummaries = commits.map((commit, i) => {
    const diff = truncateDiff(diffs[i] || "(no diff)");
    return `### Commit: ${commit.message}\nDate: ${commit.date}\nHash: ${commit.hash}\n\n\`\`\`diff\n${diff}\n\`\`\``;
  });

  // Chunk if necessary - process in batches of 20 commits
  const BATCH_SIZE = 20;
  const batches = [];
  for (let i = 0; i < commitSummaries.length; i += BATCH_SIZE) {
    batches.push(commitSummaries.slice(i, i + BATCH_SIZE));
  }

  let skillsAnalysis = "";

  for (const batch of batches) {
    const batchContent = batch.join("\n\n---\n\n");

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are analyzing a developer's git commits to identify their skills, technologies used, and areas of expertise.

Here are the commits and their diffs:

${batchContent}

Provide a structured analysis of:
1. **Languages & Frameworks** used
2. **Tools & Platforms** (databases, cloud services, CI/CD, etc.)
3. **Technical Skills** demonstrated (architecture patterns, testing, security, etc.)
4. **Domain Knowledge** shown (web dev, data engineering, ML, DevOps, etc.)
5. **Key Contributions** - notable things the developer built or fixed

Be specific and cite evidence from the diffs. Output as structured markdown.`,
        },
      ],
    });

    skillsAnalysis +=
      response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n") + "\n\n";
  }

  // Now generate the updated skills.md
  const updatePrompt = existingSkills
    ? `You are updating an existing skills.md file based on new analysis of a developer's git commits.

## Existing skills.md:
${existingSkills}

## New analysis from recent commits:
${skillsAnalysis}

Update the skills.md to incorporate the new findings. Merge new skills with existing ones, don't remove existing skills unless they contradict new evidence. Keep the document well-organized and deduplicated. Output ONLY the updated markdown content for skills.md, nothing else.`
    : `You are creating a skills.md file based on analysis of a developer's git commits.

## Analysis from commits:
${skillsAnalysis}

Create a well-structured skills.md document that captures this developer's skills and expertise. Include sections for:
- Languages & Frameworks
- Tools & Platforms
- Technical Skills
- Domain Knowledge
- Notable Contributions

Output ONLY the markdown content for skills.md, nothing else.`;

  const finalResponse = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: updatePrompt }],
  });

  return finalResponse.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

module.exports = { analyzeAndUpdateSkills };
