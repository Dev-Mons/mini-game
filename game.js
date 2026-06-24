const STORAGE_KEY = "team-wheel-state-v1";
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
const selectAllButton = document.querySelector("#selectAllButton");
const clearAllButton = document.querySelector("#clearAllButton");
const resetButton = document.querySelector("#resetButton");
const toast = document.querySelector("#toast");

let state = loadState();
let rotation = 0;
let spinning = false;
let toastTimer = 0;

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

spinButton.addEventListener("click", spinWheel);
shareButton.addEventListener("click", shareCurrentState);

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
  if (!confirm("저장된 그룹과 이름을 모두 초기화할까요?")) return;
  state = createDefaultState();
  rotation = 0;
  location.hash = "";
  commit();
});

window.addEventListener("hashchange", () => {
  const sharedState = readStateFromHash();
  if (!sharedState) return;
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

function render() {
  renderGroups();
  drawWheel(getActiveMembers());
}

function renderGroups() {
  groupList.replaceChildren();

  state.groups.forEach((group) => {
    const fragment = groupTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".group-card");
    const groupToggle = fragment.querySelector(".group-toggle");
    const groupName = fragment.querySelector(".group-name-input");
    const deleteGroup = fragment.querySelector(".delete-group");
    const addMemberForm = fragment.querySelector(".add-member-form");
    const memberNameInput = fragment.querySelector(".member-name-input");
    const memberList = fragment.querySelector(".member-list");

    card.classList.toggle("excluded", !group.active);
    groupToggle.className = `group-toggle ${group.active ? "on" : "off"}`;
    groupToggle.textContent = group.active ? "참가" : "제외";
    groupName.value = group.name;

    groupToggle.addEventListener("click", () => {
      group.active = !group.active;
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
  const memberToggle = fragment.querySelector(".member-toggle");
  const memberName = fragment.querySelector(".member-name-edit");
  const deleteMember = fragment.querySelector(".delete-member");

  row.classList.toggle("excluded", !member.active || !group.active);
  memberToggle.className = `member-toggle ${member.active ? "on" : "off"}`;
  memberToggle.textContent = member.active ? "참가" : "제외";
  memberName.value = member.name;

  memberToggle.addEventListener("click", () => {
    member.active = !member.active;
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
  return state.groups.flatMap((group) =>
    group.active
      ? group.members
          .filter((member) => member.active && member.name.trim())
          .map((member) => ({ id: member.id, name: member.name.trim(), group: group.name }))
      : []
  );
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
    resultName.textContent = "참가자를 선택하세요";
    ctx.restore();
    return;
  }

  spinButton.disabled = spinning;
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
    ctx.font = "800 31px sans-serif";
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

function spinWheel() {
  const entries = getActiveMembers();
  if (spinning || entries.length === 0) return;

  spinning = true;
  spinButton.disabled = true;
  resultName.textContent = "돌아가는 중";

  const winnerIndex = Math.floor(Math.random() * entries.length);
  const sliceDegrees = 360 / entries.length;
  const winnerCenter = winnerIndex * sliceDegrees + sliceDegrees / 2;
  const currentNormalized = normalizeDegrees(rotation);
  const desiredPointerAngle = 360 - winnerCenter;
  const extraTurns = 5 + Math.floor(Math.random() * 3);
  const delta = extraTurns * 360 + normalizeDegrees(desiredPointerAngle - currentNormalized);
  const start = performance.now();
  const duration = 4300;
  const from = rotation;
  const to = rotation + delta;

  requestAnimationFrame(function animate(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = easeOutCubic(progress);
    rotation = from + (to - from) * eased;
    canvas.style.setProperty("--wheel-rotation", `${rotation}deg`);

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    rotation = to;
    canvas.style.setProperty("--wheel-rotation", `${rotation}deg`);
    resultName.textContent = `${entries[winnerIndex].name} (${entries[winnerIndex].group})`;
    spinning = false;
    drawWheel(getActiveMembers());
  });
}

function normalizeDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
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
  history.replaceState(null, "", `#${encoded}`);

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

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}
