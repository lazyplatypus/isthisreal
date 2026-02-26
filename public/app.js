let state = {
  repoPath: "",
  author: "",
  commits: [],
  resultMarkdown: "",
};

function show(id) {
  document.getElementById(id).classList.remove("hidden");
}

function hide(id) {
  document.getElementById(id).classList.add("hidden");
}

function showError(parentId, message) {
  const existing = document.querySelector(`#${parentId} .error`);
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = "error";
  el.textContent = message;
  document.getElementById(parentId).appendChild(el);
}

function clearErrors(parentId) {
  document.querySelectorAll(`#${parentId} .error`).forEach((e) => e.remove());
}

async function loadRepo() {
  const input = document.getElementById("repo-path");
  const btn = document.getElementById("btn-load-repo");
  const repoPath = input.value.trim();

  if (!repoPath) return;

  clearErrors("step-repo");
  btn.disabled = true;
  btn.textContent = "Loading...";

  try {
    const res = await fetch("/api/authors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoPath }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError("step-repo", data.error);
      return;
    }

    state.repoPath = data.repoPath;

    const list = document.getElementById("author-list");
    list.innerHTML = "";
    data.authors.forEach((author) => {
      const btn = document.createElement("button");
      btn.className = "author-btn";
      btn.textContent = author;
      btn.onclick = () => selectAuthor(author);
      list.appendChild(btn);
    });

    show("step-author");
    hide("step-commits");
    hide("step-results");
  } catch (err) {
    showError("step-repo", "Failed to connect to server: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Load";
  }
}

async function selectAuthor(author) {
  state.author = author;

  document.querySelectorAll(".author-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.textContent === author);
  });

  clearErrors("step-author");

  try {
    const res = await fetch("/api/commits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoPath: state.repoPath, author }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError("step-author", data.error);
      return;
    }

    state.commits = data.commits;

    const info = document.getElementById("commit-info");
    const recent = data.commits.slice(0, 20);
    const dateRange =
      data.commits.length > 0
        ? `${data.commits[data.commits.length - 1].date.split("T")[0]} to ${data.commits[0].date.split("T")[0]}`
        : "N/A";

    info.innerHTML = `
      <strong>${data.total}</strong> commits by <strong>${author}</strong><br>
      Date range: ${dateRange}
      <div class="commit-list">
        ${recent
          .map(
            (c) =>
              `<div class="commit-item">
                <span class="hash">${c.hash.slice(0, 7)}</span>
                <span class="date">${c.date.split("T")[0]}</span>
                <span class="msg">${escapeHtml(c.message)}</span>
              </div>`
          )
          .join("")}
        ${data.total > 20 ? `<div style="padding:8px 0;color:#666;">...and ${data.total - 20} more</div>` : ""}
      </div>
    `;

    show("step-commits");
    hide("step-results");
  } catch (err) {
    showError("step-author", err.message);
  }
}

function runAnalysis() {
  const btn = document.getElementById("btn-analyze");
  btn.disabled = true;
  btn.textContent = "Analyzing...";

  show("step-results");
  hide("result-area");
  document.getElementById("progress-area").classList.remove("hidden");
  document.getElementById("progress-bar").style.width = "0%";
  document.getElementById("progress-text").innerHTML =
    '<span class="spinner"></span>Starting analysis...';

  const body = JSON.stringify({
    repoPath: state.repoPath,
    author: state.author,
    existingSkills: document.getElementById("existing-skills").value.trim(),
  });

  fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).then((response) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    function processChunk({ done, value }) {
      if (done) {
        btn.disabled = false;
        btn.textContent = "Analyze Commits";
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      let eventType = null;
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7);
        } else if (line.startsWith("data: ") && eventType) {
          try {
            const data = JSON.parse(line.slice(6));
            handleSSE(eventType, data);
          } catch {}
          eventType = null;
        }
      }

      reader.read().then(processChunk);
    }

    reader.read().then(processChunk);
  }).catch((err) => {
    showError("step-results", "Connection error: " + err.message);
    btn.disabled = false;
    btn.textContent = "Analyze Commits";
  });
}

function handleSSE(event, data) {
  const bar = document.getElementById("progress-bar");
  const text = document.getElementById("progress-text");

  switch (event) {
    case "status":
      text.innerHTML = `<span class="spinner"></span>${escapeHtml(data.message)}`;
      break;
    case "progress":
      const pct = Math.round((data.current / data.total) * 100);
      bar.style.width = pct + "%";
      if (data.step === "diffs") {
        text.innerHTML = `<span class="spinner"></span>Extracting diffs: ${data.current}/${data.total}`;
      } else if (data.step === "llm") {
        text.innerHTML = `<span class="spinner"></span>LLM analysis: batch ${data.current}/${data.total}`;
      }
      break;
    case "result":
      bar.style.width = "100%";
      text.textContent = "Done!";
      state.resultMarkdown = data.skills;
      document.getElementById("skills-output").textContent = data.skills;
      show("result-area");
      break;
    case "error":
      text.textContent = "";
      showError("step-results", data.message);
      break;
  }
}

function copyResult() {
  navigator.clipboard.writeText(state.resultMarkdown).then(() => {
    const btn = event.target;
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = orig), 1500);
  });
}

function downloadResult() {
  const blob = new Blob([state.resultMarkdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "skills.md";
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Allow Enter key in repo input
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("repo-path").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadRepo();
  });
});
