const STORAGE_KEY = "team-wheel-state-v1";
const HISTORY_KEY = "team-wheel-history-v1";
const COLORS = ["#e34b43", "#2368b8", "#1c8f62", "#f0b429", "#8b5cf6", "#13a3a8", "#f97316", "#4b5563"];

const canvas = document.querySelector("#wheelCanvas");
const ctx = canvas.getContext("2d");
const spinButton = document.querySelector("#spinButton");
const resultName = document.querySelector("#resultName");
const groupList = document.querySelector("#groupList");
const addGroupForm = document.querySelector("#addGroupForm");
const groupNameInput = document.querySelector("#groupNameInput");
const groupTemplate = document.querySelector("#groupTemplate");
const memberTemplate = document.querySelector("#memberTemplate");
const shareButton = document.querySelector("#shareButton");
const shareWinnerButton = document.querySelector("#shareWinnerButton");
const selectAllButton = document.querySelector("#selectAllButton");
const clearAllButton = document.querySelector("#clearAllButton");
const resetButton = document.querySelector("#resetButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const statsList = document.querySelector("#statsList");
const historyList = document.querySelector("#historyList");
const toast = document.querySelector("#toast");

let state = loadState();
let winnerHistory = loadHistory();
let rotation = 0;
let spinState = "idle";
let spinAnimationId = 0;
let spinEntries = null;
let spinVelocity = 0;
let lastFrameTime = 0;
let stopAnimation = null;
let toastTimer = 0;
let lastWinner = null;

render();

addGroupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = groupNameInput.value.trim();
  if (!name) return;

  state.groups.push({
    id: createId(),
    name,
    active: true,
    members: []
  });
  groupNameInput.value = "";
  commit();
});

spinButton.addEventListener("click", handleSpinButton);
shareButton.addEventListener("click", shareCurrentState);
shareWinnerButton.addEventListener("click", shareWinnerMessage);

selectAllButton.addEventListener("click", () => {
  state.groups.forEach((group) => {
    group.active = true;
    group.members.forEach((member) => {
      member.active = true;
    });
  });
  commit();
});

clearAllButton.addEventListener("click", () => {
  state.groups.forEach((group) => {
    group.active = false;
    group.members.forEach((member) => {
      member.active = false;
    });
  });
  commit();
});

resetButton.addEventListener("click", () => {
  clearAllHistory();
});

clearHistoryButton.addEventListener("click", () => {
  clearAllHistory();
});

window.addEventListener("hashchange", () => {
  const sharedState = readStateFromHash();
  if (!sharedState) return;
  stopImmediate();
  state = sharedState;
  rotation = 0;
  commit("공유된 설정을 불러왔습니다");
});

function createDefaultState() {
  return {
    groups: [
      {
        id: createId(),
        name: "1팀",
        active: true,
        members: [
          { id: createId(), name: "민수", active: true },
          { id: createId(), name: "지영", active: true }
        ]
      },
      {
        id: createId(),
        name: "2팀",
        active: true,
        members: [
          { id: createId(), name: "현우", active: true },
          { id: createId(), name: "서연", active: true }
        ]
      }
    ]
  };
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadState() {
  const sharedState = readStateFromHash();
  if (sharedState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedState));
    return sharedState;
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
    return normalizeState(saved);
  } catch {
    return createDefaultState();
  }
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((item) => item && item.name && item.createdAt)
      .map((item) => ({
        id: item.id || createId(),
        memberId: item.memberId || "",
        groupId: item.groupId || "",
        name: String(item.name),
        groupName: String(item.groupName || "그룹"),
        createdAt: item.createdAt
      }));
  } catch {
    return [];
  }
}

