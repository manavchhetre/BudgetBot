const state = {
  user: null,
  conversationId: null,
  isStreaming: false,
};

const chatLog = document.querySelector("#chatLog");
const messageInput = document.querySelector("#messageInput");
const conversationsEl = document.querySelector("#conversations");
const analyticsEl = document.querySelector("#analytics");
const dailyBreakdownEl = document.querySelector("#dailyBreakdown");
const transactionsEl = document.querySelector("#transactions");
const userNameEl = document.querySelector("#userName");
const welcomeNameEl = document.querySelector("#welcomeName");
const headerNameEl = document.querySelector("#headerName");
const railUserNameEl = document.querySelector("#railUserName");
const userInitialEl = document.querySelector("#userInitial");
const newChatBtn = document.querySelector("#newChatBtn");
const historyBtn = document.querySelector("#historyBtn");
const analyticsBtn = document.querySelector("#analyticsBtn");
const sendBtn = document.querySelector("#sendBtn");
const mobileChatBtn = document.querySelector("#mobileChatBtn");
const mobileAnalyticsBtn = document.querySelector("#mobileAnalyticsBtn");
const mobileHistoryBtn = document.querySelector("#mobileHistoryBtn");

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
    if (!line) {
      index += 1;
      continue;
    }

    if (isTableBlock(lines, index)) {
      const headers = lines[index].split("|").map((cell) => cell.trim()).filter(Boolean);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(lines[index].split("|").map((cell) => cell.trim()).filter(Boolean));
        index += 1;
      }
      html.push("<div class=\"markdown-table-wrap\"><table class=\"markdown-table\"><thead><tr>");
      headers.forEach((header) => html.push(`<th>${formatInlineMarkdown(header)}</th>`));
      html.push("</tr></thead><tbody>");
      rows.forEach((row) => {
        html.push("<tr>");
        row.forEach((cell) => html.push(`<td>${formatInlineMarkdown(cell)}</td>`));
        html.push("</tr>");
      });
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

function addMessage(role, content = "") {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.dataset.raw = content;
  message.innerHTML = role === "assistant" ? renderMarkdown(content) : escapeHtml(content);
  chatLog.appendChild(message);
  message.scrollIntoView({ behavior: "smooth", block: "end" });
  return message;
}

function updateAssistantMessage(element, content) {
  element.dataset.raw = content;
  element.innerHTML = renderMarkdown(content);
  element.scrollIntoView({ behavior: "smooth", block: "end" });
}

async function sendMessage(text) {
  const message = text.trim();
  if (!message || state.isStreaming) return;
  state.isStreaming = true;
  messageInput.value = "";
  addMessage("user", message);
  const assistantMessage = addMessage("assistant", "");
  let rawAssistantText = "";

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversation_id: state.conversationId }),
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!response.ok || !response.body) {
      throw new Error("Chat request failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "meta") {
          state.conversationId = event.conversation_id;
        }
        if (event.type === "chunk") {
          rawAssistantText += event.text;
          updateAssistantMessage(assistantMessage, rawAssistantText);
        }
      }
    }

    await Promise.all([loadConversations(), loadAnalytics(), loadTransactions()]);
  } catch (error) {
    updateAssistantMessage(assistantMessage, error.message);
  } finally {
    state.isStreaming = false;
  }
}

async function loadMe() {
  state.user = await api("/api/me");
  if (!state.user) return;
  userNameEl.textContent = state.user.name;
  if (welcomeNameEl) welcomeNameEl.textContent = state.user.name;
  headerNameEl.textContent = state.user.name;
  railUserNameEl.textContent = state.user.name;
  userInitialEl.textContent = state.user.name.slice(0, 1).toUpperCase();
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
      document.querySelectorAll(".conversation-item").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      await loadConversationMessages(conversation.id);
    });
    conversationsEl.appendChild(button);
  });
}

async function loadConversationMessages(conversationId) {
  const messages = await api(`/api/conversations/${conversationId}/messages`);
  if (!messages) return;
  chatLog.innerHTML = "";
  messages.forEach((message) => addMessage(message.role, message.content));
  document.querySelector(".main").scrollTo({ top: 0, behavior: "smooth" });
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
    <div class="panel-section">
      <p class="section-label">CATEGORY BREAKDOWN</p>
      <div class="breakdown-list">
        ${
          summary.category_breakdown.length
            ? summary.category_breakdown
                .map(
                  (item) =>
                    `<div class="breakdown-item"><span>${escapeHtml(item.category)}</span><strong>${formatMoney(item.amount)}</strong></div>`,
                )
                .join("")
            : `<p class="muted">No spend recorded yet.</p>`
        }
      </div>
    </div>
  `;
  dailyBreakdownEl.innerHTML = summary.daily_breakdown.length
    ? summary.daily_breakdown
        .map(
          (item) =>
            `<div class="breakdown-item date-row"><span>${formatDate(item.date)}</span><strong>${formatMoney(item.amount)}</strong></div>`,
        )
        .join("")
    : `<p class="muted">No date-wise spend yet.</p>`;
}

async function loadTransactions() {
  const transactions = await api("/api/transactions");
  if (!transactions) return;
  transactionsEl.innerHTML = "";
  if (!transactions.length) {
    transactionsEl.innerHTML = `<p class="muted">Add an expense to see it here.</p>`;
    return;
  }
  transactions.slice(0, 6).forEach((transaction) => {
    const row = document.createElement("div");
    row.className = "transaction-item";
    row.innerHTML = `
      <span><strong>${escapeHtml(transaction.merchant)}</strong><br><span class="muted">${escapeHtml(transaction.category)} - ${formatDate(transaction.date)}</span></span>
      <strong>${formatMoney(transaction.amount, transaction.currency)}</strong>
    `;
    transactionsEl.appendChild(row);
  });
}

async function logout() {
  await fetch("/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

document.querySelector("#chatForm").addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(messageInput.value);
});

sendBtn.addEventListener("click", () => sendMessage(messageInput.value));

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage(messageInput.value);
  }
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt));
});

document.querySelectorAll(".quick-actions button").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt));
});

newChatBtn.addEventListener("click", () => {
  state.conversationId = null;
  chatLog.innerHTML = "";
  messageInput.focus();
});

historyBtn.addEventListener("click", () => {
  document.querySelector("#conversations").scrollIntoView({ behavior: "smooth", block: "center" });
});

analyticsBtn.addEventListener("click", () => {
  document.querySelector("#analytics").scrollIntoView({ behavior: "smooth", block: "start" });
});

mobileChatBtn.addEventListener("click", () => messageInput.focus());
mobileAnalyticsBtn.addEventListener("click", () => document.querySelector("#analytics").scrollIntoView({ behavior: "smooth" }));
mobileHistoryBtn.addEventListener("click", () => document.querySelector("#conversations").scrollIntoView({ behavior: "smooth" }));

document.querySelector("#logoutBtn").addEventListener("click", logout);

loadMe()
  .then(() => Promise.all([loadConversations(), loadAnalytics(), loadTransactions()]))
  .catch(() => {
    window.location.href = "/login";
  });
