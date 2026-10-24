let audioCtx = null;
let alarmInterval = null;
let wakeLock = null;

export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  } catch {
    audioCtx = null;
  }
}

function beep(freq, startOffset, duration, volume = 0.25) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const t0 = audioCtx.currentTime + startOffset;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.setValueAtTime(volume, t0 + duration - 0.03);
  gain.gain.linearRampToValueAtTime(0, t0 + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration);
}

export function playCue() {
  unlockAudio();
  beep(660, 0, 0.15);
  beep(660, 0.2, 0.15);
}

function alarmPattern() {
  beep(880, 0, 0.12);
  beep(880, 0.18, 0.12);
  beep(880, 0.36, 0.12);
  beep(1175, 0.6, 0.25);
}

export function startAlarm() {
  if (alarmInterval) return;
  unlockAudio();
  document.body.classList.add('alarm');
  alarmPattern();
  alarmInterval = setInterval(alarmPattern, 1500);
}

export function stopAlarm() {
  if (alarmInterval) clearInterval(alarmInterval);
  alarmInterval = null;
  document.body.classList.remove('alarm');
}

export function isAlarming() {
  return alarmInterval != null;
}

export async function acquireWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
}

export function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
