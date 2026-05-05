/* ── Jerry – app.js ── */
const state = {
  user: null,
  conversationId: null,
  isStreaming: false,
  currentPage: "chat",
};

/* ── Init Theme & Sidebar ── */
const savedTheme = localStorage.getItem("jerry_theme") || "light";
if (savedTheme === "dark") document.documentElement.setAttribute("data-theme", "dark");
const savedSidebar = localStorage.getItem("jerry_sidebar");
if (savedSidebar === "collapsed" && document.querySelector(".app-shell")) {
  document.querySelector(".app-shell").classList.add("sidebar-collapsed");
}

/* ── DOM refs ── */
const chatLog = document.querySelector("#chatLog");
const messageInput = document.querySelector("#messageInput");
const conversationsEl = document.querySelector("#conversations");
const analyticsEl = document.querySelector("#analytics");
const dailyBreakdownEl = document.querySelector("#dailyBreakdown");
const transactionsEl = document.querySelector("#transactions");
const headerNameEl = document.querySelector("#headerName");
const railUserNameEl = document.querySelector("#railUserName");
const userInitialEl = document.querySelector("#userInitial");
const userNameEl = document.querySelector("#userName");
const sendBtn = document.querySelector("#sendBtn");
const pageTitleEl = document.querySelector("#pageTitle");
const pageSubtitleEl = document.querySelector("#pageSubtitle");
const budgetsListEl = document.querySelector("#budgetsList");

let spendChartInstance = null;

/* ── Page routing ── */
const pageMeta = {
  chat:      { title: (n) => `👋 Hey ${n}!`, sub: "I'm Jerry, here to help you track expenses and manage your money." },
  analytics: { title: () => "📊 Analytics",  sub: "Your spending overview and insights." },
  history:   { title: () => "🕐 History",    sub: "Your recent transactions and conversations." },
  budgets:   { title: () => "💰 Budgets",    sub: "Manage your monthly budgets." },
  settings:  { title: () => "⚙️ Settings",   sub: "Configure your Jerry experience." },
};

function switchPage(page) {
  state.currentPage = page;

  /* Toggle visibility */
  document.querySelectorAll(".page-content").forEach((el) => {
    el.classList.toggle("hidden", el.id !== `page-${page}`);
  });

  /* Update sidebar active state */
  document.querySelectorAll(".rail-button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  /* Update mobile nav */
  document.querySelectorAll(".mobile-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  /* Update topbar */
  const meta = pageMeta[page];
  if (meta) {
    const name = state.user ? state.user.name : "there";
    pageTitleEl.innerHTML = meta.title(name);
    pageSubtitleEl.textContent = meta.sub;
  }

  /* Lazy-load data for pages */
  if (page === "analytics") {
    loadAnalytics();
  } else if (page === "history") {
    loadConversations();
    loadTransactions();
  } else if (page === "budgets") {
    loadBudgets();
  }
}

/* Wire up all nav buttons */
document.querySelectorAll("[data-page]").forEach((btn) => {
  btn.addEventListener("click", () => switchPage(btn.dataset.page));
});

/* ── API helper ── */
async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (response.status === 401) {
    window.location.href = "/login";
    return null;
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(data.detail || "Request failed");
  }
  return response.json();
}

/* ── Text helpers ── */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function isTableBlock(lines, index) {
  return (
    index + 1 < lines.length &&
    lines[index].includes("|") &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
  );
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }

    if (isTableBlock(lines, index)) {
      const headers = lines[index].split("|").map((c) => c.trim()).filter(Boolean);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(lines[index].split("|").map((c) => c.trim()).filter(Boolean));
        index += 1;
      }
      html.push('<div class="markdown-table-wrap"><table class="markdown-table"><thead><tr>');
      headers.forEach((h) => html.push(`<th>${formatInlineMarkdown(h)}</th>`));
      html.push("</tr></thead><tbody>");
      rows.forEach((r) => { html.push("<tr>"); r.forEach((c) => html.push(`<td>${formatInlineMarkdown(c)}</td>`)); html.push("</tr>"); });
      html.push("</tbody></table></div>");
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      html.push("<ul>");
      while (index < lines.length) {
        const item = lines[index].trim();
        if (!item.startsWith("- ") && !item.startsWith("* ")) break;
        html.push(`<li>${formatInlineMarkdown(item.slice(2))}</li>`);
        index += 1;
      }
      html.push("</ul>");
      continue;
    }

    if (line.startsWith("### ")) html.push(`<h4>${formatInlineMarkdown(line.slice(4))}</h4>`);
    else if (line.startsWith("## ")) html.push(`<h3>${formatInlineMarkdown(line.slice(3))}</h3>`);
    else if (line.startsWith("# ")) html.push(`<h2>${formatInlineMarkdown(line.slice(2))}</h2>`);
    else html.push(`<p>${formatInlineMarkdown(line)}</p>`);
    index += 1;
  }
  return html.join("");
}

