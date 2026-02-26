const express = require("express");
const path = require("path");
const fs = require("fs");
const { getCommitsByUser, getDiffForCommit, listAuthors } = require("./git");
const { analyzeAndUpdateSkills, ANTHROPIC_MODELS, OPENAI_MODELS } = require("./analyzer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Return available models for each provider
app.get("/api/models", (req, res) => {
  res.json({
    anthropic: ANTHROPIC_MODELS,
    openai: OPENAI_MODELS,
  });
});

// List authors for a given repo path
app.post("/api/authors", (req, res) => {
  const { repoPath } = req.body;
  if (!repoPath) return res.status(400).json({ error: "repoPath is required" });

  const resolved = path.resolve(repoPath);
  if (!fs.existsSync(resolved)) {
    return res.status(400).json({ error: `Path does not exist: ${resolved}` });
  }

  try {
    const authors = listAuthors(resolved);
    res.json({ authors, repoPath: resolved });
  } catch (err) {
    res.status(500).json({ error: `Not a git repository or git error: ${err.message}` });
  }
});

// List branches for a given repo
app.post("/api/branches", (req, res) => {
  const { repoPath } = req.body;
  if (!repoPath) return res.status(400).json({ error: "repoPath is required" });

  const resolved = path.resolve(repoPath);
  try {
    const { listBranches } = require("./git");
    const branches = listBranches(resolved);
    res.json({ branches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get commits with flexible filtering
app.post("/api/commits", (req, res) => {
  const { repoPath, author, branch } = req.body;
  if (!repoPath) {
    return res.status(400).json({ error: "repoPath is required" });
  }

  const resolved = path.resolve(repoPath);
  try {
    const { getCommitsFiltered } = require("./git");
    const commits = getCommitsFiltered(resolved, { author, branch });
    res.json({ commits, total: commits.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run the full analysis — uses Server-Sent Events for progress
app.post("/api/analyze", (req, res) => {
  const { repoPath, author, branch, existingSkills, provider, apiKey, model } = req.body;
  if (!repoPath) {
    return res.status(400).json({ error: "repoPath is required" });
  }

  const resolvedProvider = provider || "anthropic";
  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;

  if (!resolvedKey) {
    return res.status(400).json({ error: "No API key provided. Enter one in the settings panel." });
  }

  // Set up SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const resolved = path.resolve(repoPath);

  (async () => {
    try {
      send("status", { message: "Fetching commits..." });
      const { getCommitsFiltered } = require("./git");
      const commits = getCommitsFiltered(resolved, { author, branch });

      if (commits.length === 0) {
        const filters = [author && `author "${author}"`, branch && `branch "${branch}"`].filter(Boolean).join(", ");
        send("error", { message: `No commits found for ${filters || "the given filters"}` });
        res.end();
        return;
      }

      send("status", { message: `Found ${commits.length} commits. Extracting diffs...` });

      const diffs = [];
      for (let i = 0; i < commits.length; i++) {
        diffs.push(getDiffForCommit(resolved, commits[i].hash));
        if ((i + 1) % 5 === 0 || i === commits.length - 1) {
          send("progress", {
            step: "diffs",
            current: i + 1,
            total: commits.length,
          });
        }
      }

      send("status", { message: `Sending diffs to ${resolvedProvider === "anthropic" ? "Claude" : "OpenAI"} for analysis...` });

      const updatedSkills = await analyzeAndUpdateSkills(
        commits,
        diffs,
        existingSkills || "",
        {
          provider: resolvedProvider,
          apiKey: resolvedKey,
          model,
          onBatchComplete: (batchNum, totalBatches) => {
            send("progress", { step: "llm", current: batchNum, total: totalBatches });
          },
        }
      );

      send("status", { message: "Analysis complete!" });
      send("result", { skills: updatedSkills });
    } catch (err) {
      send("error", { message: err.message });
    } finally {
      res.end();
    }
  })();
});

app.listen(PORT, () => {
  console.log(`Skill Analyzer running at http://localhost:${PORT}`);
});
