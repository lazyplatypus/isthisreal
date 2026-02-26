const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");

const MAX_DIFF_CHARS = 80000;

const ANTHROPIC_MODELS = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
  { id: "claude-opus-4-20250514", name: "Claude Opus 4" },
];

const OPENAI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "gpt-4.1", name: "GPT-4.1" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
  { id: "o3-mini", name: "o3-mini" },
];

function truncateDiff(diff, maxChars = MAX_DIFF_CHARS) {
  if (diff.length <= maxChars) return diff;
  return diff.slice(0, maxChars) + "\n... [truncated]";
}

async function chatComplete(provider, apiKey, model, prompt) {
  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    return response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }

  // OpenAI
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0].message.content;
}

/**
 * Build a single combined summary of all diffs, then use it to update skills.md.
 */
async function analyzeAndUpdateSkills(commits, diffs, existingSkills, options = {}) {
  const provider = options.provider || "anthropic";
  const apiKey = options.apiKey;
  const model = options.model || (provider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o");

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
  const onBatchComplete = options.onBatchComplete || (() => {});

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batchContent = batches[bIdx].join("\n\n---\n\n");

    const analysisPrompt = `You are analyzing a developer's git commits to identify their skills, technologies used, and areas of expertise.

Here are the commits and their diffs:

${batchContent}

Provide a structured analysis of:
1. **Languages & Frameworks** used
2. **Tools & Platforms** (databases, cloud services, CI/CD, etc.)
3. **Technical Skills** demonstrated (architecture patterns, testing, security, etc.)
4. **Domain Knowledge** shown (web dev, data engineering, ML, DevOps, etc.)
5. **Key Contributions** - notable things the developer built or fixed

Be specific and cite evidence from the diffs. Output as structured markdown.`;

    const result = await chatComplete(provider, apiKey, model, analysisPrompt);
    skillsAnalysis += result + "\n\n";

    onBatchComplete(bIdx + 1, batches.length);
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

  return chatComplete(provider, apiKey, model, updatePrompt);
}

module.exports = { analyzeAndUpdateSkills, ANTHROPIC_MODELS, OPENAI_MODELS };