function formatMoney(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "numeric", hour12: true }).format(new Date(value));
}

/* ── Chat ── */
function addMessage(role, content = "", timestamp = null) {
  const messageWrap = document.createElement("div");
  messageWrap.className = `message ${role}`;
  messageWrap.dataset.raw = content;
  
  const contentDiv = document.createElement("div");
  contentDiv.className = "msg-content";
  contentDiv.innerHTML = role === "assistant" ? renderMarkdown(content) : escapeHtml(content);
  messageWrap.appendChild(contentDiv);

  if (timestamp) {
    const timeDiv = document.createElement("div");
    timeDiv.className = "msg-timestamp";
    timeDiv.textContent = formatTime(timestamp);
    messageWrap.appendChild(timeDiv);
  }

  chatLog.appendChild(messageWrap);
  messageWrap.scrollIntoView({ behavior: "smooth", block: "end" });
  return messageWrap;
}

function updateAssistantMessage(element, content) {
  element.dataset.raw = content;
  const contentDiv = element.querySelector(".msg-content");
  if (contentDiv) contentDiv.innerHTML = renderMarkdown(content);
  else element.innerHTML = renderMarkdown(content);
  element.scrollIntoView({ behavior: "smooth", block: "end" });
}

async function sendMessage(text) {
  const message = text.trim();
  if (!message || state.isStreaming) return;
  state.isStreaming = true;
  messageInput.value = "";
  addMessage("user", message, Date.now());
  
  const typingElement = document.createElement("div");
  typingElement.className = "message assistant typing-indicator";
  typingElement.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
  chatLog.appendChild(typingElement);
  typingElement.scrollIntoView({ behavior: "smooth", block: "end" });

  let assistantMessage = null;
  let rawAssistantText = "";

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversation_id: state.conversationId }),
    });

    if (response.status === 401) { window.location.href = "/login"; return; }
    if (!response.ok || !response.body) throw new Error("Chat request failed");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (typingElement.parentNode) typingElement.remove();
      if (!assistantMessage) assistantMessage = addMessage("assistant", "", Date.now());

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "meta") state.conversationId = event.conversation_id;
        if (event.type === "chunk") {
          rawAssistantText += event.text;
          updateAssistantMessage(assistantMessage, rawAssistantText);
        }
      }
    }
  } catch (error) {
    if (typingElement.parentNode) typingElement.remove();
    if (!assistantMessage) assistantMessage = addMessage("assistant", "", Date.now());
    updateAssistantMessage(assistantMessage, error.message);
  } finally {
    state.isStreaming = false;
  }
}

/* ── Data loaders ── */
async function loadMe() {
  state.user = await api("/api/me");
  if (!state.user) return;
  const name = state.user.name;
  const avatar = state.user.avatar;
  userNameEl.textContent = name;
  headerNameEl.textContent = name;
  railUserNameEl.textContent = name;
  userInitialEl.textContent = avatar ? avatar : name.slice(0, 1).toUpperCase();

  const nameInput = document.querySelector("#nameInput");
  if (nameInput) nameInput.value = name;
  const avatarInput = document.querySelector("#avatarInput");
  if (avatarInput) avatarInput.value = avatar || "";
  const incomeInput = document.querySelector("#monthlyIncomeInput");
  if (incomeInput) incomeInput.value = state.user.monthly_income || "";
  const themeSelect = document.querySelector("#themeSelect");
  if (themeSelect) themeSelect.value = localStorage.getItem("jerry_theme") || "light";
}

