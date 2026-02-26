let state = {
  repoPath: "",
  authors: [],
  branches: [],
  commits: [],
  resultMarkdown: "",
};

let models = { anthropic: [], openai: [] };

// --- Utility ---

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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Settings ---

function toggleSettings() {
  const body = document.getElementById("settings-body");
  const arrow = document.getElementById("settings-arrow");
  body.classList.toggle("collapsed");
  arrow.classList.toggle("collapsed");
}

function toggleKeyVisibility() {
  const input = document.getElementById("api-key-input");
  const btn = document.getElementById("btn-toggle-key");
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "Hide";
  } else {
    input.type = "password";
    btn.textContent = "Show";
  }
}

function onProviderChange() {
  const provider = document.getElementById("provider-select").value;
  populateModels(provider);
}

function populateModels(provider) {
  const select = document.getElementById("model-select");
  const list = models[provider] || [];
  select.innerHTML = "";
  list.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    select.appendChild(opt);
  });
}

async function loadModels() {
  try {
    const res = await fetch("/api/models");
    models = await res.json();
    populateModels(document.getElementById("provider-select").value);
  } catch {}
}

function getSettings() {
  return {
    provider: document.getElementById("provider-select").value,
    model: document.getElementById("model-select").value,
    apiKey: document.getElementById("api-key-input").value.trim(),
  };
}

// --- Step 1: Load repo ---

async function loadRepo() {
  const input = document.getElementById("repo-path");
  const btn = document.getElementById("btn-load-repo");
  const repoPath = input.value.trim();

  if (!repoPath) return;

  clearErrors("step-repo");
  btn.disabled = true;
  btn.textContent = "Loading...";

  try {
    // Fetch authors and branches in parallel
    const [authorsRes, branchesRes] = await Promise.all([
      fetch("/api/authors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath }),
      }),
      fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath }),
      }),
    ]);

    const authorsData = await authorsRes.json();
    const branchesData = await branchesRes.json();

    if (!authorsRes.ok) {
      showError("step-repo", authorsData.error);
      return;
    }

    state.repoPath = authorsData.repoPath;
    state.authors = authorsData.authors || [];
    state.branches = branchesData.branches || [];

    // Populate filter dropdowns
    const authorSelect = document.getElementById("filter-author");
    authorSelect.innerHTML = '<option value="">All authors</option>';
    state.authors.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a;
      opt.textContent = a;
      authorSelect.appendChild(opt);
    });

    const branchSelect = document.getElementById("filter-branch");
    branchSelect.innerHTML = '<option value="">All branches</option>';
    state.branches.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      branchSelect.appendChild(opt);
    });

    show("step-filter");
    hide("step-analyze");
    hide("step-results");

    // Auto-load commits with no filters
    applyFilters();
  } catch (err) {
    showError("step-repo", "Failed to connect to server: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Load";
  }
}

// --- Step 2: Filter and explore commits ---

async function applyFilters() {
  const author = document.getElementById("filter-author").value;
  const branch = document.getElementById("filter-branch").value;

  clearErrors("step-filter");

  try {
    const res = await fetch("/api/commits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoPath: state.repoPath, author, branch }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError("step-filter", data.error);
      hide("step-analyze");
      return;
    }

    state.commits = data.commits;
    renderCommitInfo(data.commits, author, branch);

    if (data.commits.length > 0) {
      show("step-analyze");
    } else {
      hide("step-analyze");
    }
    hide("step-results");
  } catch (err) {
    showError("step-filter", err.message);
  }
}

function renderCommitInfo(commits, author, branch) {
  const info = document.getElementById("commit-info");

  if (commits.length === 0) {
    info.innerHTML = "<span style='color:#888'>No commits match the current filters.</span>";
    show("commit-info");
    info.classList.remove("hidden");
    return;
  }

  const recent = commits.slice(0, 30);
  const dateRange = `${commits[commits.length - 1].date.split("T")[0]} to ${commits[0].date.split("T")[0]}`;
  const filterDesc = [
    author && `author: <strong>${escapeHtml(author)}</strong>`,
    branch && `branch: <strong>${escapeHtml(branch)}</strong>`,
  ]
    .filter(Boolean)
    .join(", ");

  const showAuthorCol = !author; // show author column if "all authors"

  info.innerHTML = `
    <strong>${commits.length}</strong> commits${filterDesc ? ` matching ${filterDesc}` : ""}<br>
    Date range: ${dateRange}
    <div class="commit-list">
      ${recent
        .map(
          (c) =>
            `<div class="commit-item">
              <span class="hash">${c.hash.slice(0, 7)}</span>
              <span class="date">${c.date.split("T")[0]}</span>
              ${showAuthorCol ? `<span class="author-tag">${escapeHtml(c.author)}</span>` : ""}
              <span class="msg">${escapeHtml(c.message)}</span>
            </div>`
        )
        .join("")}
      ${commits.length > 30 ? `<div style="padding:8px 0;color:#666;">...and ${commits.length - 30} more</div>` : ""}
    </div>
  `;
  info.classList.remove("hidden");
}

// --- Step 3: Run analysis ---

function runAnalysis() {
  const settings = getSettings();

  if (!settings.apiKey) {
    showError("step-analyze", "Please enter an API key in the Settings panel above.");
    return;
  }

  const btn = document.getElementById("btn-analyze");
  btn.disabled = true;
  btn.textContent = "Analyzing...";
  clearErrors("step-analyze");

  show("step-results");
  hide("result-area");
  document.getElementById("progress-area").classList.remove("hidden");
  document.getElementById("progress-bar").style.width = "0%";
  document.getElementById("progress-text").innerHTML =
    '<span class="spinner"></span>Starting analysis...';

  const author = document.getElementById("filter-author").value;
  const branch = document.getElementById("filter-branch").value;

  const body = JSON.stringify({
    repoPath: state.repoPath,
    author: author || undefined,
    branch: branch || undefined,
    existingSkills: document.getElementById("existing-skills").value.trim(),
    provider: settings.provider,
    apiKey: settings.apiKey,
    model: settings.model,
  });

  fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  })
    .then((response) => {
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
    })
    .catch((err) => {
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
    case "progress": {
      const pct = Math.round((data.current / data.total) * 100);
      bar.style.width = pct + "%";
      if (data.step === "diffs") {
        text.innerHTML = `<span class="spinner"></span>Extracting diffs: ${data.current}/${data.total}`;
      } else if (data.step === "llm") {
        text.innerHTML = `<span class="spinner"></span>LLM analysis: batch ${data.current}/${data.total}`;
      }
      break;
    }
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

// --- Result actions ---

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

// --- Init ---

document.addEventListener("DOMContentLoaded", () => {
  loadModels();
  document.getElementById("repo-path").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadRepo();
  });
});
