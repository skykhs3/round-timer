import { assignRound, speakingOrder, minParticipants } from './assign.js';
import * as State from './state.js';
import * as Timer from './timer.js';
import * as Alarm from './alarm.js';

const SCREENS = ['setup', 'assigned', 'reading', 'speaking', 'roundDone', 'finished'];
const PLUS_MS = 60 * 1000;
const RESET_ARM_MS = 3000;

let state = State.load();
let resetArmedUntil = 0;
const notified = new Set();

const el = (id) => document.getElementById(id);

function save() {
  State.save(state);
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function fmtMin(min) {
  return `${Number.isInteger(min) ? min : Number(min.toFixed(2))}분`;
}

function personName(idx) {
  const name = state.participants[idx]?.name?.trim();
  return name || `참가자 ${idx + 1}`;
}

function paperLabel(idx) {
  const title = state.participants[idx]?.title?.trim();
  return `${idx + 1}. ${title || '제목 없음'}`;
}

function currentAssignment() {
  return state.session.assignments[state.session.round - 1] || null;
}

function currentSpeakerIdx() {
  return Math.min(state.session.speakerIdx, state.participants.length - 1);
}

function isRunningPhase() {
  return state.session.phase === 'reading' || state.session.phase === 'speaking';
}

function setupProblem() {
  const n = state.participants.length;
  const need = minParticipants({ excludeOwn: state.settings.excludeOwn, rounds: State.ROUNDS });
  if (n < need) return `참가자가 ${need}명 이상이어야 라운드 ${State.ROUNDS}개를 모두 배정할 수 있습니다.`;
  const empty = state.participants.findIndex((p) => !p.name.trim());
  if (empty >= 0) return `${empty + 1}번 참가자 이름을 입력하세요.`;
  const { readMin, perPersonMin } = State.effectiveTimes(state);
  if (!(readMin > 0 && perPersonMin > 0)) return '시간은 0보다 커야 합니다.';
  return '';
}

/* ---------- 설정 화면 ---------- */

function renderParticipantRows() {
  const tbody = el('participantRows');
  const ids = state.participants.map((p) => p.id).join('|');
  if (tbody.dataset.ids === ids) return;
  tbody.dataset.ids = ids;
  tbody.innerHTML = '';
  const last = state.participants.length - 1;
  state.participants.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.dataset.id = p.id;
    tr.innerHTML = `
      <td class="num">${i + 1}</td>
      <td><input type="text" data-field="name" placeholder="이름" autocomplete="off"></td>
      <td><input type="text" data-field="title" placeholder="제시문 제목 (선택)" autocomplete="off"></td>
      <td class="row-actions">
        <button type="button" class="icon" data-action="up" title="위로" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon" data-action="down" title="아래로" ${i === last ? 'disabled' : ''}>↓</button>
        <button type="button" class="icon danger" data-action="remove" title="삭제">✕</button>
      </td>`;
    tr.querySelector('[data-field="name"]').value = p.name;
    tr.querySelector('[data-field="title"]').value = p.title;
    tbody.appendChild(tr);
  });
}

function syncSettingsInputs() {
  const t = State.effectiveTimes(state);
  el('excludeOwn').checked = state.settings.excludeOwn;
  el('readMin').value = t.readMin;
  el('perPersonMin').value = t.perPersonMin;
}

function updateSetupDerived() {
  const problem = setupProblem();
  const t = State.effectiveTimes(state);
  el('setupHint').textContent = problem
    || `${state.participants.length}명 · 읽기 ${fmtMin(t.readMin)} · 발표자 1인당 ${fmtMin(t.perPersonMin)}`;
  el('assignBtn').disabled = Boolean(problem);
}

function renderSetup() {
  renderParticipantRows();
  syncSettingsInputs();
  updateSetupDerived();
}

