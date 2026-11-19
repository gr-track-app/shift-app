const STORAGE_KEY = "gr_track_manager_data_v1";

let currentShift = "1";
let appData = {
  shifts: {
    "1": createEmptyShiftData(),
    "2": createEmptyShiftData()
  }
};

function createEmptyShiftData() {
  return {
    members: [],
    skills: {},
    holidays: {},
    count: {},
    posCount: {},
    schedule: null,
    education: {}
  };
}

function loadAppData() {
  try {
    const possibleKeys = [STORAGE_KEY, "shiftData", "grTrackManager", "hayadeData"];
    let raw = null;
    for (const k of possibleKeys) {
      const item = localStorage.getItem(k);
      if (item) {
        raw = JSON.parse(item);
        break;
      }
    }
    if (raw) {
      const sourceShifts = raw.shifts ? raw.shifts : raw;
      ["1", "2"].forEach(s => {
        if (sourceShifts[s]) {
          appData.shifts[s] = { ...createEmptyShiftData(), ...sourceShifts[s] };
        }
      });
    }
  } catch (e) {
    console.error("データ読み込みエラー:", e);
  }
  normalizeCurrentShiftData();
}

function normalizeCurrentShiftData() {
  const sData = appData.shifts[currentShift];
  const positions = POSITIONS_BY_SHIFT[currentShift];

  if (!Array.isArray(sData.members)) sData.members = [];
  if (!sData.skills) sData.skills = {};
  if (!sData.holidays) sData.holidays = {};
  if (!sData.count) sData.count = {};
  if (!sData.posCount) sData.posCount = {};
  if (!sData.education) sData.education = {};

  sData.members.forEach(m => {
    if (!sData.skills[m]) sData.skills[m] = {};
    if (!sData.holidays[m]) sData.holidays[m] = {};
    if (sData.count[m] === undefined) sData.count[m] = 0;
    if (!sData.posCount[m]) sData.posCount[m] = {};
    positions.forEach(p => {
      if (sData.posCount[m][p] === undefined) sData.posCount[m][p] = 0;
    });
  });
}

function saveAppData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

document.addEventListener("DOMContentLoaded", () => {
  loadAppData();
  setupEventListeners();
  refreshAllViews();
});

function setupEventListeners() {
  document.querySelectorAll(".shiftBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".shiftBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentShift = btn.dataset.shift;
      normalizeCurrentShiftData();
      closeAllPanels();
      refreshAllViews();
    });
  });

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const targetPanel = document.getElementById(targetId);
      const isAlreadyOpen = !targetPanel.classList.contains("hidden");

      closeAllPanels();

      if (!isAlreadyOpen) {
        btn.classList.add("active");
        targetPanel.classList.remove("hidden");
        if (targetId === "panel-education") {
          renderEducationPanel();
        }
      }
    });
  });

  document.querySelectorAll(".close-panel-btn").forEach(btn => {
    btn.addEventListener("click", closeAllPanels);
  });

  document.getElementById("addMemberBtn").addEventListener("click", addMember);
  document.getElementById("memberInput").addEventListener("keypress", e => {
    if (e.key === "Enter") addMember();
  });

  document.getElementById("createButton").addEventListener("click", handleCreateSchedule);

  document.getElementById("scheduleArea").addEventListener("change", e => {
    if (e.target.classList.contains("board-select")) {
      const day = e.target.dataset.day;
      const pos = e.target.dataset.pos;
      const newPerson = e.target.value;
      const sData = appData.shifts[currentShift];

      if (sData.schedule && sData.schedule[day]) {
        sData.schedule[day][pos] = newPerson;
        saveAppData();
        renderBoard();
        if (!document.getElementById("panel-education").classList.contains("hidden")) {
          renderEducationPanel();
        }
      }
    }
  });
}

function closeAllPanels() {
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
}

function refreshAllViews() {
  document.getElementById("boardTitle").textContent = `${currentShift}直 早出表`;
  renderMemberList();
  renderSkillArea();
  renderHolidayArea();
  renderBoard();
}
function addMember() {
  const input = document.getElementById("memberInput");
  const name = input.value.trim();
  if (!name) return;

  const sData = appData.shifts[currentShift];
  if (sData.members.includes(name)) {
    alert("同じ名前のメンバーが既に登録されています。");
    return;
  }

  sData.members.push(name);
  normalizeCurrentShiftData();
  saveAppData();
  input.value = "";
  refreshAllViews();
}

function deleteMember(name) {
  if (!confirm(`「${name}」を削除しますか？`)) return;
  const sData = appData.shifts[currentShift];
  sData.members = sData.members.filter(m => m !== name);
  delete sData.skills[name];
  delete sData.holidays[name];
  delete sData.count[name];
  delete sData.posCount[name];
  delete sData.education[name];
  saveAppData();
  refreshAllViews();
}

function renderMemberList() {
  const container = document.getElementById("memberList");
  const sData = appData.shifts[currentShift];

  if (sData.members.length === 0) {
    container.innerHTML = `<p class="panel-note">メンバーが登録されていません</p>`;
    return;
  }

  container.innerHTML = sData.members.map(m => `
    <div class="list-item">
      <span class="item-name">${m}</span>
      <button type="button" class="del-btn" onclick="deleteMember('${m}')">削除</button>
    </div>
  `).join("");
}

