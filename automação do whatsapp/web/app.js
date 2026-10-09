const api = (path, options) => fetch(`/api${path}`, options).then((r) => r.json());

let activeConversation = null;

async function loadStats() {
  const stats = await api("/queue/stats");
  document.getElementById("queue-stats").innerHTML =
    `<span>Fila: ${stats.waiting}</span><span>Ativos: ${stats.active}</span>` +
    `<span>OK: ${stats.completed}</span><span>Falhas: ${stats.failed}</span>`;
}

async function loadContacts(search = "") {
  const contacts = await api(`/contacts?search=${encodeURIComponent(search)}`);
  document.getElementById("contact-list").innerHTML = contacts
    .map(
      (c) =>
        `<li data-phone="${c.phone}"><strong>${c.name ?? "Sem nome"}</strong><br>${c.phone}${
          c.petName ? ` · pet: ${c.petName}` : ""
        }</li>`,
    )
    .join("");
}

async function loadConversations() {
  const conversations = await api("/conversations");
  document.getElementById("conversation-list").innerHTML = conversations
    .map(
      (c) =>
        `<li data-id="${c.id}" class="${activeConversation === c.id ? "active" : ""}">` +
        `<strong>${c.contact?.name ?? c.contact?.phone}</strong><br>` +
        `<span>${c.status} · ${c.messages?.[0]?.content ?? ""}</span></li>`,
    )
    .join("");

  document.querySelectorAll("#conversation-list li").forEach((li) => {
    li.addEventListener("click", () => openConversation(li.dataset.id));
  });
}

async function openConversation(id) {
  activeConversation = id;
  const messages = await api(`/conversations/${id}/messages`);
  document.getElementById("messages").innerHTML = messages
    .map(
      (m) =>
        `<div class="bubble ${m.direction === "INBOUND" ? "in" : "out"}">` +
        `${escapeHtml(m.content)}<div class="meta">${m.status} · ${new Date(m.createdAt).toLocaleTimeString()}</div></div>`,
    )
    .join("");
  document.getElementById("reply-form").classList.remove("hidden");
  loadConversations();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

document.getElementById("send-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const to = document.getElementById("send-to").value.trim();
  const message = document.getElementById("send-message").value.trim();
  await api("/webhooks/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, message }),
  });
  document.getElementById("send-result").textContent = "Mensagem aceita para envio.";
  document.getElementById("send-message").value = "";
});

document.getElementById("reply-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeConversation) return;
  const message = document.getElementById("reply-message").value.trim();
  if (!message) return;
  await api(`/conversations/${activeConversation}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  document.getElementById("reply-message").value = "";
  openConversation(activeConversation);
});

document.getElementById("contact-search").addEventListener("input", (e) => loadContacts(e.target.value));

loadStats();
loadContacts();
loadConversations();
setInterval(loadStats, 5000);
