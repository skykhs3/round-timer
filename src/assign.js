function range(n) {
  return Array.from({ length: n }, (_, i) => i);
}

export function shuffle(items, rng = Math.random) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function isValidAssignment(perm, previousRounds = [], { excludeOwn = true } = {}) {
  const n = perm.length;
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const p = perm[i];
    if (!Number.isInteger(p) || p < 0 || p >= n || seen.has(p)) return false;
    seen.add(p);
    if (excludeOwn && p === i) return false;
    for (const prev of previousRounds) {
      if (prev[i] === p) return false;
    }
  }
  return true;
}

export function minParticipants({ excludeOwn = true, rounds = 2 } = {}) {
  return excludeOwn ? rounds + 1 : rounds;
}

function forbiddenSets(n, previousRounds, excludeOwn) {
  return range(n).map((i) => {
    const set = new Set();
    if (excludeOwn) set.add(i);
    for (const prev of previousRounds) set.add(prev[i]);
    return set;
  });
}

function backtrack(n, forbidden, rng) {
  const result = new Array(n).fill(-1);
  const used = new Array(n).fill(false);
  const visit = (i) => {
    if (i === n) return true;
    for (const c of shuffle(range(n), rng)) {
      if (used[c] || forbidden[i].has(c)) continue;
      used[c] = true;
      result[i] = c;
      if (visit(i + 1)) return true;
      used[c] = false;
      result[i] = -1;
    }
    return false;
  };
  return visit(0) ? result : null;
}

// 참가자 i에게 제시문 perm[i]를 준다. 조건을 만족하는 배정이 없으면 null.
export function assignRound(n, previousRounds = [], options = {}) {
  const { excludeOwn = true, rng = Math.random, maxTries = 1000 } = options;
  if (n <= 0) return [];
  const base = range(n);
  for (let t = 0; t < maxTries; t++) {
    const perm = shuffle(base, rng);
    if (isValidAssignment(perm, previousRounds, { excludeOwn })) return perm;
  }
  return backtrack(n, forbiddenSets(n, previousRounds, excludeOwn), rng);
}

// order[k] = 제시문 k를 받은 참가자. 제시문 번호 순으로 발표한다.
export function speakingOrder(assignment) {
  const order = new Array(assignment.length);
  assignment.forEach((paper, person) => {
    order[paper] = person;
  });
  return order;
}