function bindSetup() {
  const rows = el('participantRows');

  rows.addEventListener('input', (e) => {
    const field = e.target.dataset.field;
    if (!field) return;
    const id = e.target.closest('tr')?.dataset.id;
    const p = state.participants.find((x) => x.id === id);
    if (!p) return;
    p[field] = e.target.value;
    save();
    updateSetupDerived();
  });

  rows.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    const list = state.participants;
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return;
    const action = btn.dataset.action;
    if (action === 'remove') list.splice(i, 1);
    if (action === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    if (action === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
    save();
    render();
  });

  el('addParticipant').addEventListener('click', () => {
    state.participants.push(State.newParticipant());
    save();
    render();
    rows.querySelector('tr:last-child [data-field="name"]')?.focus();
  });

  el('excludeOwn').addEventListener('change', (e) => {
    state.settings.excludeOwn = e.target.checked;
    save();
    updateSetupDerived();
  });

  for (const key of ['readMin', 'perPersonMin']) {
    el(key).addEventListener('input', (e) => {
      const v = Number(e.target.value);
      if (Number.isFinite(v) && v > 0) state.settings[key] = v;
      save();
      updateSetupDerived();
    });
    el(key).addEventListener('change', () => syncSettingsInputs());
  }

  el('assignBtn').addEventListener('click', () => {
    if (setupProblem()) return;
    assignCurrentRound();
  });
}

/* ---------- 배정 ---------- */

function assignCurrentRound() {
  const round = state.session.round;
  const previous = state.session.assignments.slice(0, round - 1);
  const perm = assignRound(state.participants.length, previous, { excludeOwn: state.settings.excludeOwn });
  if (!perm) {
    el('setupHint').textContent = '조건을 만족하는 배정을 찾지 못했습니다. 인원과 규칙을 확인하세요.';
    return;
  }
  state.session.assignments = [...previous, perm];
  state.session.phase = 'assigned';
  save();
  render();
}

function assignmentRows(assignment, { current = -1, markDone = false } = {}) {
  return speakingOrder(assignment).map((person, k) => {
    const own = person === k;
    const cls = k === current ? 'current' : (markDone && k < current ? 'done' : '');
    return `<tr class="${cls}" data-k="${k}">
      <td class="num">${k + 1}</td>
      <td class="strong">${esc(personName(person))}</td>
      <td>${esc(paperLabel(k))}${own ? '<span class="tag">본인</span>' : ''}</td>
      <td class="muted">${esc(personName(k))}</td>
    </tr>`;
  }).join('');
}

function renderAssigned() {
  const { round } = state.session;
  el('assignedTitle').textContent = `라운드 ${round} 배정`;
  el('assignedRows').innerHTML = assignmentRows(currentAssignment());
  el('backToSetup').hidden = round !== 1;
  el('readLenLabel').textContent = fmtMin(State.effectiveTimes(state).readMin);
}

function renderReading() {
  el('readingRows').innerHTML = assignmentRows(currentAssignment());
}

function renderSpeaking() {
  const assignment = currentAssignment();
  const order = speakingOrder(assignment);
  const idx = currentSpeakerIdx();
  el('speakingLabel').textContent = `발표 · ${idx + 1}번째`;
  el('speakerName').textContent = personName(order[idx]);
  el('speakerPaper').textContent = `${paperLabel(idx)} · 작성자 ${personName(idx)}`;
  el('speakingRows').innerHTML = assignmentRows(assignment, { current: idx, markDone: true });
  el('speakerNext').disabled = idx >= order.length - 1;
}

function renderRoundDone() {
  const { round } = state.session;
  el('roundDoneTitle').textContent = `라운드 ${round} 종료`;
  el('assignNext').textContent = `라운드 ${round + 1} 배정`;
}

function renderFinished() {
  const { assignments } = state.session;
  el('summaryRows').innerHTML = state.participants.map((_, i) => {
    const cells = assignments.map((a) => (a
      ? `<td>${esc(paperLabel(a[i]))}<span class="muted"> · ${a[i] + 1}번째 발표</span></td>`
      : '<td>-</td>')).join('');
    return `<tr><td class="strong">${esc(personName(i))}</td>${cells}</tr>`;
  }).join('');
}

/* ---------- 단계 전환 ---------- */

