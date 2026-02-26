let state = {
  repoPath: "",
  authors: [],
  branches: [],
  commits: [],
  resultMarkdown: "",
};

let models = { anthropic: [], openai: [] };

// ─── Utility ───

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showCard(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("hidden", "exiting");
  el.classList.add("entering");
  el.addEventListener("animationend", () => el.classList.remove("entering"), { once: true });
}

function hideCard(id) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains("hidden")) return;
  el.classList.add("exiting");
  el.addEventListener("animationend", () => {
    el.classList.add("hidden");
    el.classList.remove("exiting");
  }, { once: true });
}

function show(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

function hide(id) {
  document.getElementById(id)?.classList.add("hidden");
}

function showError(parentId, message) {
  clearErrors(parentId);
  const el = document.createElement("div");
  el.className = "error";
  el.textContent = message;
  document.getElementById(parentId)?.appendChild(el);
}

function clearErrors(parentId) {
  document.querySelectorAll(`#${parentId} .error`).forEach((e) => e.remove());
}

// ─── Settings ───

function toggleSettings() {
  const body = document.getElementById("settings-body");
  const arrow = document.getElementById("settings-arrow");
  body.classList.toggle("collapsed");
  arrow.classList.toggle("collapsed");
}

function toggleKeyVisibility() {
  const input = document.getElementById("api-key-input");
  if (input.type === "password") {
    input.type = "text";
  } else {
    input.type = "password";
  }
}

function onProviderChange() {
  populateModels(document.getElementById("provider-select").value);
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

// ─── Step 1: Load Repo ───

async function loadRepo() {
  const input = document.getElementById("repo-path");
  const btn = document.getElementById("btn-load-repo");
  const repoPath = input.value.trim();

  if (!repoPath) return;

  clearErrors("step-repo");
  btn.disabled = true;
  btn.querySelector(".btn-label").textContent = "Loading";
  btn.querySelector(".btn-spinner").classList.remove("hidden");

  try {
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

    showCard("step-filter");
    hideCard("step-analyze");
    hideCard("step-results");

    applyFilters();
  } catch (err) {
    showError("step-repo", "Failed to connect: " + err.message);
  } finally {
    btn.disabled = false;
    btn.querySelector(".btn-label").textContent = "Load";
    btn.querySelector(".btn-spinner").classList.add("hidden");
  }
}

// ─── Step 2: Filter Commits ───

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
      hideCard("step-analyze");
      return;
    }

    state.commits = data.commits;
    renderCommitInfo(data.commits, author, branch);

    // Update count badge
    document.getElementById("commit-count").textContent =
      data.commits.length > 0 ? `${data.commits.length} commits` : "";

    if (data.commits.length > 0) {
      showCard("step-analyze");
    } else {
      hideCard("step-analyze");
    }
    hideCard("step-results");
  } catch (err) {
    showError("step-filter", err.message);
  }
}

function renderCommitInfo(commits, author, branch) {
  const info = document.getElementById("commit-info");

  if (commits.length === 0) {
    info.innerHTML = '<span style="color:var(--text-tertiary)">No commits match the current filters.</span>';
    return;
  }

  const recent = commits.slice(0, 30);
  const dateRange = `${commits[commits.length - 1].date.split("T")[0]} to ${commits[0].date.split("T")[0]}`;
  const filterDesc = [
    author && `<strong>${escapeHtml(author)}</strong>`,
    branch && `on <strong>${escapeHtml(branch)}</strong>`,
  ].filter(Boolean).join(" ");

  const showAuthorCol = !author;

  info.innerHTML = `
    <div style="margin-bottom:8px">
      <strong>${commits.length}</strong> commits${filterDesc ? ` by ${filterDesc}` : ""}
      <span style="color:var(--text-tertiary);margin-left:8px;font-size:0.78rem">${dateRange}</span>
    </div>
    <div class="commit-list">
      ${recent.map((c, i) =>
        `<div class="commit-item" style="animation-delay:${i * 20}ms">
          <span class="hash">${c.hash.slice(0, 7)}</span>
          <span class="date">${c.date.split("T")[0]}</span>
          ${showAuthorCol ? `<span class="author-tag">${escapeHtml(c.author)}</span>` : ""}
          <span class="msg">${escapeHtml(c.message)}</span>
        </div>`
      ).join("")}
      ${commits.length > 30 ? `<div style="padding:8px 0;color:var(--text-tertiary);font-size:0.75rem">+ ${commits.length - 30} more</div>` : ""}
    </div>
  `;
}

// ─── Step 3: Run Analysis ───

function runAnalysis() {
  const settings = getSettings();

  if (!settings.apiKey) {
    showError("step-analyze", "Enter an API key in Settings above.");
    return;
  }

  const btn = document.getElementById("btn-analyze");
  btn.disabled = true;
  const label = btn.querySelector(".btn-label");
  const icon = btn.querySelector(".btn-icon");
  label.textContent = "Analyzing...";
  if (icon) icon.style.animation = "pulse 1.2s ease-in-out infinite";

  clearErrors("step-analyze");
  showCard("step-results");
  hide("result-area");
  show("progress-area");
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
          label.textContent = "Analyze Commits";
          if (icon) icon.style.animation = "";
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
      label.textContent = "Analyze Commits";
      if (icon) icon.style.animation = "";
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
        text.innerHTML = `<span class="spinner"></span>Extracting diffs ${data.current}/${data.total}`;
      } else if (data.step === "llm") {
        text.innerHTML = `<span class="spinner"></span>LLM analysis batch ${data.current}/${data.total}`;
      }
      break;
    }
    case "result":
      bar.style.width = "100%";
      text.innerHTML = '<span style="color:#4ade80">Done</span>';
      state.resultMarkdown = data.skills;
      document.getElementById("skills-output").textContent = data.skills;
      show("result-area");
      // Mark step 4 as done
      const pill = document.querySelector("#step-results .step-pill");
      if (pill) pill.classList.add("done");
      break;
    case "error":
      text.textContent = "";
      showError("step-results", data.message);
      break;
  }
}

// ─── Result Actions ───

function copyResult() {
  navigator.clipboard.writeText(state.resultMarkdown).then(() => {
    const btn = document.getElementById("btn-copy");
    const span = btn.querySelector("span");
    const orig = span.textContent;
    span.textContent = "Copied!";
    btn.style.color = "#4ade80";
    btn.style.borderColor = "rgba(74,222,128,0.2)";
    setTimeout(() => {
      span.textContent = orig;
      btn.style.color = "";
      btn.style.borderColor = "";
    }, 1500);
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

// ─── Init ───

document.addEventListener("DOMContentLoaded", () => {
  loadModels();

  // Initially hide steps 2-4
  ["step-filter", "step-analyze", "step-results"].forEach((id) => {
    document.getElementById(id)?.classList.add("hidden");
  });

  document.getElementById("repo-path").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadRepo();
  });
});
