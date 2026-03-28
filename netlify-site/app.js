var appState = {
  data: null,
  currentSpaceId: "",
  currentFolderId: "",
  editingFolderId: "",
  editingMaterialId: "",
  activeMenu: null,
  folderPicker: null,
  deleteTarget: null,
  shareSpaceId: "",
  shareSettings: null,
  shareContext: null,
  activeTagFilter: "",
  loadingModalId: "",
  confirm: null
};

function el(id) {
  return document.getElementById(id);
}

function html(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function jsString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n");
}

function getErrorText(err, fallback) {
  if (err && err.message) {
    return err.message;
  }
  if (typeof err === "string" && err.trim()) {
    return err;
  }
  return fallback || "Что-то пошло не так";
}

var CP1251_EXTRA = "\u0402\u0403\u201A\u0453\u201E\u2026\u2020\u2021\u20AC\u2030\u0409\u2039\u040A\u040C\u040B\u040F\u0452\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u0098\u2122\u0459\u203A\u045A\u045C\u045B\u045F\u00A0\u040E\u045E\u0408\u00A4\u0490\u00A6\u00A7\u0401\u00A9\u0404\u00AB\u00AC\u00AD\u00AE\u0407\u00B0\u00B1\u0406\u0456\u0491\u00B5\u00B6\u00B7\u0451\u2116\u0454\u00BB\u0458\u0405\u0455\u0457";
var cp1251ReverseMap = null;

function getCp1251ReverseMap() {
  var i;
  var map;
  if (cp1251ReverseMap) {
    return cp1251ReverseMap;
  }
  map = {};
  for (i = 0; i < CP1251_EXTRA.length; i++) {
    map[CP1251_EXTRA.charAt(i)] = 0x80 + i;
  }
  for (i = 0x0410; i <= 0x044F; i++) {
    map[String.fromCharCode(i)] = i - 0x0410 + 0xC0;
  }
  cp1251ReverseMap = map;
  return cp1251ReverseMap;
}

function fixBrokenCyrillic(value) {
  var text = String(value || "");
  var reverse;
  var bytes;
  var i;
  var ch;
  var decoded;
  if (!text || !/[РСЃÑÐ]/.test(text) || typeof TextDecoder === "undefined") {
    return text;
  }
  reverse = getCp1251ReverseMap();
  bytes = [];
  for (i = 0; i < text.length; i++) {
    ch = text.charAt(i);
    if (text.charCodeAt(i) <= 0x7F) {
      bytes.push(text.charCodeAt(i));
    } else if (reverse[ch] !== undefined) {
      bytes.push(reverse[ch]);
    } else {
      return text;
    }
  }
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    if (/[А-Яа-яЁё]/.test(decoded)) {
      return decoded;
    }
  } catch (err) {}
  return text;
}

function plainText(value) {
  return fixBrokenCyrillic(value);
}

function safeText(value) {
  return html(plainText(value));
}

function createFallbackData() {
  return {
    spaces: [["id", "name", "description", "shareSlug", "sharePassword", "shareEnabled", "directAccessToken", "directAccessEnabled"]],
    folders: [["id", "name", "parentId", "description", "badge", "availableFrom", "created", "updated", "spaceId"]],
    materials: [["id", "folderId", "title", "url", "description", "tags", "created", "updated"]],
    materialLinks: [["id", "materialId", "folderId", "created"]],
    tags: [],
    userContext: { currentUserEmail: "", ownerEmail: "", isOwner: false }
  };
}

function parseInitialData() {
  if (window.__INITIAL_DATA__) {
    return window.__INITIAL_DATA__;
  }
  var node = el("initialData");
  var raw = node ? String(node.textContent || "").trim() : "";
  if (!raw) {
    return createFallbackData();
  }
  return JSON.parse(raw);
}

async function loadBootstrapData() {
  var params;
  var shareSlug;
  var directAccessToken;

  if (window.__INITIAL_DATA__) {
    return window.__INITIAL_DATA__;
  }

  params = new URLSearchParams(window.location.search || "");
  shareSlug = String(params.get("spaceShare") || "").trim();
  directAccessToken = String(params.get("spaceDirect") || "").trim();

  if (directAccessToken && window.netlifyApi && window.netlifyApi.getDirectSharedSpaceBootstrap) {
    return window.netlifyApi.getDirectSharedSpaceBootstrap(directAccessToken);
  }

  if (shareSlug && window.netlifyApi && window.netlifyApi.getSharedSpaceBootstrap) {
    return window.netlifyApi.getSharedSpaceBootstrap(shareSlug);
  }

  if (window.netlifyApi && window.netlifyApi.getData) {
    return window.netlifyApi.getData();
  }

  return parseInitialData();
}

function renderFatalError(title, details) {
  el("breadcrumbs").innerHTML = "";
  el("content").innerHTML = '<div class="debug-panel"><strong>' + html(title || "Ошибка запуска") + '</strong><pre>' + html(String(details || "")) + '</pre></div>';
}