function startReading() {
  Alarm.unlockAudio();
  Alarm.acquireWakeLock();
  const { readMin } = State.effectiveTimes(state);
  state.session.timer = Timer.startTimer(Timer.minutesToMs(readMin));
  state.session.phase = 'reading';
  save();
  render();
  tick();
}

function enterSpeaking() {
  Alarm.stopAlarm();
  Alarm.unlockAudio();
  Alarm.acquireWakeLock();
  state.session.timer = null;
  state.session.speakerIdx = 0;
  state.session.speakerTimer = null;
  state.session.phase = 'speaking';
  save();
  render();
  tick();
}

function endRound() {
  Alarm.stopAlarm();
  state.session.timer = null;
  state.session.speakerTimer = null;
  if (state.session.round < State.ROUNDS) {
    state.session.phase = 'roundDone';
  } else {
    state.session.phase = 'finished';
    Alarm.releaseWakeLock();
  }
  save();
  render();
}

function resetSession() {
  Alarm.stopAlarm();
  Alarm.releaseWakeLock();
  state.session = State.emptySession();
  notified.clear();
  save();
  render();
}

function toggleReadingPause() {
  const t = state.session.timer;
  state.session.timer = Timer.isPaused(t) ? Timer.resumeTimer(t) : Timer.pauseTimer(t);
  save();
  tick();
}

function addReadingMinute() {
  Alarm.stopAlarm();
  state.session.timer = Timer.addTime(state.session.timer, PLUS_MS);
  save();
  tick();
}

function startSpeakerTimer() {
  Alarm.unlockAudio();
  const { perPersonMin } = State.effectiveTimes(state);
  state.session.speakerTimer = Timer.startTimer(Timer.minutesToMs(perPersonMin));
  save();
  tick();
}

function toggleSpeakerPause() {
  const t = state.session.speakerTimer;
  state.session.speakerTimer = Timer.isPaused(t) ? Timer.resumeTimer(t) : Timer.pauseTimer(t);
  save();
  tick();
}

function addSpeakerMinute() {
  Alarm.stopAlarm();
  state.session.speakerTimer = Timer.addTime(state.session.speakerTimer, PLUS_MS);
  save();
  tick();
}

function selectSpeaker(k) {
  Alarm.stopAlarm();
  state.session.speakerIdx = k;
  state.session.speakerTimer = null;
  save();
  render();
  tick();
}

function nextSpeaker() {
  const idx = currentSpeakerIdx();
  if (idx >= state.participants.length - 1) return;
  selectSpeaker(idx + 1);
}

function bindFlow() {
  el('backToSetup').addEventListener('click', () => {
    state.session = State.emptySession();
    save();
    render();
  });
  el('reshuffle').addEventListener('click', assignCurrentRound);
  el('startReading').addEventListener('click', startReading);

  el('readingPause').addEventListener('click', toggleReadingPause);
  el('readingPlus').addEventListener('click', addReadingMinute);
  el('readingStopAlarm').addEventListener('click', () => { Alarm.stopAlarm(); tick(); });
  el('toSpeaking').addEventListener('click', enterSpeaking);

  el('speakerStart').addEventListener('click', startSpeakerTimer);
  el('speakerPause').addEventListener('click', toggleSpeakerPause);
  el('speakerPlus').addEventListener('click', addSpeakerMinute);
  el('speakingStopAlarm').addEventListener('click', () => { Alarm.stopAlarm(); tick(); });
  el('speakerNext').addEventListener('click', nextSpeaker);
  el('endRound').addEventListener('click', endRound);
  el('speakingRows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-k]');
    if (tr) selectSpeaker(Number(tr.dataset.k));
  });

  el('assignNext').addEventListener('click', () => {
    state.session.round += 1;
    assignCurrentRound();
  });
  el('restart').addEventListener('click', resetSession);

  el('resetBtn').addEventListener('click', () => {
    const now = Date.now();
    if (now < resetArmedUntil) {
      resetArmedUntil = 0;
      el('resetBtn').textContent = '처음부터';
      resetSession();
      return;
    }
    resetArmedUntil = now + RESET_ARM_MS;
    el('resetBtn').textContent = '다시 누르면 초기화';
    setTimeout(() => {
      if (Date.now() >= resetArmedUntil) el('resetBtn').textContent = '처음부터';
    }, RESET_ARM_MS + 100);
  });

  document.addEventListener('pointerdown', Alarm.unlockAudio);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isRunningPhase()) Alarm.acquireWakeLock();
    tick();
  });
}