function renderSkillArea() {
  const container = document.getElementById("skillArea");
  const sData = appData.shifts[currentShift];
  const positions = POSITIONS_BY_SHIFT[currentShift];

  if (sData.members.length === 0) {
    container.innerHTML = `<p class="panel-note">先にメンバーを登録してください</p>`;
    return;
  }

  container.innerHTML = sData.members.map(m => {
    const checks = positions.map(pos => {
      const checked = sData.skills[m]?.[pos] ? "checked" : "";
      return `
        <label class="check-label">
          <input type="checkbox" ${checked} onchange="toggleSkill('${m}', '${pos}', this.checked)">
          ${pos}
        </label>
      `;
    }).join("");

    return `
      <div class="list-item">
        <span class="item-name">${m}</span>
        <div class="check-group">${checks}</div>
      </div>
    `;
  }).join("");
}

function toggleSkill(member, pos, isChecked) {
  const sData = appData.shifts[currentShift];
  if (!sData.skills[member]) sData.skills[member] = {};
  sData.skills[member][pos] = isChecked;
  saveAppData();
  renderBoard();
}

function renderHolidayArea() {
  const container = document.getElementById("holidayArea");
  const sData = appData.shifts[currentShift];

  if (sData.members.length === 0) {
    container.innerHTML = `<p class="panel-note">先にメンバーを登録してください</p>`;
    return;
  }

  container.innerHTML = sData.members.map(m => {
    const checks = DAYS.map(day => {
      const checked = sData.holidays[m]?.[day] ? "checked" : "";
      return `
        <label class="check-label">
          <input type="checkbox" ${checked} onchange="toggleHoliday('${m}', '${day}', this.checked)">
          ${day}
        </label>
      `;
    }).join("");

    return `
      <div class="list-item">
        <span class="item-name">${m}</span>
        <div class="check-group">${checks}</div>
      </div>
    `;
  }).join("");
}

function toggleHoliday(member, day, isChecked) {
  const sData = appData.shifts[currentShift];
  if (!sData.holidays[member]) sData.holidays[member] = {};
  sData.holidays[member][day] = isChecked;
  saveAppData();
}

function handleCreateSchedule() {
  const sData = appData.shifts[currentShift];
  if (sData.members.length === 0) {
    alert("メンバーを登録してから早出表を作成してください。");
    return;
  }

  const newSchedule = generateBestSchedule(sData, currentShift);
  sData.schedule = newSchedule;

  const positions = POSITIONS_BY_SHIFT[currentShift];
  for (const day of DAYS) {
    for (const pos of positions) {
      const person = newSchedule[day][pos];
      if (person) {
        sData.count[person] = (sData.count[person] || 0) + 1;
        sData.posCount[person][pos] = (sData.posCount[person][pos] || 0) + 1;
      }
    }
  }

  sData.holidays = {};
  sData.members.forEach(m => {
    sData.holidays[m] = {};
  });
  sData.education = {};

  saveAppData();
  closeAllPanels();
  renderHolidayArea();
  renderBoard();
}

function renderEducationPanel() {
  const container = document.getElementById("educationList");
  const sData = appData.shifts[currentShift];

  if (!sData.schedule) {
    container.innerHTML = `<p class="panel-note">先に「📝 早出表作成」を押してください</p>`;
    return;
  }

  const positions = POSITIONS_BY_SHIFT[currentShift];
  const traineesSet = new Set();

  for (const day of DAYS) {
    for (const pos of positions) {
      const person = sData.schedule[day]?.[pos];
      if (person && hasUnlearnedSkill(person, sData, currentShift)) {
        traineesSet.add(person);
      }
    }
  }

  const trainees = Array.from(traineesSet);

  if (trainees.length === 0) {
    container.innerHTML = `<p class="panel-note">今回の早出表に教育対象者（🟠）はいません</p>`;
    return;
  }

  container.innerHTML = trainees.map(trainee => {
    const currentTrainer = sData.education[trainee] || "";

    let options = `<option value="">-- 教育なし --</option>`;
    sData.members.forEach(m => {
      if (m !== trainee) {
        const selected = m === currentTrainer ? "selected" : "";
        options += `<option value="${m}" ${selected}>${m}</option>`;
      }
    });

    return `
      <div class="edu-card">
        <span class="item-name">🟠 ${trainee}</span>
        <select class="edu-select" onchange="setEducationTrainer('${trainee}', this.value)">
          ${options}
        </select>
      </div>
    `;
  }).join("");
}

function setEducationTrainer(trainee, trainer) {
  const sData = appData.shifts[currentShift];
  if (trainer) {
    sData.education[trainee] = trainer;
  } else {
    delete sData.education[trainee];
  }
  saveAppData();
  renderBoard();
}

function renderBoard() {
  const sData = appData.shifts[currentShift];
  renderScheduleBoard(sData.schedule, sData, currentShift, sData.education || {});
}