async function loadConversations() {
  const conversations = await api("/api/conversations");
  if (!conversations) return;
  conversationsEl.innerHTML = "";
  if (!conversations.length) {
    conversationsEl.innerHTML = `<p class="muted">No conversations yet.</p>`;
    return;
  }
  conversations.forEach((conversation) => {
    const button = document.createElement("button");
    button.className = `conversation-item ${conversation.id === state.conversationId ? "active" : ""}`;
    button.textContent = conversation.title;
    button.addEventListener("click", async () => {
      state.conversationId = conversation.id;
      document.querySelectorAll(".conversation-item").forEach((i) => i.classList.remove("active"));
      button.classList.add("active");
      await loadConversationMessages(conversation.id);
      switchPage("chat");
    });
    conversationsEl.appendChild(button);
  });
}

async function loadConversationMessages(conversationId) {
  const messages = await api(`/api/conversations/${conversationId}/messages`);
  if (!messages) return;
  chatLog.innerHTML = "";
  messages.forEach((m) => addMessage(m.role, m.content, m.created_at));
}

async function loadAnalytics() {
  const summary = await api("/api/analytics/summary");
  if (!summary) return;
  analyticsEl.innerHTML = `
    <div class="metric-grid">
      <div class="metric"><strong>${formatMoney(summary.total_spend)}</strong><span>Total spend</span></div>
      <div class="metric"><strong>${summary.transaction_count}</strong><span>Transactions</span></div>
      <div class="metric"><strong>${summary.top_category || "-"}</strong><span>Top category</span></div>
    </div>
  `;
  dailyBreakdownEl.innerHTML = summary.daily_breakdown.length
    ? summary.daily_breakdown.map((i) =>
        `<div class="breakdown-item date-row"><span>${formatDate(i.date)}</span><strong>${formatMoney(i.amount)}</strong></div>`
      ).join("")
    : `<p class="muted">No date-wise spend yet.</p>`;

  // Render Chart.js
  const ctx = document.getElementById("spendChart");
  if (!ctx || !summary.category_breakdown.length) return;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#cbd5e1" : "#475569";
  const gridColor = isDark ? "#334155" : "#e2e8f0";

  if (spendChartInstance) {
    spendChartInstance.destroy();
  }

  spendChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: summary.category_breakdown.map((c) => c.category),
      datasets: [{
        data: summary.category_breakdown.map((c) => c.amount),
        backgroundColor: [
          "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6", "#10b981", "#64748b"
        ],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right", labels: { color: textColor, font: { family: "Inter" } } },
        tooltip: {
          callbacks: {
            label: function(context) { return " " + formatMoney(context.raw); }
          }
        }
      },
      cutout: "65%"
    }
  });
}

async function loadBudgets() {
  const summary = await api("/api/analytics/summary");
  if (!summary) return;
  if (!budgetsListEl) return;
  
  budgetsListEl.innerHTML = "";
  if (!summary.budget_tracking || !summary.budget_tracking.length) {
    budgetsListEl.innerHTML = `<p class="muted">You don't have any active budgets. Add one above!</p>`;
    return;
  }

  summary.budget_tracking.forEach((b) => {
    const pct = Math.min(100, (b.spent_amount / b.limit_amount) * 100);
    let colorClass = "";
    if (pct >= 90) colorClass = "danger";
    else if (pct >= 75) colorClass = "warning";

    const item = document.createElement("div");
    item.className = "budget-item";
    item.innerHTML = `
      <div class="budget-header">
        <span>${escapeHtml(b.category)}</span>
        <button class="budget-del-btn" data-category="${escapeHtml(b.category)}" title="Delete Budget">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </div>
      <div class="budget-bar-wrap">
        <div class="budget-bar ${colorClass}" style="width: ${pct}%"></div>
      </div>
      <div class="budget-meta">
        <span>${formatMoney(b.spent_amount)} spent</span>
        <span>${formatMoney(b.remaining_amount)} left of ${formatMoney(b.limit_amount)}</span>
      </div>
    `;
    
    item.querySelector(".budget-del-btn").addEventListener("click", async (e) => {
      const cat = e.currentTarget.dataset.category;
      if (confirm(`Delete budget for ${cat}?`)) {
        await api(`/api/budgets/${encodeURIComponent(cat)}`, { method: "DELETE" });
        loadBudgets();
      }
    });

    budgetsListEl.appendChild(item);
  });
}

