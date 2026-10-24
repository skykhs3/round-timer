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
