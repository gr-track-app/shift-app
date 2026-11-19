const DAYS = ["月", "火", "水", "木", "金"];
const POSITIONS_BY_SHIFT = {
  "1": ["A", "B", "C", "D"],
  "2": ["A", "B", "C"]
};

// ランダムシャッフル（公平抽選用）
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 1週間分のスケジュールを1パターン生成
function generateCandidateSchedule(shiftData, positions) {
  const schedule = {};
  const tempCount = { ...(shiftData.count || {}) };
  const tempPosCount = {};

  shiftData.members.forEach(m => {
    if (tempCount[m] === undefined) tempCount[m] = 0;
    tempPosCount[m] = { ...(shiftData.posCount?.[m] || {}) };
    positions.forEach(p => {
      if (tempPosCount[m][p] === undefined) tempPosCount[m][p] = 0;
    });
  });

  let prevDayAssigned = new Set();

  for (const day of DAYS) {
    schedule[day] = {};
    const assignedToday = new Set();

    // 候補者が少ないポジションから優先して埋める（詰まり防止）
    const sortedPositions = [...positions].sort((a, b) => {
      const countA = shiftData.members.filter(m =>
        !shiftData.holidays?.[m]?.[day] && shiftData.skills?.[m]?.[a]
      ).length;
      const countB = shiftData.members.filter(m =>
        !shiftData.holidays?.[m]?.[day] && shiftData.skills?.[m]?.[b]
      ).length;
      return countA - countB;
    });

    for (const pos of sortedPositions) {
      // その日に年休でなく、まだ今日配置されておらず、このポジションのスキルを持つ人
      const candidates = shiftData.members.filter(m => {
        const isHoliday = Boolean(shiftData.holidays?.[m]?.[day]);
        const hasSkill = Boolean(shiftData.skills?.[m]?.[pos]);
        return !isHoliday && !assignedToday.has(m) && hasSkill;
      });

      if (candidates.length === 0) {
        schedule[day][pos] = "";
        continue;
      }

      // 同点時の偏りをなくすため先にシャッフル
      const shuffled = shuffleArray(candidates);

      // スコアが低い（優先度が高い）順にソート
      shuffled.sort((a, b) => {
        const scoreA =
          (tempCount[a] || 0) * 100 +
          (tempPosCount[a]?.[pos] || 0) * 35 +
          (prevDayAssigned.has(a) ? 25 : 0);

        const scoreB =
          (tempCount[b] || 0) * 100 +
          (tempPosCount[b]?.[pos] || 0) * 35 +
          (prevDayAssigned.has(b) ? 25 : 0);

        return scoreA - scoreB;
      });

      const chosen = shuffled[0];
      schedule[day][pos] = chosen;
      assignedToday.add(chosen);
      tempCount[chosen] = (tempCount[chosen] || 0) + 1;
      tempPosCount[chosen][pos] = (tempPosCount[chosen][pos] || 0) + 1;
    }

    prevDayAssigned = assignedToday;
  }

  return schedule;
}

// スケジュール全体の公平性を採点（低いほど良い）
function evaluateSchedule(schedule, shiftData, positions) {
  let penalty = 0;
  const weekCount = {};
  shiftData.members.forEach(m => (weekCount[m] = 0));

  for (let i = 0; i < DAYS.length; i++) {
    const day = DAYS[i];
    const prevDay = i > 0 ? DAYS[i - 1] : null;

    for (const pos of positions) {
      const person = schedule[day][pos];
      if (!person) {
        penalty += 5000; // 空き枠ペナルティ
        continue;
      }
      weekCount[person] = (weekCount[person] || 0) + 1;

      if (prevDay) {
        // 前日と同じポジションの連続
        if (schedule[prevDay][pos] === person) {
          penalty += 40;
        }
        // 前日も早出だった場合（連続勤務）
        const wasYesterday = positions.some(p => schedule[prevDay][p] === person);
        if (wasYesterday) {
          penalty += 15;
        }
      }
    }
  }

  // 1週間内の担当回数のバラつきペナルティ
  const counts = Object.values(weekCount);
  if (counts.length > 0) {
    const maxC = Math.max(...counts);
    const minC = Math.min(...counts);
    penalty += (maxC - minC) * 80;
  }

  return penalty;
}

// 50パターン試行して最も公平な早出表を作成
function generateBestSchedule(shiftData, shiftKey) {
  const positions = POSITIONS_BY_SHIFT[shiftKey];
  let bestSchedule = null;
  let bestScore = Infinity;

  for (let i = 0; i < 50; i++) {
    const candidate = generateCandidateSchedule(shiftData, positions);
    const score = evaluateSchedule(candidate, shiftData, positions);
    if (score < bestScore) {
      bestScore = score;
      bestSchedule = candidate;
    }
  }

  return bestSchedule;
}

// 未習得スキルがあるメンバーか判定（🟠表示用）
function hasUnlearnedSkill(member, shiftData, shiftKey) {
  if (!member) return false;
  const positions = POSITIONS_BY_SHIFT[shiftKey];
  return positions.some(pos => !shiftData.skills?.[member]?.[pos]);
}

// ホワイトボード描画（左：A・B / 右：C・D）
function renderScheduleBoard(schedule, shiftData, shiftKey, educationMap = {}) {
  const scheduleArea = document.getElementById("scheduleArea");
  if (!schedule || Object.keys(schedule).length === 0) {
    scheduleArea.innerHTML = `<div class="empty-board">「📝 早出表作成」を押してください</div>`;
    return;
  }

  const positions = POSITIONS_BY_SHIFT[shiftKey];
  const leftPositions = positions.filter(p => p === "A" || p === "B");
  const rightPositions = positions.filter(p => p === "C" || p === "D");

  let html = "";

  for (const day of DAYS) {
    html += `<div class="day-block">`;
    html += `<div class="day-label">${day}曜日</div>`;
    html += `<div class="pos-grid">`;

    // 左列（A・B）
    html += `<div class="pos-col">`;
    for (const pos of leftPositions) {
      html += buildPositionCellHTML(day, pos, schedule[day]?.[pos] || "", shiftData, shiftKey, educationMap);
    }
    html += `</div>`;

    // 右列（C・D）
    html += `<div class="pos-col">`;
    for (const pos of rightPositions) {
      html += buildPositionCellHTML(day, pos, schedule[day]?.[pos] || "", shiftData, shiftKey, educationMap);
    }
    html += `</div>`;

    html += `</div></div>`;
  }

  scheduleArea.innerHTML = html;
}

// 各枠（ポジション）のセルHTML生成（プルダウン変更＆教育担当表示）
function buildPositionCellHTML(day, pos, assignedPerson, shiftData, shiftKey, educationMap) {
  const showOrange = hasUnlearnedSkill(assignedPerson, shiftData, shiftKey);
  const trainer = assignedPerson ? educationMap[assignedPerson] : "";

  let optionsHtml = `<option value="">-- 未定 --</option>`;
  shiftData.members.forEach(m => {
    const selected = m === assignedPerson ? "selected" : "";
    optionsHtml += `<option value="${m}" ${selected}>${m}</option>`;
  });

  return `
    <div class="pos-cell">
      <span class="pos-tag">${pos}</span>
      <div class="cell-content">
        <div class="person-select-row">
          ${showOrange ? `<span>🟠</span>` : ""}
          <select class="board-select" data-day="${day}" data-pos="${pos}">
            ${optionsHtml}
          </select>
        </div>
        ${trainer ? `<div class="trainer-badge">👨‍🏫 教育: ${trainer}</div>` : ""}
      </div>
    </div>
  `;
}
