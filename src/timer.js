export function startTimer(durationMs, now = Date.now()) {
  return { endAt: now + durationMs, pausedRemainingMs: null };
}

export function isPaused(timer) {
  return Boolean(timer) && timer.pausedRemainingMs != null;
}

export function remainingMs(timer, now = Date.now()) {
  if (!timer) return 0;
  if (isPaused(timer)) return Math.max(0, timer.pausedRemainingMs);
  return Math.max(0, timer.endAt - now);
}

export function isFinished(timer, now = Date.now()) {
  return Boolean(timer) && remainingMs(timer, now) <= 0;
}

export function pauseTimer(timer, now = Date.now()) {
  if (!timer || isPaused(timer)) return timer;
  return { endAt: null, pausedRemainingMs: remainingMs(timer, now) };
}

export function resumeTimer(timer, now = Date.now()) {
  if (!timer || !isPaused(timer)) return timer;
  return { endAt: now + timer.pausedRemainingMs, pausedRemainingMs: null };
}

export function addTime(timer, deltaMs, now = Date.now()) {
  if (!timer) return timer;
  if (isPaused(timer)) {
    return { ...timer, pausedRemainingMs: Math.max(0, timer.pausedRemainingMs + deltaMs) };
  }
  return { ...timer, endAt: Math.max(timer.endAt, now) + deltaMs };
}

export function setRemaining(timer, ms, now = Date.now()) {
  const remaining = Math.max(0, ms);
  if (timer && isPaused(timer)) return { endAt: null, pausedRemainingMs: remaining };
  return { endAt: now + remaining, pausedRemainingMs: null };
}

// "3" / "1.5" 는 분, "3:30" 은 분:초. 해석할 수 없으면 null.
export function parseDuration(text) {
  const t = String(text).trim().replace(/\s+/g, '');
  if (!t) return null;
  const clock = t.match(/^(\d+):(\d{1,2})$/);
  if (clock) {
    const m = Number(clock[1]);
    const s = Number(clock[2]);
    if (s >= 60) return null;
    return (m * 60 + s) * 1000;
  }
  if (!/^\d*\.?\d+$/.test(t)) return null;
  const minutes = Number(t);
  return minutes > 0 ? Math.round(minutes * 60 * 1000) : null;
}

export function minutesToMs(minutes) {
  return Math.round(Number(minutes) * 60 * 1000);
}

export function formatMs(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
