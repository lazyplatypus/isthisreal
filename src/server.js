const express = require("express");
const path = require("path");
const fs = require("fs");
const { getCommitsByUser, getDiffForCommit, listAuthors } = require("./git");
const { analyzeAndUpdateSkills } = require("./analyzer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

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

// Get commits for an author (preview step)
app.post("/api/commits", (req, res) => {
  const { repoPath, author } = req.body;
  if (!repoPath || !author) {
    return res.status(400).json({ error: "repoPath and author are required" });
  }

  const resolved = path.resolve(repoPath);
  try {
    const commits = getCommitsByUser(resolved, author);
    res.json({ commits, total: commits.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run the full analysis — uses Server-Sent Events for progress
app.post("/api/analyze", (req, res) => {
  const { repoPath, author, existingSkills, model } = req.body;
  if (!repoPath || !author) {
    return res.status(400).json({ error: "repoPath and author are required" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server" });
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
      const commits = getCommitsByUser(resolved, author);

      if (commits.length === 0) {
        send("error", { message: `No commits found for "${author}"` });
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

      send("status", { message: "Sending diffs to LLM for analysis..." });

      const updatedSkills = await analyzeAndUpdateSkills(
        commits,
        diffs,
        existingSkills || "",
        { model, onBatchComplete: (batchNum, totalBatches) => {
            send("progress", { step: "llm", current: batchNum, total: totalBatches });
          }
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