function normalizeState(input) {
  if (!input || !Array.isArray(input.groups)) return createDefaultState();

  const groups = input.groups.map((group) => ({
    id: group.id || createId(),
    name: String(group.name || "그룹").slice(0, 16),
    active: group.active !== false,
    members: Array.isArray(group.members)
      ? group.members.map((member) => ({
          id: member.id || createId(),
          name: String(member.name || "이름").slice(0, 8),
          active: member.active !== false
        }))
      : []
  }));

  return { groups };
}

function commit(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  if (message) showToast(message);
}

function commitHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(winnerHistory.slice(0, 200)));
  renderHistory();
}

function clearAllHistory() {
  if (!confirm("당첨 기록만 삭제할까요? 팀과 이름은 유지됩니다.")) return;
  winnerHistory = [];
  lastWinner = null;
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  renderWinnerShare();
  showToast("당첨 기록을 초기화했습니다");
}

function render() {
  renderGroups();
  drawWheel(spinEntries || getActiveMembers());
  renderHistory();
  renderWinnerShare();
}

function renderGroups() {
  groupList.replaceChildren();

  state.groups.forEach((group) => {
    const fragment = groupTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".group-card");
    const groupCheckbox = fragment.querySelector(".group-active-checkbox");
    const groupCheckLabel = fragment.querySelector(".check-toggle");
    const groupName = fragment.querySelector(".group-name-input");
    const deleteGroup = fragment.querySelector(".delete-group");
    const addMemberForm = fragment.querySelector(".add-member-form");
    const memberNameInput = fragment.querySelector(".member-name-input");
    const memberList = fragment.querySelector(".member-list");

    card.classList.toggle("excluded", !group.active);
    groupCheckbox.checked = group.active;
    groupCheckLabel.classList.toggle("checked", group.active);
    groupName.value = group.name;

    groupCheckbox.addEventListener("change", () => {
      group.active = groupCheckbox.checked;
      commit();
    });

    groupName.addEventListener("change", () => {
      group.name = groupName.value.trim() || "그룹";
      commit();
    });

    deleteGroup.addEventListener("click", () => {
      state.groups = state.groups.filter((item) => item.id !== group.id);
      commit();
    });

    addMemberForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = memberNameInput.value.trim();
      if (!name) return;
      group.members.push({ id: createId(), name, active: true });
      memberNameInput.value = "";
      commit();
    });

    group.members.forEach((member) => {
      memberList.appendChild(createMemberRow(group, member));
    });

    groupList.appendChild(fragment);
  });
}

function createMemberRow(group, member) {
  const fragment = memberTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".member-row");
  const memberCheckbox = fragment.querySelector(".member-active-checkbox");
  const memberCheckLabel = fragment.querySelector(".check-toggle");
  const memberName = fragment.querySelector(".member-name-edit");
  const deleteMember = fragment.querySelector(".delete-member");

  row.classList.toggle("excluded", !member.active || !group.active);
  memberCheckbox.checked = member.active;
  memberCheckLabel.classList.toggle("checked", member.active);
  memberName.value = member.name;

  memberCheckbox.addEventListener("change", () => {
    member.active = memberCheckbox.checked;
    commit();
  });

  memberName.addEventListener("change", () => {
    member.name = memberName.value.trim() || "이름";
    commit();
  });

  deleteMember.addEventListener("click", () => {
    group.members = group.members.filter((item) => item.id !== member.id);
    commit();
  });

  return fragment;
}

function getActiveMembers() {
  return WheelProbability.getEligibleEntries(state.groups);
}