/* ---------- 렌더링과 틱 ---------- */

function render() {
  const { phase, round } = state.session;
  for (const s of SCREENS) el(`screen-${s}`).hidden = s !== phase;
  el('roundBadge').hidden = phase === 'setup';
  el('roundBadge').textContent = `라운드 ${round} / ${State.ROUNDS}`;
  el('resetBtn').hidden = phase === 'setup';
  if (phase === 'setup') renderSetup();
  if (phase === 'assigned') renderAssigned();
  if (phase === 'reading') renderReading();
  if (phase === 'speaking') renderSpeaking();
  if (phase === 'roundDone') renderRoundDone();
  if (phase === 'finished') renderFinished();
  updateTitle();
}

function updateTitle() {
  const { phase, timer, speakerTimer } = state.session;
  if (phase === 'reading' && timer) {
    document.title = `${Timer.formatMs(Timer.remainingMs(timer))} 읽기 · 라운드 타이머`;
    return;
  }
  if (phase === 'speaking' && speakerTimer) {
    document.title = `${Timer.formatMs(Timer.remainingMs(speakerTimer))} 발표 ${currentSpeakerIdx() + 1}번째 · 라운드 타이머`;
    return;
  }
  document.title = '라운드 타이머';
}

function tickReading() {
  const { round, timer } = state.session;
  const finished = Timer.isFinished(timer);
  const clock = el('readingClock');
  clock.textContent = Timer.formatMs(Timer.remainingMs(timer));
  clock.classList.toggle('finished', finished);
  clock.classList.toggle('paused', Timer.isPaused(timer));

  const key = `reading:${round}:${timer?.endAt}`;
  if (finished && !notified.has(key)) {
    notified.add(key);
    Alarm.startAlarm();
  }

  const pauseBtn = el('readingPause');
  pauseBtn.textContent = Timer.isPaused(timer) ? '재개' : '일시정지';
  pauseBtn.disabled = finished;
  el('readingStopAlarm').hidden = !Alarm.isAlarming();
}

function tickSpeaking() {
  const { round, speakerTimer } = state.session;
  const idx = currentSpeakerIdx();
  const clock = el('speakingClock');

  if (!speakerTimer) {
    const { perPersonMin } = State.effectiveTimes(state);
    clock.textContent = Timer.formatMs(Timer.minutesToMs(perPersonMin));
    clock.classList.remove('finished', 'paused');
    el('speakerStart').hidden = false;
    el('speakerPause').hidden = true;
    el('speakerPlus').hidden = true;
  } else {
    const done = Timer.isFinished(speakerTimer);
    clock.textContent = Timer.formatMs(Timer.remainingMs(speakerTimer));
    clock.classList.toggle('finished', done);
    clock.classList.toggle('paused', Timer.isPaused(speakerTimer));

    const key = `speaker:${round}:${idx}:${speakerTimer.endAt}`;
    if (done && !notified.has(key)) {
      notified.add(key);
      Alarm.startAlarm();
    }

    el('speakerStart').hidden = true;
    el('speakerPause').hidden = done;
    el('speakerPause').textContent = Timer.isPaused(speakerTimer) ? '재개' : '일시정지';
    el('speakerPlus').hidden = false;
  }
  el('speakingStopAlarm').hidden = !Alarm.isAlarming();
}

function tick() {
  const { phase } = state.session;
  if (phase === 'reading') tickReading();
  if (phase === 'speaking') tickSpeaking();
  if (isRunningPhase()) updateTitle();
}

function init() {
  bindSetup();
  bindFlow();
  render();
  tick();
  setInterval(tick, 250);
  if (isRunningPhase()) Alarm.acquireWakeLock();
}

init();