async function loadTransactions() {
  const transactions = await api("/api/transactions");
  if (!transactions) return;
  transactionsEl.innerHTML = "";
  if (!transactions.length) {
    transactionsEl.innerHTML = `<p class="muted">Add an expense to see it here.</p>`;
    return;
  }
  transactions.slice(0, 10).forEach((t) => {
    const row = document.createElement("div");
    row.className = "transaction-item";
    row.innerHTML = `
      <span><strong>${escapeHtml(t.merchant)}</strong><br><span class="muted">${escapeHtml(t.category)} · ${formatDate(t.date)}</span></span>
      <strong>${formatMoney(t.amount, t.currency)}</strong>
    `;
    transactionsEl.appendChild(row);
  });
}

async function logout() {
  await fetch("/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

/* ── Event listeners ── */
document.querySelector("#chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(messageInput.value);
});

sendBtn.addEventListener("click", () => sendMessage(messageInput.value));

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(messageInput.value);
  }
});

document.querySelectorAll(".quick-actions button").forEach((btn) => {
  btn.addEventListener("click", () => sendMessage(btn.dataset.prompt));
});

document.querySelector("#logoutBtn").addEventListener("click", logout);

const railToggle = document.querySelector("#railToggle");
if (railToggle) {
  railToggle.addEventListener("click", () => {
    const shell = document.querySelector(".app-shell");
    shell.classList.toggle("sidebar-collapsed");
    localStorage.setItem("jerry_sidebar", shell.classList.contains("sidebar-collapsed") ? "collapsed" : "expanded");
  });
}

const budgetForm = document.querySelector("#budgetForm");
if (budgetForm) {
  budgetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cat = document.querySelector("#budgetCategory").value;
    const limit = parseFloat(document.querySelector("#budgetLimit").value);
    if (!cat || !limit) return;
    
    try {
      await api("/api/budgets", {
        method: "POST",
        body: JSON.stringify({ category: cat, limit_amount: limit })
      });
      document.querySelector("#budgetLimit").value = "";
      document.querySelector("#budgetCategory").value = "";
      loadBudgets();
    } catch (err) {
      alert("Failed to save budget");
    }
  });
}

const settingsForm = document.querySelector("#settingsForm");
if (settingsForm) {
  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.querySelector("#saveSettingsBtn");
    const msg = document.querySelector("#settingsMsg");
    btn.textContent = "Saving...";
    
    const theme = document.querySelector("#themeSelect").value;
    localStorage.setItem("jerry_theme", theme);
    if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");

    const payload = {
      name: document.querySelector("#nameInput").value,
      avatar: document.querySelector("#avatarInput").value,
      monthly_income: parseFloat(document.querySelector("#monthlyIncomeInput").value) || null
    };

    try {
      await api("/api/user/profile", { method: "PUT", body: JSON.stringify(payload) });
      msg.textContent = "Settings saved!";
      msg.style.color = "var(--green)";
      await loadMe();
    } catch (err) {
      msg.textContent = "Failed to save.";
      msg.style.color = "var(--danger)";
    } finally {
      btn.textContent = "Save Settings";
      setTimeout(() => msg.textContent = "", 3000);
    }
  });
}

/* ── Init ── */
loadMe()
  .then(() => Promise.all([loadAnalytics(), loadTransactions(), loadConversations(), loadBudgets()]))
  .catch(() => { window.location.href = "/login"; });
