import { searchRecords } from "./fuzzy.mjs";

const STORAGE_KEY = "savedDetails";
const elements = {
  searchView: document.querySelector("#searchView"),
  settingsView: document.querySelector("#settingsView"),
  searchInput: document.querySelector("#searchInput"),
  settingsButton: document.querySelector("#settingsButton"),
  backButton: document.querySelector("#backButton"),
  addButton: document.querySelector("#addButton"),
  cancelButton: document.querySelector("#cancelButton"),
  detailForm: document.querySelector("#detailForm"),
  recordId: document.querySelector("#recordId"),
  nameInput: document.querySelector("#nameInput"),
  typeInput: document.querySelector("#typeInput"),
  valueInput: document.querySelector("#valueInput"),
  tagsInput: document.querySelector("#tagsInput"),
  results: document.querySelector("#results"),
  emptyHint: document.querySelector("#emptyHint"),
  savedList: document.querySelector("#savedList"),
  toast: document.querySelector("#toast")
};

let records = [];
let activeResultIndex = -1;
let visibleResults = [];
let toastTimer;

function makeId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function loadRecords() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  records = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
}

async function saveRecords() {
  await chrome.storage.local.set({ [STORAGE_KEY]: records });
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 1600);
}

async function copyRecord(record) {
  try {
    await navigator.clipboard.writeText(record.value);
    showToast(`Copied ${record.name}`);
  } catch {
    showToast("Could not copy. Try again.");
  }
}

function createResult(record, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "result-card";
  button.setAttribute("role", "option");
  button.dataset.index = String(index);
  button.setAttribute("aria-label", `Copy ${record.name}`);

  const content = document.createElement("span");
  const name = document.createElement("span");
  const value = document.createElement("span");
  name.className = "result-name";
  value.className = "result-value";
  name.textContent = record.name;
  value.textContent = record.value;
  content.append(name, value);
  button.append(content);

  if (record.type) {
    const type = document.createElement("span");
    type.className = "result-type";
    type.textContent = record.type;
    button.append(type);
  }

  button.addEventListener("click", () => copyRecord(record));
  return button;
}

function renderSearch() {
  const query = elements.searchInput.value;
  visibleResults = searchRecords(records, query);
  activeResultIndex = -1;
  elements.results.replaceChildren(...visibleResults.map(createResult));

  if (!query.trim()) {
    elements.emptyHint.textContent = records.length
      ? "Start typing to find something."
      : "No saved details yet. Use the gear to add one.";
    elements.emptyHint.hidden = false;
  } else if (!visibleResults.length) {
    elements.emptyHint.textContent = "No matches.";
    elements.emptyHint.hidden = false;
  } else {
    elements.emptyHint.hidden = true;
  }
}

function updateActiveResult(nextIndex) {
  const cards = [...elements.results.querySelectorAll(".result-card")];
  cards.forEach((card) => card.classList.remove("active"));
  if (!cards.length) return;
  activeResultIndex = (nextIndex + cards.length) % cards.length;
  cards[activeResultIndex].classList.add("active");
  cards[activeResultIndex].scrollIntoView({ block: "nearest" });
}

function createSavedCard(record) {
  const card = document.createElement("article");
  card.className = "saved-card";
  const top = document.createElement("div");
  top.className = "saved-card-top";
  const content = document.createElement("div");
  const title = document.createElement("h2");
  const value = document.createElement("p");
  title.textContent = record.name;
  value.textContent = record.value;
  content.append(title, value);

  const actions = document.createElement("div");
  actions.className = "saved-actions";
  const edit = document.createElement("button");
  const remove = document.createElement("button");
  edit.type = remove.type = "button";
  edit.className = "text-button";
  remove.className = "text-button danger";
  edit.textContent = "Edit";
  remove.textContent = "Delete";
  edit.addEventListener("click", () => openForm(record));
  remove.addEventListener("click", async () => {
    if (!confirm(`Delete “${record.name}”?`)) return;
    records = records.filter(({ id }) => id !== record.id);
    await saveRecords();
    renderSettings();
  });
  actions.append(edit, remove);
  top.append(content, actions);
  card.append(top);

  const labels = [record.type, ...(record.tags ?? [])].filter(Boolean);
  if (labels.length) {
    const tagRow = document.createElement("div");
    tagRow.className = "tag-row";
    labels.forEach((label) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = label;
      tagRow.append(tag);
    });
    card.append(tagRow);
  }
  return card;
}

function renderSettings() {
  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "settings-empty";
    empty.textContent = "Nothing saved yet. Add the first detail you want close at hand.";
    elements.savedList.replaceChildren(empty);
    return;
  }
  const sorted = [...records].sort((a, b) => a.name.localeCompare(b.name));
  elements.savedList.replaceChildren(...sorted.map(createSavedCard));
}

function openForm(record = null) {
  elements.recordId.value = record?.id ?? "";
  elements.nameInput.value = record?.name ?? "";
  elements.typeInput.value = record?.type ?? "";
  elements.valueInput.value = record?.value ?? "";
  elements.tagsInput.value = record?.tags?.join(", ") ?? "";
  elements.detailForm.hidden = false;
  elements.nameInput.focus();
}

function closeForm() {
  elements.detailForm.reset();
  elements.recordId.value = "";
  elements.detailForm.hidden = true;
}

function showSettings() {
  elements.searchView.hidden = true;
  elements.settingsView.hidden = false;
  closeForm();
  renderSettings();
}

function showSearch() {
  elements.settingsView.hidden = true;
  elements.searchView.hidden = false;
  renderSearch();
  elements.searchInput.focus();
}

elements.searchInput.addEventListener("input", renderSearch);
elements.searchInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    updateActiveResult(activeResultIndex + (event.key === "ArrowDown" ? 1 : -1));
  } else if (event.key === "Enter" && visibleResults.length) {
    event.preventDefault();
    copyRecord(visibleResults[activeResultIndex >= 0 ? activeResultIndex : 0]);
  } else if (event.key === "Escape") {
    elements.searchInput.value = "";
    renderSearch();
  }
});

elements.settingsButton.addEventListener("click", showSettings);
elements.backButton.addEventListener("click", showSearch);
elements.addButton.addEventListener("click", () => openForm());
elements.cancelButton.addEventListener("click", closeForm);

elements.detailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = elements.recordId.value || makeId();
  const record = {
    id,
    name: elements.nameInput.value.trim(),
    type: elements.typeInput.value.trim(),
    value: elements.valueInput.value.trim(),
    tags: [...new Set(elements.tagsInput.value.split(",").map((tag) => tag.trim()).filter(Boolean))],
    updatedAt: new Date().toISOString()
  };
  const existingIndex = records.findIndex((item) => item.id === id);
  if (existingIndex >= 0) records[existingIndex] = record;
  else records.push(record);
  await saveRecords();
  closeForm();
  renderSettings();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEY]) return;
  records = Array.isArray(changes[STORAGE_KEY].newValue) ? changes[STORAGE_KEY].newValue : [];
  if (elements.settingsView.hidden) renderSearch();
  else renderSettings();
});

await loadRecords();
renderSearch();