function drawWheel(entries) {
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 16;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.translate(center, center);

  if (entries.length === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#dfe6de";
    ctx.fill();
    ctx.fillStyle = "#637067";
    ctx.font = "700 34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("참가자 없음", 0, 0);
    spinButton.disabled = true;
    spinButton.textContent = "돌리기";
    resultName.textContent = "참가자를 선택하세요";
    ctx.restore();
    return;
  }

  spinButton.disabled = spinState === "stopping";
  spinButton.textContent = spinState === "spinning" ? "정지" : spinState === "stopping" ? "정지 중" : "돌리기";
  const slice = (Math.PI * 2) / entries.length;

  entries.forEach((entry, index) => {
    const start = index * slice - Math.PI / 2;
    const end = start + slice;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = COLORS[index % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.save();
    ctx.rotate(start + slice / 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = entries.length > 10 ? "800 25px sans-serif" : "800 31px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 3;
    ctx.fillText(entry.name, radius - 34, 0);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(0, 0, 82, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#17201b";
  ctx.stroke();
  ctx.restore();
}

function handleSpinButton() {
  if (spinState === "idle") {
    startSpin();
    return;
  }

  if (spinState === "spinning") {
    stopSpin();
  }
}

function startSpin() {
  const entries = getActiveMembers();
  if (entries.length === 0) return;

  spinEntries = entries;
  spinState = "spinning";
  spinVelocity = 640 + Math.random() * 220;
  lastFrameTime = performance.now();
  lastWinner = null;
  resultName.textContent = "돌아가는 중";
  renderWinnerShare();
  drawWheel(spinEntries);
  animateSpin(lastFrameTime);
}

function animateSpin(now) {
  if (spinState !== "spinning") return;

  const deltaSeconds = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  rotation += spinVelocity * deltaSeconds;
  setWheelRotation(rotation);
  spinAnimationId = requestAnimationFrame(animateSpin);
}

function stopSpin() {
  if (spinState !== "spinning" || !spinEntries || spinEntries.length === 0) return;

  cancelAnimationFrame(spinAnimationId);
  spinState = "stopping";
  resultName.textContent = "멈추는 중";
  drawWheel(spinEntries);

  const winnerIndex = WheelProbability.pickIndex(spinEntries);
  const sliceDegrees = 360 / spinEntries.length;
  const winnerCenter = winnerIndex * sliceDegrees + sliceDegrees / 2;
  const currentNormalized = WheelProbability.normalizeDegrees(rotation);
  const desiredPointerAngle = 360 - winnerCenter;
  const extraTurns = 2 + Math.floor(Math.random() * 3);
  const delta = extraTurns * 360 + WheelProbability.normalizeDegrees(desiredPointerAngle - currentNormalized);

  stopAnimation = {
    startTime: performance.now(),
    duration: 2600 + Math.random() * 800,
    from: rotation,
    to: rotation + delta,
    winnerIndex
  };

  requestAnimationFrame(animateStop);
}

function animateStop(now) {
  if (spinState !== "stopping" || !stopAnimation) return;

  const progress = Math.min(1, (now - stopAnimation.startTime) / stopAnimation.duration);
  const eased = easeOutCubic(progress);
  rotation = stopAnimation.from + (stopAnimation.to - stopAnimation.from) * eased;
  setWheelRotation(rotation);

  if (progress < 1) {
    requestAnimationFrame(animateStop);
    return;
  }

  const winner = spinEntries[stopAnimation.winnerIndex];
  finishSpin(winner);
}

function finishSpin(winner) {
  rotation = WheelProbability.normalizeDegrees(rotation);
  setWheelRotation(rotation);
  spinState = "idle";
  stopAnimation = null;
  spinEntries = null;
  resultName.textContent = `${winner.name} (${winner.groupName})`;
  lastWinner = recordWinner(winner);
  drawWheel(getActiveMembers());
  commitHistory();
  renderWinnerShare();
}

function stopImmediate() {
  cancelAnimationFrame(spinAnimationId);
  spinState = "idle";
  stopAnimation = null;
  spinEntries = null;
  spinButton.disabled = false;
  spinButton.textContent = "돌리기";
}

function setWheelRotation(degrees) {
  canvas.style.setProperty("--wheel-rotation", `${degrees}deg`);
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function recordWinner(winner) {
  const record = {
    id: createId(),
    memberId: winner.memberId || "",
    groupId: winner.groupId || "",
    name: winner.name,
    groupName: winner.groupName,
    createdAt: new Date().toISOString()
  };
  winnerHistory.unshift(record);
  winnerHistory = winnerHistory.slice(0, 200);
  return record;
}

function renderHistory() {
  const stats = buildStats(winnerHistory, getActiveMembers());
  statsList.replaceChildren();
  historyList.replaceChildren();

  if (stats.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "아직 당첨 기록이 없습니다";
    statsList.appendChild(empty);
  } else {
    stats.slice(0, 8).forEach((item) => {
      const row = document.createElement("div");
      row.className = "stat-row";
      const expectedLabel = item.expectedPercent === null ? "현재 제외" : `기대 ${formatPercent(item.expectedPercent)}`;
      row.innerHTML = `
        <div>
          <div class="stat-topline">
            <span class="stat-name">${escapeHtml(item.name)} <span class="stat-count">(${escapeHtml(item.groupName)})</span></span>
            <span class="stat-percent">${formatPercent(item.totalPercent)}</span>
          </div>
          <div class="stat-meter" aria-label="전체 당첨 비율 ${formatPercent(item.totalPercent)}">
            <span style="width: ${clampPercent(item.totalPercent)}%"></span>
          </div>
          <div class="stat-detail">주 ${item.weekCount}회 ${formatPercent(item.weekPercent)} · 월 ${item.monthCount}회 ${formatPercent(item.monthPercent)} · 총 ${item.totalCount}회</div>
        </div>
      `;
      const actions = document.createElement("div");
      actions.className = "stat-actions";
      const expected = document.createElement("span");
      expected.className = "stat-expected";
      expected.textContent = expectedLabel;
      const deleteButton = document.createElement("button");
      deleteButton.className = "stat-delete";
      deleteButton.type = "button";
      deleteButton.textContent = "개인 삭제";
      deleteButton.addEventListener("click", () => deletePersonHistory(item));
      actions.append(expected, deleteButton);
      row.appendChild(actions);
      statsList.appendChild(row);
    });
  }

  winnerHistory.slice(0, 10).forEach((item) => {
    const row = document.createElement("li");
    row.innerHTML = `
      <div>
        <div class="history-name">${escapeHtml(item.name)} (${escapeHtml(item.groupName)})</div>
        <div class="history-time">${formatDateTime(item.createdAt)}</div>
      </div>
    `;
    const deleteButton = document.createElement("button");
    deleteButton.className = "history-delete";
    deleteButton.type = "button";
    deleteButton.title = "이 기록 삭제";
    deleteButton.setAttribute("aria-label", "이 기록 삭제");
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", () => deleteHistoryItem(item.id));
    row.appendChild(deleteButton);
    historyList.appendChild(row);
  });
}

function buildStats(records, activeEntries) {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const map = new Map();
  const activeOdds = new Map();
  const odds = WheelProbability.getEqualOdds(activeEntries);
  const weekTotal = records.filter((record) => new Date(record.createdAt) >= weekStart).length;
  const monthTotal = records.filter((record) => new Date(record.createdAt) >= monthStart).length;
  const total = records.length;

  odds.forEach((entry) => {
    activeOdds.set(`${entry.memberId}|${entry.groupName}`, entry.percent);
    activeOdds.set(`${entry.name}|${entry.groupName}`, entry.percent);
  });

  records.forEach((record) => {
    const key = getRecordKey(record);
    const createdAt = new Date(record.createdAt);
    if (!map.has(key)) {
      map.set(key, {
        key,
        memberId: record.memberId || "",
        groupId: record.groupId || "",
        name: record.name,
        groupName: record.groupName,
        weekCount: 0,
        monthCount: 0,
        totalCount: 0,
        latestAt: createdAt
      });
    }

    const item = map.get(key);
    item.totalCount += 1;
    if (createdAt >= weekStart) item.weekCount += 1;
    if (createdAt >= monthStart) item.monthCount += 1;
    if (createdAt > item.latestAt) item.latestAt = createdAt;
  });

  return [...map.values()].map((item) => ({
    ...item,
    weekPercent: weekTotal > 0 ? (item.weekCount / weekTotal) * 100 : 0,
    monthPercent: monthTotal > 0 ? (item.monthCount / monthTotal) * 100 : 0,
    totalPercent: total > 0 ? (item.totalCount / total) * 100 : 0,
    expectedPercent: activeOdds.has(`${item.memberId || item.name}|${item.groupName}`)
      ? activeOdds.get(`${item.memberId || item.name}|${item.groupName}`)
      : null
  })).sort((a, b) => {
    if (b.monthCount !== a.monthCount) return b.monthCount - a.monthCount;
    if (b.weekCount !== a.weekCount) return b.weekCount - a.weekCount;
    if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
    return b.latestAt - a.latestAt;
  });
}

function deletePersonHistory(item) {
  if (!confirm(`${item.name}님의 당첨 기록을 모두 삭제할까요?`)) return;
  winnerHistory = winnerHistory.filter((record) => getRecordKey(record) !== item.key);
  if (lastWinner && getRecordKey(lastWinner) === item.key) {
    lastWinner = null;
  }
  commitHistory();
  renderWinnerShare();
  showToast("개인 기록을 삭제했습니다");
}

function deleteHistoryItem(id) {
  if (!confirm("이 당첨 기록을 삭제할까요?")) return;
  const deleted = winnerHistory.find((record) => record.id === id);
  winnerHistory = winnerHistory.filter((record) => record.id !== id);
  if (deleted && lastWinner && lastWinner.id === deleted.id) {
    lastWinner = null;
  }
  commitHistory();
  renderWinnerShare();
  showToast("기록을 삭제했습니다");
}

function getRecordKey(record) {
  return `${record.memberId || record.name}|${record.groupName}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  if (value === 0 || value >= 10) return `${Math.round(value)}%`;
  return `${value.toFixed(1)}%`;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getWeekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderWinnerShare() {
  shareWinnerButton.hidden = !lastWinner;
}

async function shareWinnerMessage() {
  if (!lastWinner) return;

  const text = `${lastWinner.name}님 고맙습니다. ${formatDateTime(lastWinner.createdAt)} 복불복 돌림판 당첨 기록입니다.`;
  const shareData = {
    title: "복불복 돌림판 당첨",
    text,
    url: location.href.split("#")[0]
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${shareData.url}`);
    showToast("메시지를 복사했습니다");
  } catch {
    showToast("공유가 지원되지 않는 웹뷰입니다");
  }
}

async function shareCurrentState() {
  const compactState = {
    groups: state.groups.map((group) => ({
      n: group.name,
      a: group.active,
      m: group.members.map((member) => [member.name, member.active])
    }))
  };
  const encoded = encodeState(compactState);
  const url = `${location.href.split("#")[0]}#${encoded}`;
  window.history.replaceState(null, "", `#${encoded}`);

  try {
    await navigator.clipboard.writeText(url);
    showToast("공유 링크를 복사했습니다");
  } catch {
    showToast("주소창의 공유 링크를 복사하세요");
  }
}

function readStateFromHash() {
  const hash = location.hash.slice(1);
  if (!hash) return null;

  try {
    const compact = decodeState(hash);
    if (!compact || !Array.isArray(compact.groups)) return null;
    return {
      groups: compact.groups.map((group) => ({
        id: createId(),
        name: String(group.n || "그룹").slice(0, 16),
        active: group.a !== false,
        members: Array.isArray(group.m)
          ? group.m.map((member) => ({
              id: createId(),
              name: String(member[0] || "이름").slice(0, 8),
              active: member[1] !== false
            }))
          : []
      }))
    };
  } catch {
    showToast("공유 링크를 읽지 못했습니다");
    return null;
  }
}

function encodeState(value) {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function decodeState(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}