function showToast(message, type) {
  var stack = el("toastStack");
  var toast;
  if (!stack) {
    return;
  }
  toast = document.createElement("div");
  toast.className = "toast " + (type || "info");
  toast.textContent = String(message || "");
  stack.appendChild(toast);
  setTimeout(function () {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3200);
}

function getSpaces() { return (appState.data && appState.data.spaces ? appState.data.spaces : []).slice(1); }
function getFolders() { return (appState.data && appState.data.folders ? appState.data.folders : []).slice(1); }
function getMaterials() { return (appState.data && appState.data.materials ? appState.data.materials : []).slice(1); }
function getMaterialLinks() { return (appState.data && appState.data.materialLinks ? appState.data.materialLinks : []).slice(1); }

function ensureDataShape() {
  if (!appState.data) {
    appState.data = createFallbackData();
  }
  if (!Array.isArray(appState.data.spaces)) {
    appState.data.spaces = [["id", "name", "description", "shareSlug", "sharePassword", "shareEnabled", "directAccessToken", "directAccessEnabled"]];
  }
  if (!Array.isArray(appState.data.folders)) {
    appState.data.folders = [["id", "name", "parentId", "description", "badge", "availableFrom", "created", "updated", "spaceId"]];
  }
  if (!Array.isArray(appState.data.materials)) {
    appState.data.materials = [["id", "folderId", "title", "url", "description", "tags", "created", "updated"]];
  }
  if (!Array.isArray(appState.data.materialLinks)) {
    appState.data.materialLinks = [["id", "materialId", "folderId", "created"]];
  }
}

function findById(list, id) {
  var i;
  for (i = 0; i < list.length; i++) {
    if (String(list[i][0] || "") === String(id || "")) {
      return list[i];
    }
  }
  return null;
}

function upsertLocalFolder(folderRow) {
  var i;
  var folderId;
  ensureDataShape();
  folderId = String(folderRow && folderRow[0] || "");
  for (i = 1; i < appState.data.folders.length; i++) {
    if (String(appState.data.folders[i][0] || "") === folderId) {
      appState.data.folders[i] = folderRow;
      return;
    }
  }
  appState.data.folders.push(folderRow);
}

function upsertLocalMaterial(materialRow) {
  var i;
  var materialId;
  ensureDataShape();
  materialId = String(materialRow && materialRow[0] || "");
  for (i = 1; i < appState.data.materials.length; i++) {
    if (String(appState.data.materials[i][0] || "") === materialId) {
      appState.data.materials[i] = materialRow;
      return;
    }
  }
  appState.data.materials.push(materialRow);
}

function upsertLocalMaterialLink(linkRow) {
  var i;
  var materialId;
  var folderId;
  ensureDataShape();
  materialId = String(linkRow && linkRow[1] || "");
  folderId = String(linkRow && linkRow[2] || "");
  for (i = 1; i < appState.data.materialLinks.length; i++) {
    if (
      String(appState.data.materialLinks[i][1] || "") === materialId &&
      String(appState.data.materialLinks[i][2] || "") === folderId
    ) {
      appState.data.materialLinks[i] = linkRow;
      return;
    }
  }
  appState.data.materialLinks.push(linkRow);
}

function updateLocalFolderById(folderId, updates) {
  var folder = getFolderById(folderId);
  var nextFolder;
  if (!folder) {
    return null;
  }
  nextFolder = folder.slice();
  if (updates) {
    if (updates.name !== undefined) { nextFolder[1] = updates.name; }
    if (updates.parentId !== undefined) { nextFolder[2] = updates.parentId; }
    if (updates.description !== undefined) { nextFolder[3] = updates.description; }
    if (updates.badge !== undefined) { nextFolder[4] = updates.badge; }
    if (updates.availableFrom !== undefined) { nextFolder[5] = updates.availableFrom; }
    if (updates.created !== undefined) { nextFolder[6] = updates.created; }
    if (updates.updated !== undefined) { nextFolder[7] = updates.updated; }
    if (updates.spaceId !== undefined) { nextFolder[8] = updates.spaceId; }
  }
  upsertLocalFolder(nextFolder);
  return nextFolder;
}

function updateLocalMaterialById(materialId, updates) {
  var material = getMaterialById(materialId);
  var nextMaterial;
  if (!material) {
    return null;
  }
  nextMaterial = material.slice();
  if (updates) {
    if (updates.folderId !== undefined) { nextMaterial[1] = updates.folderId; }
    if (updates.title !== undefined) { nextMaterial[2] = updates.title; }
    if (updates.url !== undefined) { nextMaterial[3] = updates.url; }
    if (updates.description !== undefined) { nextMaterial[4] = updates.description; }
    if (updates.tags !== undefined) { nextMaterial[5] = updates.tags; }
    if (updates.created !== undefined) { nextMaterial[6] = updates.created; }
    if (updates.updated !== undefined) { nextMaterial[7] = updates.updated; }
  }
  upsertLocalMaterial(nextMaterial);
  return nextMaterial;
}

function removeLocalMaterialLinks(filterFn) {
  ensureDataShape();
  appState.data.materialLinks = [appState.data.materialLinks[0]].concat(
    getMaterialLinks().filter(function (link) {
      return !filterFn(link);
    })
  );
}

function removeLocalFoldersByIds(folderIds) {
  var blocked = {};
  ensureDataShape();
  folderIds.forEach(function (id) {
    blocked[String(id || '')] = true;
  });
  appState.data.folders = [appState.data.folders[0]].concat(
    getFolders().filter(function (folder) {
      return !blocked[String(folder[0] || '')];
    })
  );
}

function removeLocalMaterialsByIds(materialIds) {
  var blocked = {};
  ensureDataShape();
  materialIds.forEach(function (id) {
    blocked[String(id || '')] = true;
  });
  appState.data.materials = [appState.data.materials[0]].concat(
    getMaterials().filter(function (material) {
      return !blocked[String(material[0] || '')];
    })
  );
}

function addLocalMaterialToFolders(materialId, folderIds) {
  var updatedAt = new Date();
  updateLocalMaterialById(materialId, { updated: updatedAt });
  (folderIds || []).forEach(function (folderId, index) {
    upsertLocalMaterialLink([
      'link_local_' + Date.now() + '_' + index,
      materialId,
      folderId,
      updatedAt
    ]);
  });
}

function removeLocalMaterialFromFolder(materialId, folderId) {
  var material = getMaterialById(materialId);
  var remainingFolderIds;
  var updatedAt;
  if (!material) {
    return false;
  }
  remainingFolderIds = getMaterialFolderIds(materialId).filter(function (id) {
    return String(id || '') !== String(folderId || '');
  });
  if (!remainingFolderIds.length) {
    removeLocalMaterialsByIds([materialId]);
    removeLocalMaterialLinks(function (link) {
      return String(link[1] || '') === String(materialId || '');
    });
    return true;
  }
  updatedAt = new Date();
  if (String(material[1] || '') === String(folderId || '')) {
    updateLocalMaterialById(materialId, {
      folderId: remainingFolderIds[0],
      updated: updatedAt
    });
    removeLocalMaterialLinks(function (link) {
      return String(link[1] || '') === String(materialId || '') &&
        (String(link[2] || '') === String(folderId || '') || String(link[2] || '') === String(remainingFolderIds[0] || ''));
    });
    return false;
  }
  updateLocalMaterialById(materialId, { updated: updatedAt });
  removeLocalMaterialLinks(function (link) {
    return String(link[1] || '') === String(materialId || '') && String(link[2] || '') === String(folderId || '');
  });
  return false;
}

function removeLocalFolderRecursive(folderId) {
  var folderIdsToDelete = [String(folderId || '')].concat(getDescendantFolderIds(folderId));
  var folderSet = {};
  var materialIdsToDelete = [];
  folderIdsToDelete.forEach(function (id) {
    folderSet[String(id || '')] = true;
  });
  getMaterials().forEach(function (material) {
    var materialId = String(material[0] || '');
    var primaryFolderId = String(material[1] || '');
    var linkedFolderIds = getMaterialLinks().filter(function (link) {
      return String(link[1] || '') === materialId;
    }).map(function (link) {
      return String(link[2] || '');
    });
    if (folderSet[primaryFolderId]) {
      materialIdsToDelete.push(materialId);
      return;
    }
    if (linkedFolderIds.length && linkedFolderIds.every(function (id) { return folderSet[id]; })) {
      materialIdsToDelete.push(materialId);
    }
  });
  removeLocalMaterialLinks(function (link) {
    return folderSet[String(link[2] || '')] || materialIdsToDelete.indexOf(String(link[1] || '')) !== -1;
  });
  removeLocalMaterialsByIds(materialIdsToDelete);
  removeLocalFoldersByIds(folderIdsToDelete);
}

function getSpaceById(id) { return findById(getSpaces(), id); }
function getFolderById(id) { return findById(getFolders(), id); }
function getMaterialById(id) { return findById(getMaterials(), id); }

function getSingleExistingSpaceId() {
  var spaces = getSpaces();
  if (spaces.length === 1) {
    return String(spaces[0][0] || '');
  }
  return '';
}

function getComparableSpaceId(spaceId) {
  var raw = String(spaceId || '').trim();
  var fallback = getSingleExistingSpaceId();
  return raw || fallback || '';
}

function getFolderComparableSpaceId(folder) {
  return getComparableSpaceId(folder && folder[8] ? folder[8] : '');
}

function isOwner() {
  return Boolean(appState.data && appState.data.userContext && appState.data.userContext.isOwner);
}

function isSharedPending() {
  return Boolean(appState.data && appState.data.sharedAccessPending);
}

function isSharedSession() {
  return Boolean(appState.data && appState.data.sharedAccess && appState.data.sharedAccess.isSharedSession);
}

function canManageContent() {
  return isOwner() && !isSharedSession();
}

function getSearchQuery() {
  return String((el("searchInput") && el("searchInput").value) || "").trim().toLowerCase();
}

function parseDateValue(value) {
  var raw = String(value || "").trim();
  var date;
  if (!raw) {
    return null;
  }
  date = new Date(raw);
  if (isNaN(date.getTime())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function diffDaysFromToday(date) {
  var today;
  if (!date) {
    return null;
  }
  today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / 86400000);
}

function isRecentDate(date, days) {
  var diff = diffDaysFromToday(date);
  return diff !== null && diff >= 0 && diff < (days || 7);
}

function getFolderAvailableDate(folder) {
  return parseDateValue(folder && folder[5] ? folder[5] : "");
}

function formatFolderAvailableDate(folder) {
  var date = getFolderAvailableDate(folder);
  return date ? date.toLocaleDateString("ru-RU") : "";
}

function isFolderLocked(folder) {
  var date = getFolderAvailableDate(folder);
  return !isOwner() && Boolean(date && diffDaysFromToday(date) < 0);
}

function getFolderStatus(folder) {
  var availableDate = getFolderAvailableDate(folder);
  var updatedDate = parseDateValue(folder[7]);
  var createdDate = parseDateValue(folder[6]);
  if (availableDate && diffDaysFromToday(availableDate) < 0) {
    return { kind: "soon", label: "Скоро", note: "Откроется " + formatFolderAvailableDate(folder) };
  }
  if (plainText(folder[4] || "").trim().toLowerCase() === "есть обновления" && isRecentDate(updatedDate, 7)) {
    return { kind: "updated", label: "Есть обновления", note: "" };
  }
  if (availableDate && isRecentDate(availableDate, 7)) {
    return { kind: "new", label: "Новое", note: "" };
  }
  if (isRecentDate(createdDate, 7)) {
    return { kind: "new", label: "Новое", note: "" };
  }
  return null;
}

function getMaterialStatus(material) {
  var updatedDate = parseDateValue(material[7]);
  var createdDate = parseDateValue(material[6]);
  if (isRecentDate(updatedDate, 7)) {
    return { kind: "updated", label: "Есть обновления" };
  }
  if (isRecentDate(createdDate, 7)) {
    return { kind: "new", label: "Новое" };
  }
  return null;
}

function renderStatusBadge(status) {
  if (!status) {
    return "";
  }
  return '<span class="status-badge ' + html(status.kind) + '">' + html(status.label) + '</span>';
}

function getFolderPath(folderId) {
  var path = [];
  var current = getFolderById(folderId);
  while (current) {
    path.unshift(current);
    current = current[2] ? getFolderById(current[2]) : null;
  }
  return path;
}

function getRootFolders(spaceId) {
  var expectedSpaceId = getComparableSpaceId(spaceId);
  return getFolders().filter(function (folder) {
    var parentId = String(folder[2] || "").trim();
    if (parentId) {
      return false;
    }
    if (!spaceId) {
      return true;
    }
    return getFolderComparableSpaceId(folder) === expectedSpaceId;
  });
}

function getChildFolders(folderId) {
  return getFolders().filter(function (folder) {
    return String(folder[2] || "") === String(folderId || "");
  });
}

function getDescendantFolderIds(folderId) {
  var result = [];
  function walk(parentId) {
    getChildFolders(parentId).forEach(function (child) {
      var childId = String(child[0] || "");
      if (result.indexOf(childId) === -1) {
        result.push(childId);
        walk(childId);
      }
    });
  }
  walk(folderId);
  return result;
}

function pluralizeRu(count, one, few, many) {
  var mod10 = count % 10;
  var mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }
  return many;
}

function getFolderCounters(folderId) {
  var foldersCount = getChildFolders(folderId).length;
  var materialsCount = getMaterialsForFolder(folderId).length;
  return {
    foldersCount: foldersCount,
    materialsCount: materialsCount
  };
}

function renderFolderCounters(folderId) {
  var counters = getFolderCounters(folderId);
  var parts = [];
  if (counters.foldersCount > 0) {
    parts.push(String(counters.foldersCount) + " " + pluralizeRu(counters.foldersCount, "папка", "папки", "папок"));
  }
  if (counters.materialsCount > 0) {
    parts.push(String(counters.materialsCount) + " " + pluralizeRu(counters.materialsCount, "материал", "материала", "материалов"));
  }
  if (!parts.length) {
    parts.push("Пока пусто");
  }
  return '<div class="folder-meta">' + html(parts.join(" • ")) + '</div>';
}

function collectMaterialsByFolderIds(folderIds) {
  var allowed = {};
  var seen = {};
  var result = [];
  folderIds.forEach(function (id) { allowed[String(id)] = true; });
  getMaterials().forEach(function (material) {
    if (allowed[String(material[1] || "")] && !seen[String(material[0] || "")]) {
      seen[String(material[0] || "")] = true;
      result.push(material);
    }
  });
  getMaterialLinks().forEach(function (link) {
    var material;
    if (!allowed[String(link[2] || "")]) {
      return;
    }
    material = getMaterialById(link[1]);
    if (material && !seen[String(material[0] || "")]) {
      seen[String(material[0] || "")] = true;
      result.push(material);
    }
  });
  return result;
}
function getMaterialsForFolder(folderId) {
  return collectMaterialsByFolderIds([String(folderId || "")]);
}

function getMaterialsForFolderTree(folderId) {
  var ids = [String(folderId || "")].concat(getDescendantFolderIds(folderId));
  return collectMaterialsByFolderIds(ids);
}

function getAllMaterialsForSpace(spaceId) {
  var expectedSpaceId = getComparableSpaceId(spaceId);
  var ids = getFolders().filter(function (folder) {
    return getFolderComparableSpaceId(folder) === expectedSpaceId;
  }).map(function (folder) {
    return String(folder[0] || "");
  });
  return collectMaterialsByFolderIds(ids);
}

function getMaterialFolderIds(materialId) {
  var ids = [];
  var material = getMaterialById(materialId);
  if (material && material[1] && ids.indexOf(String(material[1])) === -1) {
    ids.push(String(material[1]));
  }
  getMaterialLinks().forEach(function (link) {
    var folderId = String(link[2] || "");
    if (String(link[1] || "") === String(materialId || "") && folderId && ids.indexOf(folderId) === -1) {
      ids.push(folderId);
    }
  });
  return ids;
}

function getTagsForMaterial(material) {
  return String(material && material[5] ? material[5] : "").split(",").map(function (tag) {
    return tag.trim();
  }).filter(Boolean);
}

function matchesFolderSearch(folder, query) {
  var q = String(query || "").trim().toLowerCase();
  if (!q) {
    return true;
  }
  return [folder[1], folder[3], getFolderPath(folder[0]).map(function (item) { return item[1]; }).join(" / ")].some(function (value) {
    return plainText(value).toLowerCase().indexOf(q) !== -1;
  });
}

function matchesMaterialSearch(material, query) {
  var q = String(query || "").trim().toLowerCase();
  if (!q) {
    return true;
  }
  return [material[2], material[4], material[5], getFolderPath(material[1]).map(function (item) { return item[1]; }).join(" / ")].some(function (value) {
    return plainText(value).toLowerCase().indexOf(q) !== -1;
  });
}

function sortFoldersForDisplay(list) {
  function priority(folder) {
    var status = getFolderStatus(folder);
    if (!status) { return 3; }
    if (status.kind === "soon") { return 0; }
    if (status.kind === "new") { return 1; }
    if (status.kind === "updated") { return 2; }
    return 3;
  }
  return list.slice().sort(function (a, b) {
    var diff = priority(a) - priority(b);
    if (diff !== 0) {
      return diff;
    }
    return String(a[1] || "").localeCompare(String(b[1] || ""), "ru");
  });
}

function getAvailableTagsForMaterials(materials) {
  var tags = [];
  materials.forEach(function (material) {
    getTagsForMaterial(material).forEach(function (tag) {
      if (tags.indexOf(tag) === -1) {
        tags.push(tag);
      }
    });
  });
  return tags.sort(function (a, b) {
    return a.localeCompare(b, "ru");
  });
}

function renderTagFilters(tags) {
  if (!tags.length) {
    return "";
  }
  return '<div class="tag-filter-bar">' + tags.map(function (tag) {
    return '<button class="tag-filter-chip ' + (appState.activeTagFilter === tag ? 'active' : '') + '" onclick="setActiveTagFilter(\'' + jsString(tag) + '\', event)">' + html(tag) + '</button>';
  }).join("") + '</div>';
}

function updateTopbar() {
  var topbar = document.querySelector(".topbar");
  var searchInput = el("searchInput");
  var addFolderBtn = el("addFolderBtn");
  var addMaterialBtn = el("addMaterialBtn");
  var spacesBtn = el("spacesBtn");
  var addSpaceBtn = el("addSpaceBtn");
  spacesBtn.classList.add("hidden");
  addSpaceBtn.classList.add("hidden");
  if (isSharedPending()) {
    topbar.classList.remove("inside");
    addFolderBtn.classList.add("hidden");
    addMaterialBtn.classList.add("hidden");
    searchInput.classList.add("hidden");
    return;
  }
  if (isSharedSession()) {
    topbar.classList.toggle("inside", Boolean(appState.currentSpaceId));
    addFolderBtn.classList.add("hidden");
    addMaterialBtn.classList.add("hidden");
    searchInput.classList.toggle("hidden", !appState.currentSpaceId);
    return;
  }
  topbar.classList.toggle("inside", Boolean(appState.currentSpaceId));
  searchInput.classList.remove("hidden");
  addFolderBtn.classList.toggle("hidden", !canManageContent());
  addMaterialBtn.classList.toggle("hidden", !(canManageContent() && appState.currentFolderId));
}

function setModalLoading(modalId, isLoading) {
  var overlay = el(modalId);
  var modal;
  if (!overlay) { return; }
  modal = overlay.querySelector(".modal");
  if (!modal) { return; }
  modal.classList.toggle("is-loading", Boolean(isLoading));
  modal.querySelectorAll("button, input, textarea").forEach(function (node) {
    node.disabled = Boolean(isLoading);
  });
}

function beginModalLoading(modalId) {
  if (appState.loadingModalId) {
    setModalLoading(appState.loadingModalId, false);
  }
  appState.loadingModalId = modalId;
  setModalLoading(modalId, true);
}

function endModalLoading(modalId) {
  setModalLoading(modalId, false);
  if (appState.loadingModalId === modalId) {
    appState.loadingModalId = "";
  }
}

function renderFolderSearchMeta(folder) {
  var path = getFolderPath(folder[0]).slice(0, -1).map(function (item) { return item[1]; }).join(" / ");
  return path ? '<div class="folder-meta">' + safeText(path) + '</div>' : "";
}

function renderMaterialSearchMeta(material) {
  var path = getFolderPath(material[1]).map(function (item) { return item[1]; }).join(" / ");
  return path ? '<div class="folder-meta">' + safeText(path) + '</div>' : "";
}

function renderHomeBreadcrumb() {
  if (isSharedSession() && appState.currentSpaceId) {
    return '<span class="breadcrumb-link" onclick="openSpace(\'' + jsString(appState.currentSpaceId) + '\')">Главная</span>';
  }
  return '<span class="breadcrumb-link" onclick="renderSpaces()">Главная</span>';
}

function getMaterialActionFolderId(materialId) {
  var material = getMaterialById(materialId);
  var folderIds = getMaterialFolderIds(materialId);
  var currentFolderId = String(appState.currentFolderId || '');
  var primaryFolderId = String(material && material[1] ? material[1] : '');
  if (currentFolderId && folderIds.indexOf(currentFolderId) !== -1) {
    return currentFolderId;
  }
  if (primaryFolderId) {
    return primaryFolderId;
  }
  return folderIds.length ? String(folderIds[0] || '') : '';
}

function reopenAfterFolderDelete(parentId) {
  if (parentId && getFolderById(parentId)) {
    openFolder(parentId);
    return;
  }
  if (appState.currentSpaceId) {
    openSpace(appState.currentSpaceId);
    return;
  }
  renderSpaces();
}

function reopenAfterMaterialDelete() {
  if (appState.currentFolderId && getFolderById(appState.currentFolderId)) {
    openFolder(appState.currentFolderId);
    return;
  }
  rerenderCurrentView();
}

function isMenuOpen(type, id) {
  return Boolean(appState.activeMenu && appState.activeMenu.type === type && String(appState.activeMenu.id) === String(id));
}
function renderActionMenu(type, id) {
  var folder;
  var isRoot;
  var materialFolderId;
  if (!canManageContent() || !isMenuOpen(type, id)) {
    return "";
  }
  if (type === "folder") {
    folder = getFolderById(id);
    isRoot = folder && !String(folder[2] || "").trim();
    return '<div class="action-menu" onclick="return stopMenuEvent(event)">' +
      '<button type="button" onclick="stopMenuEvent(event); openFolderEditModal(\'' + jsString(id) + '\')">Редактировать</button>' +
      (isRoot ? '<button type="button" onclick="stopMenuEvent(event); openFolderShareSettings(\'' + jsString(id) + '\')">Настроить доступ</button>' : '') +
      '<button type="button" onclick="stopMenuEvent(event); openFolderPickerModalForFolder(\'' + jsString(id) + '\')">Переместить</button>' +
      '<button type="button" onclick="stopMenuEvent(event); openDeleteModalForFolder(\'' + jsString(id) + '\')">Удалить</button>' +
      '</div>';
  }
  materialFolderId = getMaterialActionFolderId(id);
  return '<div class="action-menu" onclick="return stopMenuEvent(event)">' +
    '<button type="button" onclick="stopMenuEvent(event); openMaterialEditModal(\'' + jsString(id) + '\')">Редактировать</button>' +
    '<button type="button" onclick="stopMenuEvent(event); openFolderPickerModalForMaterial(\'' + jsString(id) + '\')">Добавить в папку</button>' +
    '<button type="button" onclick="stopMenuEvent(event); openDeleteModalForMaterial(\'' + jsString(id) + '\', \'' + jsString(materialFolderId) + '\')">Удалить</button>' +
    '</div>';
}

function renderFolderCard(folder, options) {
  var status = getFolderStatus(folder);
  var meta = options && options.searchMeta ? renderFolderSearchMeta(folder) : (status && status.note ? '<div class="folder-meta">' + html(status.note) + '</div>' : '');
  return '<div class="folder-card ' + (status && status.kind === 'soon' ? 'is-locked ' : '') + (isMenuOpen('folder', folder[0]) ? 'menu-open' : '') + '" onclick="openFolder(\'' + jsString(folder[0]) + '\')">' +
    '<div class="card-head">' +
      '<div class="folder-title">' + safeText(folder[1] || '') + '</div>' +
      '<div class="card-tools">' +
        renderStatusBadge(status) +
        (canManageContent() ? '<button type="button" class="menu-trigger" onclick="return onMenuTriggerClick(\'folder\',\'' + jsString(folder[0]) + '\', event)">⋯</button>' : '') +
      '</div>' +
    '</div>' +
    '<div class="folder-desc">' + safeText(folder[3] || '') + '</div>' +
    renderFolderCounters(folder[0]) +
    meta + renderActionMenu('folder', folder[0]) +
    '</div>';
}

function renderMaterialCard(material, options) {
  var tags = getTagsForMaterial(material);
  var status = getMaterialStatus(material);
  return '<div class="material-card ' + (isMenuOpen('material', material[0]) ? 'menu-open' : '') + '">' +
    '<div class="card-head">' +
      '<div class="material-title">' + safeText(material[2] || '') + '</div>' +
      '<div class="card-tools">' +
        renderStatusBadge(status) +
        (canManageContent() ? '<button type="button" class="menu-trigger" onclick="return onMenuTriggerClick(\'material\',\'' + jsString(material[0]) + '\', event)">⋯</button>' : '') +
      '</div>' +
    '</div>' +
    ((options && options.searchMeta) ? renderMaterialSearchMeta(material) : '') +
    '<div class="material-desc">' + safeText(material[4] || '') + '</div>' +
    (tags.length ? '<div class="material-tags">' + tags.map(function (tag) { return '<span class="tag">' + safeText(tag) + '</span>'; }).join('') + '</div>' : '') +
    '<a class="material-link" href="' + html(material[3] || '#') + '" target="_blank" rel="noopener noreferrer">Открыть материал</a>' +
    renderActionMenu('material', material[0]) +
    '</div>';
}

function renderSharedAccessScreen() {
  var screenState = String(appState.data && appState.data.sharedAccessState ? appState.data.sharedAccessState : '');
  var spaceName = String(appState.data && appState.data.sharedAccessSpaceName ? appState.data.sharedAccessSpaceName : 'Пространство');
  var message = String(appState.data && appState.data.sharedAccessMessage ? appState.data.sharedAccessMessage : '');
  appState.currentSpaceId = '';
  appState.currentFolderId = '';
  appState.activeTagFilter = '';
  el('breadcrumbs').innerHTML = '';
  updateTopbar();
  if (screenState === 'missing' || screenState === 'disabled') {
    el('content').innerHTML = '<div class="access-screen"><div class="access-card"><div class="access-title">' + safeText(spaceName) + '</div><div class="access-desc">' + safeText(message || 'Доступ к пространству сейчас недоступен.') + '</div></div></div>';
    return;
  }
  el('content').innerHTML = '<div id="sharedAccessModalShim" class="modal-overlay" style="display:none"><div class="modal"><div class="modal-loader" style="display:flex"><span class="spinner"></span><span>Проверяем...</span></div></div></div>' +
    '<div class="access-screen"><div class="access-card"><div class="access-title">' + safeText(spaceName) + '</div><div class="access-desc">Введите пароль, чтобы открыть пространство по постоянной ссылке.</div><div id="sharedAccessError" class="access-error hidden"></div><input id="sharedPasswordInput" type="password" placeholder="Пароль пространства" onkeydown="if(event.key===\'Enter\'){submitSharedAccess();}"><div class="modal-actions"><button type="button" onclick="submitSharedAccess()">Открыть пространство</button></div></div></div>';
}

function renderSpaces(options) {
  options = options || {};
  var q;
  var folderList;
  var materialList;
  var htmlText = '';
  if (isSharedPending()) {
    renderSharedAccessScreen();
    return;
  }
  appState.currentSpaceId = '';
  appState.currentFolderId = '';
  appState.activeTagFilter = '';
  if (!options.preserveActiveMenu) {
    appState.activeMenu = null;
  }
  el('breadcrumbs').innerHTML = '';
  updateTopbar();
  q = getSearchQuery();
  folderList = sortFoldersForDisplay(q ? getFolders().filter(function (folder) { return matchesFolderSearch(folder, q); }) : getRootFolders(''));
  materialList = q ? getMaterials().filter(function (material) { return matchesMaterialSearch(material, q); }) : [];
  if (!folderList.length && !materialList.length) {
    el('content').innerHTML = '<div class="empty">' + (q ? 'Ничего не найдено' : 'Папки не найдены') + '</div>';
    return;
  }
  if (folderList.length) {
    htmlText += '<div class="section-title">Папки</div><div class="folders-grid">' + folderList.map(function (folder) { return renderFolderCard(folder, { searchMeta: Boolean(q) }); }).join('') + '</div>';
  }
  if (materialList.length) {
    htmlText += '<div class="block-title">Материалы</div><div class="folders-grid">' + materialList.map(function (material) { return renderMaterialCard(material, { searchMeta: true }); }).join('') + '</div>';
  }
  el('content').innerHTML = htmlText;
}

function openSpace(spaceId, options) {
  options = options || {};
  var resolvedSpaceId = getComparableSpaceId(spaceId);
  var q = getSearchQuery();
  var folderList;
  var materialList;
  var space = getSpaceById(resolvedSpaceId) || getSpaceById(spaceId);
  var htmlText = '';
  appState.currentSpaceId = resolvedSpaceId;
  appState.currentFolderId = '';
  appState.activeTagFilter = '';
  if (!options.preserveActiveMenu) {
    appState.activeMenu = null;
  }
  updateTopbar();
  el('breadcrumbs').innerHTML = renderHomeBreadcrumb() + ' / ' + safeText(space && space[1] ? space[1] : '');
  folderList = sortFoldersForDisplay(q ? getFolders().filter(function (folder) { return getFolderComparableSpaceId(folder) === resolvedSpaceId && matchesFolderSearch(folder, q); }) : getRootFolders(resolvedSpaceId));
  materialList = q ? getAllMaterialsForSpace(resolvedSpaceId).filter(function (material) { return matchesMaterialSearch(material, q); }) : [];
  if (!folderList.length && !materialList.length) {
    el('content').innerHTML = '<div class="empty">' + (q ? 'Ничего не найдено' : 'Пока нет папок') + '</div>';
    return;
  }
  if (folderList.length) {
    htmlText += '<div class="block-title">' + (q ? 'Папки' : 'Главные папки') + '</div><div class="folders-grid">' + folderList.map(function (folder) { return renderFolderCard(folder, { searchMeta: Boolean(q) }); }).join('') + '</div>';
  }
  if (materialList.length) {
    htmlText += '<div class="block-title">Материалы</div><div class="folders-grid">' + materialList.map(function (material) { return renderMaterialCard(material, { searchMeta: true }); }).join('') + '</div>';
  }
  el('content').innerHTML = htmlText;
}
function openFolder(folderId, options) {
  options = options || {};
  var folder = getFolderById(folderId);
  var q;
  var folders;
  var materials;
  var htmlText = '';
  if (!folder) {
    showToast('Папка не найдена', 'error');
    renderSpaces();
    return;
  }
  if (isFolderLocked(folder)) {
    openViewerDialog('Эта папка пока недоступна. Она откроется ' + formatFolderAvailableDate(folder) + '.');
    return;
  }
  appState.currentSpaceId = getFolderComparableSpaceId(folder);
  appState.currentFolderId = String(folderId || '');
  if (!options.preserveActiveMenu) {
    appState.activeMenu = null;
  }
  updateTopbar();
  q = getSearchQuery();
  folders = getChildFolders(folderId);
  materials = getMaterialsForFolder(folderId);
  if (q) {
    folders = folders.filter(function (item) { return matchesFolderSearch(item, q); });
    materials = materials.filter(function (item) { return matchesMaterialSearch(item, q); });
  }
  folders = sortFoldersForDisplay(folders);
  if (appState.activeTagFilter) {
    materials = materials.filter(function (item) { return getTagsForMaterial(item).indexOf(appState.activeTagFilter) !== -1; });
  }
  el('breadcrumbs').innerHTML = [renderHomeBreadcrumb()].concat(getFolderPath(folderId).map(function (item) {
    return '<span class="breadcrumb-link" onclick="openFolder(\'' + jsString(item[0]) + '\')">' + safeText(item[1]) + '</span>';
  })).join(' / ');
  htmlText += '<div class="section-title">' + safeText(folder[1] || 'Папка') + '</div>';
  if (folders.length) {
    htmlText += '<div class="block-title">Папки</div><div class="folders-grid">' + folders.map(function (item) { return renderFolderCard(item, { searchMeta: Boolean(q) }); }).join('') + '</div>';
  }
  if (materials.length) {
    htmlText += '<div class="block-title">Материалы</div>' + renderTagFilters(getAvailableTagsForMaterials(getMaterialsForFolder(folderId))) + '<div class="folders-grid">' + materials.map(function (item) { return renderMaterialCard(item, { searchMeta: Boolean(q) }); }).join('') + '</div>';
  }
  if (!folders.length && !materials.length) {
    htmlText += '<div class="empty">' + (q ? 'Ничего не найдено' : 'Внутри пока ничего нет') + '</div>';
  }
  el('content').innerHTML = htmlText;
}

function rerenderCurrentView(options) {
  options = options || {};
  if (isSharedPending()) {
    renderSharedAccessScreen();
    return;
  }
  if (appState.currentFolderId) {
    openFolder(appState.currentFolderId, options);
    return;
  }
  if (isSharedSession() && appState.currentSpaceId) {
    openSpace(appState.currentSpaceId, options);
    return;
  }
  renderSpaces(options);
}

function handleSearch() {
  appState.activeTagFilter = '';
  rerenderCurrentView();
}

function stopMenuEvent(event) {
  if (event) {
    if (event.preventDefault) {
      event.preventDefault();
    }
    if (event.stopPropagation) {
      event.stopPropagation();
    }
  }
  return false;
}

function onMenuTriggerClick(type, id, event) {
  stopMenuEvent(event);
  toggleActionMenu(type, id);
  return false;
}

function toggleActionMenu(type, id, event) {
  var same = appState.activeMenu && appState.activeMenu.type === type && String(appState.activeMenu.id) === String(id);
  if (event) {
    if (event.preventDefault) {
      event.preventDefault();
    }
    if (event.stopPropagation) {
      event.stopPropagation();
    }
  }
  appState.activeMenu = same ? null : { type: type, id: id };
  rerenderCurrentView({ preserveActiveMenu: true });
}

function setActiveTagFilter(tag, event) {
  if (event) {
    event.stopPropagation();
  }
  appState.activeTagFilter = appState.activeTagFilter === String(tag || '') ? '' : String(tag || '');
  rerenderCurrentView();
}

function openConfirmModal(options) {
  options = options || {};
  appState.confirm = { onConfirm: typeof options.onConfirm === 'function' ? options.onConfirm : null };
  el('confirmModalTitle').textContent = options.title || 'Подтверждение';
  el('confirmModalText').textContent = options.message || '';
  el('confirmModalSubmitBtn').textContent = options.confirmText || 'Подтвердить';
  el('confirmModal').style.display = 'flex';
}

function closeConfirmModal() { appState.confirm = null; el('confirmModal').style.display = 'none'; }
function closeConfirmModalByOverlay(event) { if (event.target.id === 'confirmModal') { closeConfirmModal(); } }
function submitConfirmModal() { var action = appState.confirm && appState.confirm.onConfirm ? appState.confirm.onConfirm : null; closeConfirmModal(); if (action) { action(); } }
function openViewerDialog(message) { el('viewerDialogText').textContent = String(message || ''); el('viewerDialogModal').style.display = 'flex'; }
function closeViewerDialog() { el('viewerDialogModal').style.display = 'none'; }
function closeViewerDialogByOverlay(event) { if (event.target.id === 'viewerDialogModal') { closeViewerDialog(); } }
function openSpaceModal() { return; }
function saveSpace() { return; }
function closeSpaceModal() { endModalLoading('spaceModal'); el('spaceModal').style.display = 'none'; }
function closeSpaceModalByOverlay(event) { if (event.target.id === 'spaceModal') { closeSpaceModal(); } }

function openFolderModal() {
  if (!canManageContent()) { showToast('У тебя сейчас нет прав на создание папок в этом режиме', 'error'); return; }
  appState.editingFolderId = '';
  el('folderModalTitle').textContent = 'Создать папку';
  el('folderSubmitBtn').textContent = 'Сохранить';
  el('folderName').value = '';
  el('folderDesc').value = '';
  el('folderDate').value = '';
  el('folderModal').style.display = 'flex';
}

function openFolderEditModal(folderId) {
  var folder = getFolderById(folderId);
  if (!canManageContent() || !folder) { return; }
  appState.activeMenu = null;
  appState.editingFolderId = String(folderId || '');
  el('folderModalTitle').textContent = 'Редактировать папку';
  el('folderSubmitBtn').textContent = 'Сохранить';
  el('folderName').value = folder[1] || '';
  el('folderDesc').value = folder[3] || '';
  el('folderDate').value = folder[5] ? String(folder[5]).slice(0, 10) : '';
  el('folderModal').style.display = 'flex';
}

function closeFolderModal() { appState.editingFolderId = ''; endModalLoading('folderModal'); el('folderModal').style.display = 'none'; }
function closeFolderModalByOverlay(event) { if (event.target.id === 'folderModal') { closeFolderModal(); } }

function saveFolder() {
  var name = el('folderName').value.trim();
  var description = el('folderDesc').value.trim();
  var availableFrom = el('folderDate').value.trim();
  var parentId = appState.currentFolderId || '';
  var editedId;
  var rerenderFolderId;
  var optimisticId;
  if (!name) { showToast('Введите название папки', 'error'); return; }
  optimisticId = 'folder_local_' + Date.now();
  beginModalLoading('folderModal');
  if (appState.editingFolderId) {
    editedId = appState.editingFolderId;
    rerenderFolderId = appState.currentFolderId === editedId ? editedId : appState.currentFolderId;
    google.script.run.withSuccessHandler(function () {
      updateLocalFolderById(editedId, {
        name: name,
        description: description,
        availableFrom: availableFrom,
        badge: 'Есть обновления',
        updated: new Date()
      });
      closeFolderModal();
      showToast('Папка обновлена', 'success');
      if (rerenderFolderId) {
        openFolder(rerenderFolderId);
      } else if (appState.currentSpaceId) {
        openSpace(appState.currentSpaceId);
      } else {
        renderSpaces();
      }
    }).withFailureHandler(function (err) {
      endModalLoading('folderModal');
      showToast(getErrorText(err), 'error');
    }).updateFolder(editedId, name, description, availableFrom);
    return;
  }
  google.script.run.withSuccessHandler(function (result) {
    var createdAt;
    var folderRow;
    closeFolderModal();
    showToast('Папка создана', 'success');
    if (result && (result.id || optimisticId)) {
      createdAt = result.created || new Date();
      folderRow = [
        result.id || optimisticId,
        result.name || name,
        result.parentId || parentId || '',
        result.description || description || '',
        result.badge || 'Новое',
        result.availableFrom || availableFrom || '',
        createdAt,
        result.updated || createdAt,
        result.spaceId || appState.currentSpaceId || ''
      ];
      upsertLocalFolder(folderRow);
      appState.currentSpaceId = String(folderRow[8] || '');
      openFolder(folderRow[0]);
      return;
    }
    refreshDataAndRender({ mode: 'spaces' });
  }).withFailureHandler(function (err) {
    endModalLoading('folderModal');
    showToast(getErrorText(err), 'error');
  }).addFolder(name, parentId, description, availableFrom, appState.currentSpaceId || '');
}
function isValidMaterialUrl(url) {
  var value = String(url || '').trim();
  var parsed;
  if (!value) { return true; }
  try {
    parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

function openMaterialModal() {
  if (!canManageContent()) { showToast('У тебя сейчас нет прав на создание материалов в этом режиме', 'error'); return; }
  if (!appState.currentFolderId) { showToast('Сначала открой папку', 'error'); return; }
  appState.editingMaterialId = '';
  el('materialModalTitle').textContent = 'Создать материал';
  el('materialSubmitBtn').textContent = 'Сохранить';
  el('materialTitle').value = '';
  el('materialUrl').value = '';
  el('materialDesc').value = '';
  el('materialTags').value = '';
  el('materialModal').style.display = 'flex';
}

function openMaterialEditModal(materialId) {
  var material = getMaterialById(materialId);
  if (!canManageContent() || !material) { return; }
  appState.activeMenu = null;
  appState.editingMaterialId = String(materialId || '');
  el('materialModalTitle').textContent = 'Редактировать материал';
  el('materialSubmitBtn').textContent = 'Сохранить';
  el('materialTitle').value = material[2] || '';
  el('materialUrl').value = material[3] || '';
  el('materialDesc').value = material[4] || '';
  el('materialTags').value = material[5] || '';
  el('materialModal').style.display = 'flex';
}

function closeMaterialModal() { appState.editingMaterialId = ''; endModalLoading('materialModal'); el('materialModal').style.display = 'none'; }
function closeMaterialModalByOverlay(event) { if (event.target.id === 'materialModal') { closeMaterialModal(); } }

function saveMaterial() {
  var title = el('materialTitle').value.trim();
  var url = el('materialUrl').value.trim();
  var description = el('materialDesc').value.trim();
  var tags = el('materialTags').value.trim();
  var editedId;
  var optimisticId;
  if (!appState.currentFolderId) { showToast('Сначала открой папку', 'error'); return; }
  if (!title) { showToast('Введите название материала', 'error'); return; }
  if (!isValidMaterialUrl(url)) { showToast('Укажи корректную ссылку, которая начинается с http:// или https://', 'error'); return; }
  optimisticId = 'material_local_' + Date.now();
  beginModalLoading('materialModal');
  if (appState.editingMaterialId) {
    editedId = appState.editingMaterialId;
    google.script.run.withSuccessHandler(function () {
      updateLocalMaterialById(editedId, {
        title: title,
        url: url,
        description: description,
        tags: tags,
        updated: new Date()
      });
      closeMaterialModal();
      showToast('Материал обновлён', 'success');
      openFolder(appState.currentFolderId);
    }).withFailureHandler(function (err) {
      endModalLoading('materialModal');
      showToast(getErrorText(err), 'error');
    }).updateMaterial(editedId, title, url, description, tags);
    return;
  }
  google.script.run.withSuccessHandler(function (result) {
    var createdAt;
    var materialId;
    var materialRow;
    closeMaterialModal();
    showToast('Материал создан', 'success');
    createdAt = new Date();
    materialId = result && result.id ? result.id : optimisticId;
    materialRow = [
      materialId,
      appState.currentFolderId,
      title,
      url,
      description,
      tags,
      createdAt,
      ""
    ];
    upsertLocalMaterial(materialRow);
    upsertLocalMaterialLink([
      'link_local_' + Date.now(),
      materialId,
      appState.currentFolderId,
      createdAt
    ]);
    openFolder(appState.currentFolderId);
  }).withFailureHandler(function (err) {
    endModalLoading('materialModal');
    showToast(getErrorText(err), 'error');
  }).addMaterial(appState.currentFolderId, title, url, description, tags);
}

function buildFolderPickerChildrenMap(list) {
  var allowed = {};
  var map = {};
  list.forEach(function (folder) { allowed[String(folder[0] || '')] = true; });
  list.forEach(function (folder) {
    var parentId = String(folder[2] || '');
    if (parentId && allowed[parentId]) {
      map[parentId] = map[parentId] || [];
      map[parentId].push(folder);
    }
  });
  return map;
}

function buildFolderPickerSpaceGroups(list) {
  var allowed = {};
  list.forEach(function (folder) {
    allowed[String(folder[0] || '')] = true;
  });
  return [{
    spaceId: '',
    spaceName: 'Все папки',
    folders: list.slice(),
    rootFolders: list.filter(function (folder) {
      var parentId = String(folder[2] || '');
      return !parentId || !allowed[parentId];
    })
  }];
}

function getFolderPickerLabel(folder) {
  var parts = [];
  getFolderPath(folder[0]).forEach(function (item) { parts.push(item[1]); });
  return parts.join(' / ');
}

function renderFolderPickerNode(folder, depth) {
  var folderId = String(folder[0] || '');
  var children = (appState.folderPicker.childrenMap[folderId] || []).slice().sort(function (a, b) { return String(a[1] || '').localeCompare(String(b[1] || ''), 'ru'); });
  var expanded = appState.folderPicker.expandedIds.indexOf(folderId) !== -1;
  var disabled = appState.folderPicker.disabledIds.indexOf(folderId) !== -1;
  var selected = appState.folderPicker.selectedIds.indexOf(folderId) !== -1;
  var disabledReason = appState.folderPicker.disabledReasonById && appState.folderPicker.disabledReasonById[folderId] ? appState.folderPicker.disabledReasonById[folderId] : 'уже выбрано';
  var note = disabled ? getFolderPickerLabel(folder) + ' — ' + disabledReason : getFolderPickerLabel(folder);
  var inputType = appState.folderPicker.type === 'folder' && !appState.folderPicker.multiple ? 'radio' : 'checkbox';
  var isMultiple = appState.folderPicker.type !== 'folder' || Boolean(appState.folderPicker.multiple);
  return '<div class="picker-option"><div class="picker-row ' + (disabled ? 'is-disabled' : '') + '" style="padding-left:' + (14 + depth * 24) + 'px">' +
    '<button type="button" class="picker-toggle ' + (children.length ? '' : 'placeholder') + '" onclick="toggleFolderPickerExpand(\'' + jsString(folderId) + '\', event)">' + (children.length ? (expanded ? '▾' : '▸') : '•') + '</button>' +
    '<input class="picker-input" type="' + inputType + '" ' + (appState.folderPicker.type === 'folder' && !appState.folderPicker.multiple ? 'name="folderPickerSingle"' : '') + ' ' + (selected ? 'checked' : '') + ' ' + (disabled ? 'disabled' : '') + ' onchange="selectFolderPickerOption(\'' + jsString(folderId) + '\', ' + (isMultiple ? 'true' : 'false') + ')">' +
    '<span class="picker-text"><span class="picker-title">' + html(folder[1] || '') + '</span><span class="picker-note">' + html(note) + '</span></span></div>' +
    (children.length && expanded ? '<div class="picker-children">' + children.map(function (child) { return renderFolderPickerNode(child, depth + 1); }).join('') + '</div>' : '') +
    '</div>';
}

function renderFolderPickerTree() {
  var groups;
  var roots;
  if (!appState.folderPicker) { return; }
  groups = (appState.folderPicker.spaceGroups || []).slice();
  if (groups.length) {
    el('folderPickerList').innerHTML = groups.map(function (group) {
    var roots = (group.rootFolders || []).slice().sort(function (a, b) { return String(a[1] || '').localeCompare(String(b[1] || ''), 'ru'); });
    return '<div class="picker-space-group">' +
      '<div class="picker-space-title">' + html(group.spaceName || 'Без пространства') + '</div>' +
      (roots.length ? roots.map(function (folder) { return renderFolderPickerNode(folder, 0); }).join('') : '<div class="empty">В этом пространстве нет доступных папок</div>') +
      '</div>';
    }).join('');
    return;
  }
  roots = (appState.folderPicker.rootFolders || []).slice().sort(function (a, b) { return String(a[1] || '').localeCompare(String(b[1] || ''), 'ru'); });
  el('folderPickerList').innerHTML = roots.length ? roots.map(function (folder) {
    return renderFolderPickerNode(folder, 0);
  }).join('') : '<div class="empty">' + html(appState.folderPicker.emptyText || 'Нет доступных папок') + '</div>';
}
function toggleFolderPickerExpand(folderId, event) {
  var index;
  if (event) { event.stopPropagation(); }
  if (!appState.folderPicker) { return; }
  index = appState.folderPicker.expandedIds.indexOf(folderId);
  if (index === -1) { appState.folderPicker.expandedIds.push(folderId); } else { appState.folderPicker.expandedIds.splice(index, 1); }
  renderFolderPickerTree();
}

function selectFolderPickerOption(folderId, multiple) {
  var index;
  if (!appState.folderPicker || appState.folderPicker.disabledIds.indexOf(String(folderId || '')) !== -1) { return; }
  if (!multiple) { appState.folderPicker.selectedIds = [String(folderId || '')]; return; }
  index = appState.folderPicker.selectedIds.indexOf(String(folderId || ''));
  if (index === -1) { appState.folderPicker.selectedIds.push(String(folderId || '')); } else { appState.folderPicker.selectedIds.splice(index, 1); }
}

function openFolderPickerModalForFolder(folderId) {
  var folder = getFolderById(folderId);
  var blocked = getDescendantFolderIds(folderId).concat([String(folderId || '')]);
  var options;
  var allowed = {};
  if (!canManageContent() || !folder) { return; }
  appState.activeMenu = null;
  options = getFolders().filter(function (item) {
    return blocked.indexOf(String(item[0] || '')) === -1;
  });
  options.forEach(function (item) { allowed[String(item[0] || '')] = true; });
  appState.folderPicker = {
    type: 'folder',
    multiple: true,
    sourceId: String(folderId || ''),
    selectedIds: [],
    expandedIds: [],
    disabledIds: [],
    disabledReasonById: {},
    childrenMap: buildFolderPickerChildrenMap(options),
    rootFolders: options.filter(function (item) {
      var parentId = String(item[2] || '');
      return !parentId || !allowed[parentId];
    }),
    spaceGroups: [],
    emptyText: 'Нет доступных папок для перемещения'
  };
  el('folderPickerTitle').textContent = 'Выберите одну или несколько папок';
  el('folderPickerSubmitBtn').textContent = 'Переместить';
  renderFolderPickerTree();
  el('folderPickerModal').style.display = 'flex';
}

function openFolderPickerModalForMaterial(materialId) {
  var list;
  var disabledReasonById = {};
  if (!canManageContent()) { return; }
  list = getFolders().slice();
  appState.activeMenu = null;
  getMaterialFolderIds(materialId).forEach(function (folderId) {
    disabledReasonById[String(folderId || '')] = 'уже выбрано';
  });
  appState.folderPicker = {
    type: 'material',
    sourceId: String(materialId || ''),
    selectedIds: [],
    expandedIds: [],
    disabledIds: getMaterialFolderIds(materialId),
    disabledReasonById: disabledReasonById,
    childrenMap: buildFolderPickerChildrenMap(list),
    spaceGroups: buildFolderPickerSpaceGroups(list),
    emptyText: 'Нет доступных папок для копирования'
  };
  el('folderPickerTitle').textContent = 'Выберите папки для копии материала';
  el('folderPickerSubmitBtn').textContent = 'Добавить';
  renderFolderPickerTree();
  el('folderPickerModal').style.display = 'flex';
}

function closeFolderPickerModal() { appState.folderPicker = null; endModalLoading('folderPickerModal'); el('folderPickerModal').style.display = 'none'; }
function closeFolderPickerModalByOverlay(event) { if (event.target.id === 'folderPickerModal') { closeFolderPickerModal(); } }

function submitFolderPicker() {
  var selectedIds;
  var movedFolderId;
  var materialId;
  var refreshOptions;
  if (!appState.folderPicker || !appState.folderPicker.selectedIds.length) { showToast('Сначала выберите папку', 'error'); return; }
  selectedIds = appState.folderPicker.selectedIds.slice();
  beginModalLoading('folderPickerModal');
  if (appState.folderPicker.type === 'folder') {
    movedFolderId = appState.folderPicker.sourceId;
    refreshOptions = appState.currentFolderId && appState.currentFolderId !== movedFolderId
      ? { mode: 'folder', folderId: appState.currentFolderId }
      : (appState.currentSpaceId ? { mode: 'space', spaceId: appState.currentSpaceId } : { mode: 'spaces' });
    if (selectedIds.length > 1) {
      google.script.run.withSuccessHandler(function () {
        try {
          closeFolderPickerModal();
          showToast('Папка добавлена в выбранные папки', 'success');
          if (appState.currentFolderId) {
            openFolder(appState.currentFolderId);
          } else if (appState.currentSpaceId) {
            openSpace(appState.currentSpaceId);
          } else {
            renderSpaces();
          }
        } catch (err) {
          closeFolderPickerModal();
          showToast(getErrorText(err, 'Ошибка обновления интерфейса'), 'error');
          try {
            renderSpaces();
          } catch (nestedErr) {
            renderFatalError('Ошибка обновления интерфейса', getErrorText(err));
          }
        }
      }).withFailureHandler(function (err) {
        endModalLoading('folderPickerModal');
        showToast(getErrorText(err), 'error');
      }).copyFolderToFolders(movedFolderId, selectedIds);
      return;
    }
    google.script.run.withSuccessHandler(function () {
      closeFolderPickerModal();
      showToast('Папка перемещена', 'success');
      refreshDataAndRender(refreshOptions);
    }).withFailureHandler(function (err) {
      endModalLoading('folderPickerModal');
      showToast(getErrorText(err), 'error');
    }).moveFolder(movedFolderId, selectedIds[0]);
    return;
  }
  materialId = appState.folderPicker.sourceId;
  google.script.run.withSuccessHandler(function () {
    addLocalMaterialToFolders(materialId, selectedIds);
    closeFolderPickerModal();
    showToast('Материал добавлен в выбранные папки', 'success');
    openFolder(appState.currentFolderId);
  }).withFailureHandler(function (err) {
    endModalLoading('folderPickerModal');
    showToast(getErrorText(err), 'error');
  }).addMaterialToFolders(materialId, selectedIds);
}

function openDeleteModalForFolder(folderId) {
  var folder = getFolderById(folderId);
  if (!canManageContent() || !folder) { return; }
  appState.activeMenu = null;
  appState.deleteTarget = { type: 'folder', id: String(folderId || ''), parentId: String(folder[2] || '') };
  el('deleteModalTitle').textContent = 'Переместить в корзину';
  el('deleteModalText').textContent = 'Папка "' + plainText(folder[1] || '') + '" и всё её содержимое исчезнут с сайта и будут сохранены в корзине.';
  el('deleteSingleBtn').textContent = 'В корзину';
  el('deleteAllBtn').classList.add('hidden');
  el('deleteModal').style.display = 'flex';
}

function openDeleteModalForMaterial(materialId, folderId) {
  var material = getMaterialById(materialId);
  if (!canManageContent() || !material) { return; }
  appState.activeMenu = null;
  appState.deleteTarget = { type: 'material', id: String(materialId || ''), folderId: String(folderId || getMaterialActionFolderId(materialId) || '') };
  el('deleteModalTitle').textContent = 'Удалить материал';
  el('deleteModalText').textContent = 'Что сделать с материалом "' + plainText(material[2] || '') + '"?';
  el('deleteSingleBtn').textContent = 'Удалить только из этой папки';
  el('deleteAllBtn').textContent = 'Удалить везде';
  el('deleteAllBtn').classList.remove('hidden');
  el('deleteModal').style.display = 'flex';
}

function closeDeleteModal() { appState.deleteTarget = null; endModalLoading('deleteModal'); el('deleteModal').style.display = 'none'; }
function closeDeleteModalByOverlay(event) { if (event.target.id === 'deleteModal') { closeDeleteModal(); } }
function confirmDeleteSingle() {
  var deleteTarget;
  if (!appState.deleteTarget) { return; }
  deleteTarget = appState.deleteTarget;
  beginModalLoading('deleteModal');
  if (deleteTarget.type === 'folder') {
    google.script.run.withSuccessHandler(function () {
      removeLocalFolderRecursive(deleteTarget.id);
      closeDeleteModal();
      showToast('Папка перемещена в корзину', 'success');
      reopenAfterFolderDelete(deleteTarget.parentId);
    }).withFailureHandler(function (err) {
      endModalLoading('deleteModal');
      showToast(getErrorText(err), 'error');
    }).deleteFolderRecursive(deleteTarget.id);
    return;
  }
  google.script.run.withSuccessHandler(function () {
    removeLocalMaterialFromFolder(deleteTarget.id, deleteTarget.folderId);
    closeDeleteModal();
    showToast('Материал удалён из папки', 'success');
    reopenAfterMaterialDelete();
  }).withFailureHandler(function (err) {
    endModalLoading('deleteModal');
    showToast(getErrorText(err), 'error');
  }).removeMaterialFromFolder(deleteTarget.id, deleteTarget.folderId);
}

function confirmDeleteAll() {
  var deleteTarget;
  if (!appState.deleteTarget) { return; }
  deleteTarget = appState.deleteTarget;
  beginModalLoading('deleteModal');
  if (deleteTarget.type === 'folder') {
    google.script.run.withSuccessHandler(function () {
      removeLocalFolderRecursive(deleteTarget.id);
      closeDeleteModal();
      showToast('Папка перемещена в корзину', 'success');
      reopenAfterFolderDelete(deleteTarget.parentId);
    }).withFailureHandler(function (err) {
      endModalLoading('deleteModal');
      showToast(getErrorText(err), 'error');
    }).deleteFolderRecursive(deleteTarget.id);
    return;
  }
  google.script.run.withSuccessHandler(function () {
    removeLocalMaterialsByIds([deleteTarget.id]);
    removeLocalMaterialLinks(function (link) {
      return String(link[1] || '') === String(deleteTarget.id || '');
    });
    closeDeleteModal();
    showToast('Материал удалён полностью', 'success');
    reopenAfterMaterialDelete();
  }).withFailureHandler(function (err) {
    endModalLoading('deleteModal');
    showToast(getErrorText(err), 'error');
  }).deleteMaterial(deleteTarget.id);
}

function applyShareSettingsToLocalSpace(spaceId, settings) {
  var space = getSpaceById(spaceId);
  if (!space || !settings) { return; }
  space[3] = settings.shareSlug || '';
  space[4] = settings.sharePassword || '';
  space[5] = settings.shareEnabled ? 'true' : 'false';
  space[6] = settings.directAccessToken || '';
  space[7] = settings.directAccessEnabled ? 'true' : 'false';
}

function renderShareModalState() {
  var context = appState.shareContext || { type: 'Раздел', name: '' };
  el('shareModalTitle').textContent = 'Настроить доступ';
  el('shareModalText').textContent = context.type + ' "' + plainText(context.name || 'Без названия') + '"';
  if (!appState.shareSettings) {
    el('shareLinkInput').value = '';
    el('sharePasswordInput').value = '';
    el('directAccessLinkInput').value = '';
    el('shareStatusText').textContent = appState.shareSpaceId ? 'Загружаем настройки доступа...' : 'Не удалось определить пространство для настроек доступа.';
    el('shareStatusText').classList.remove('hidden');
    el('shareEnabledBtn').classList.remove('is-on');
    el('directAccessEnabledBtn').classList.remove('is-on');
    return;
  }
  el('shareLinkInput').value = appState.shareSettings.shareUrl || '';
  el('sharePasswordInput').value = appState.shareSettings.sharePassword || '';
  el('directAccessLinkInput').value = appState.shareSettings.directAccessUrl || '';
  el('shareStatusText').textContent = [
    appState.shareSettings.shareEnabled ? 'Постоянная ссылка с паролем включена.' : 'Постоянная ссылка с паролем выключена.',
    appState.shareSettings.directAccessEnabled ? 'Быстрая ссылка без пароля включена.' : 'Быстрая ссылка без пароля выключена.'
  ].join(' ');
  el('shareStatusText').classList.remove('hidden');
  el('shareEnabledBtn').classList.toggle('is-on', Boolean(appState.shareSettings.shareEnabled));
  el('directAccessEnabledBtn').classList.toggle('is-on', Boolean(appState.shareSettings.directAccessEnabled));
}

function openSpaceShareSettings(spaceId) {
  appState.shareSpaceId = String(spaceId || '');
  appState.shareSettings = null;
  appState.activeMenu = null;
  if (!appState.shareSpaceId) {
    renderShareModalState();
    el('shareModal').style.display = 'flex';
    showToast('Не удалось определить пространство для настроек доступа', 'error');
    return;
  }
  renderShareModalState();
  el('shareModal').style.display = 'flex';
  google.script.run.withSuccessHandler(function (result) {
    appState.shareSettings = result;
    applyShareSettingsToLocalSpace(spaceId, result);
    renderShareModalState();
  }).withFailureHandler(function (err) {
    appState.shareSettings = null;
    renderShareModalState();
    showToast(getErrorText(err), 'error');
  }).getSpaceShareSettings(spaceId);
}

function openFolderShareSettings(folderId) {
  var folder = getFolderById(folderId);
  var resolvedSpaceId;
  if (!canManageContent() || !folder) { return; }
  appState.activeMenu = null;
  appState.shareContext = { type: 'Корневая папка', name: folder[1] || 'Без названия' };
  resolvedSpaceId = String(folder[8] || appState.currentSpaceId || '');
  openSpaceShareSettings(resolvedSpaceId);
}

function closeShareModal() { appState.shareSpaceId = ''; appState.shareSettings = null; appState.shareContext = null; endModalLoading('shareModal'); el('shareModal').style.display = 'none'; }
function closeShareModalByOverlay(event) { if (event.target.id === 'shareModal') { closeShareModal(); } }
function copyInputValue(id) { var input = el(id); var value = input ? String(input.value || '').trim() : ''; if (!value) { showToast('Ссылка пока не готова', 'error'); return; } if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(value).then(function () { showToast('Ссылка скопирована', 'success'); }).catch(function () { input.select(); document.execCommand('copy'); showToast('Ссылка скопирована', 'success'); }); return; } input.select(); document.execCommand('copy'); showToast('Ссылка скопирована', 'success'); }
function copyShareLink() { copyInputValue('shareLinkInput'); }
function copyDirectAccessLink() { copyInputValue('directAccessLinkInput'); }
function saveSharePassword() { if (!appState.shareSpaceId) { return; } beginModalLoading('shareModal'); google.script.run.withSuccessHandler(function (result) { appState.shareSettings = result; applyShareSettingsToLocalSpace(appState.shareSpaceId, result); endModalLoading('shareModal'); renderShareModalState(); showToast('Пароль обновлён', 'success'); }).withFailureHandler(function (err) { endModalLoading('shareModal'); showToast(getErrorText(err), 'error'); }).updateSpacePassword(appState.shareSpaceId, el('sharePasswordInput').value.trim()); }
function regenerateShareLink() { if (!appState.shareSpaceId) { return; } openConfirmModal({ title: 'Перевыпустить ссылку', message: 'Старая ссылка пространства перестанет работать.', confirmText: 'Перевыпустить', onConfirm: function () { beginModalLoading('shareModal'); google.script.run.withSuccessHandler(function (result) { appState.shareSettings = result; applyShareSettingsToLocalSpace(appState.shareSpaceId, result); endModalLoading('shareModal'); renderShareModalState(); showToast('Ссылка обновлена', 'success'); }).withFailureHandler(function (err) { endModalLoading('shareModal'); showToast(getErrorText(err), 'error'); }).regenerateSpaceShareLink(appState.shareSpaceId); } }); }
function toggleShareEnabled() { if (!appState.shareSpaceId) { return; } beginModalLoading('shareModal'); google.script.run.withSuccessHandler(function (result) { appState.shareSettings = result; applyShareSettingsToLocalSpace(appState.shareSpaceId, result); endModalLoading('shareModal'); renderShareModalState(); }).withFailureHandler(function (err) { endModalLoading('shareModal'); showToast(getErrorText(err), 'error'); }).toggleSpaceShare(appState.shareSpaceId, !(appState.shareSettings && appState.shareSettings.shareEnabled)); }
function regenerateDirectAccessLink() { if (!appState.shareSpaceId) { return; } openConfirmModal({ title: 'Перевыпустить быструю ссылку', message: 'Старая быстрая ссылка перестанет работать.', confirmText: 'Перевыпустить', onConfirm: function () { beginModalLoading('shareModal'); google.script.run.withSuccessHandler(function (result) { appState.shareSettings = result; applyShareSettingsToLocalSpace(appState.shareSpaceId, result); endModalLoading('shareModal'); renderShareModalState(); showToast('Быстрая ссылка обновлена', 'success'); }).withFailureHandler(function (err) { endModalLoading('shareModal'); showToast(getErrorText(err), 'error'); }).regenerateDirectAccessLink(appState.shareSpaceId); } }); }
function toggleDirectAccessEnabled() { if (!appState.shareSpaceId) { return; } beginModalLoading('shareModal'); google.script.run.withSuccessHandler(function (result) { appState.shareSettings = result; applyShareSettingsToLocalSpace(appState.shareSpaceId, result); endModalLoading('shareModal'); renderShareModalState(); }).withFailureHandler(function (err) { endModalLoading('shareModal'); showToast(getErrorText(err), 'error'); }).toggleDirectAccess(appState.shareSpaceId, !(appState.shareSettings && appState.shareSettings.directAccessEnabled)); }
function submitSharedAccess() { var password = el('sharedPasswordInput'); var errorNode = el('sharedAccessError'); if (!password) { return; } errorNode.textContent = ''; errorNode.classList.add('hidden'); beginModalLoading('sharedAccessModalShim'); google.script.run.withSuccessHandler(function (result) { endModalLoading('sharedAccessModalShim'); appState.data = result; if (result && result.sharedAccess && result.sharedAccess.spaceId) { openSpace(result.sharedAccess.spaceId); } else { renderSpaces(); } }).withFailureHandler(function (err) { endModalLoading('sharedAccessModalShim'); errorNode.textContent = getErrorText(err, 'Ошибка доступа'); errorNode.classList.remove('hidden'); }).verifySpaceShareAccess(appState.data.sharedAccessSlug, password.value); }
function refreshDataAndRender(options) { options = options || {}; google.script.run.withSuccessHandler(function (freshData) { try { appState.data = freshData; appState.activeMenu = null; if (options.mode === 'folder' && options.folderId) { if (getFolderById(options.folderId)) { openFolder(options.folderId); } else if (isSharedSession() && appState.currentSpaceId) { openSpace(appState.currentSpaceId); } else if (appState.currentSpaceId) { openSpace(appState.currentSpaceId); } else { renderSpaces(); } return; } if (options.mode === 'space') { if (options.spaceId) { openSpace(options.spaceId); } else { renderSpaces(); } return; } if (isSharedSession() && appState.currentSpaceId) { openSpace(appState.currentSpaceId); return; } if (appState.currentSpaceId) { openSpace(appState.currentSpaceId); return; } renderSpaces(); } catch (err) { showToast(getErrorText(err, 'Ошибка обновления интерфейса'), 'error'); if (appState.currentSpaceId) { try { openSpace(appState.currentSpaceId); return; } catch (nestedErr) {} } try { renderSpaces(); } catch (finalErr) { renderFatalError('Ошибка обновления интерфейса', getErrorText(err)); } } }).withFailureHandler(function (err) { showToast(getErrorText(err), 'error'); }).getData(); }

document.addEventListener('click', function (event) {
  var target = event && event.target ? event.target : null;
  if (!appState.activeMenu) {
    return;
  }
  if (target && target.closest && target.closest('.menu-trigger, .action-menu')) {
    return;
  }
  appState.activeMenu = null;
  rerenderCurrentView();
});

async function initializeApp() {
  try {
    appState.data = await loadBootstrapData();
    if (isSharedSession() && appState.data && appState.data.sharedAccess && appState.data.sharedAccess.spaceId) {
      openSpace(appState.data.sharedAccess.spaceId);
    } else {
      renderSpaces();
    }
  } catch (err) {
    appState.data = createFallbackData();
    renderFatalError('Ошибка запуска интерфейса', getErrorText(err));
  }
}

initializeApp();
