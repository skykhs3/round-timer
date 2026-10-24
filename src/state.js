const STORAGE_KEY = 'round-timer:v1';

export const ROUNDS = 2;
export const DEFAULT_PARTICIPANTS = 4;

export const DEFAULT_SETTINGS = Object.freeze({
  readMin: 20,
  perPersonMin: 2,
  excludeOwn: true,
});

let seq = 0;

export function newParticipant(name = '', title = '') {
  seq += 1;
  return { id: `p${Date.now().toString(36)}${seq.toString(36)}`, name, title };
}

export function emptySession() {
  return {
    round: 1,
    phase: 'setup',
    assignments: [],
    orders: [],
    timer: null,
    speakerIdx: 0,
    speakerTimer: null,
  };
}

export function initialState() {
  return {
    participants: Array.from({ length: DEFAULT_PARTICIPANTS }, () => newParticipant()),
    settings: { ...DEFAULT_SETTINGS },
    session: emptySession(),
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw);
    const base = initialState();
    const participants = Array.isArray(parsed.participants) && parsed.participants.length
      ? parsed.participants.map((p) => ({ ...newParticipant(), ...p }))
      : base.participants;
    const session = { ...emptySession(), ...(parsed.session || {}) };
    if (!Array.isArray(session.orders)) session.orders = [];
    const needsOrder = session.phase === 'ordered' || session.phase === 'speaking';
    if (needsOrder && !Array.isArray(session.orders[session.round - 1])) Object.assign(session, emptySession());
    return {
      participants,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      session,
    };
  } catch {
    return initialState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 메모리 상태만 유지한다.
  }
}

export function effectiveTimes(state) {
  return {
    readMin: state.settings.readMin,
    perPersonMin: state.settings.perPersonMin,
  };
}
