import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignRound, drawOrder, isValidAssignment, minParticipants } from '../src/assign.js';

function isPermutation(perm, n) {
  return perm.length === n
    && new Set(perm).size === n
    && perm.every((p) => Number.isInteger(p) && p >= 0 && p < n);
}

function twoRounds(n, excludeOwn) {
  const r1 = assignRound(n, [], { excludeOwn });
  assert.ok(r1, `round 1 failed (n=${n})`);
  const r2 = assignRound(n, [r1], { excludeOwn });
  assert.ok(r2, `round 2 failed (n=${n})`);
  return [r1, r2];
}

test('본인 제외 켬: n=3,4,5,8에서 두 라운드 모두 조건을 만족한다', () => {
  for (const n of [3, 4, 5, 8]) {
    for (let i = 0; i < 2000; i++) {
      const [r1, r2] = twoRounds(n, true);
      assert.ok(isPermutation(r1, n) && isPermutation(r2, n));
      for (let p = 0; p < n; p++) {
        assert.notEqual(r1[p], p);
        assert.notEqual(r2[p], p);
        assert.notEqual(r1[p], r2[p]);
      }
      assert.ok(isValidAssignment(r2, [r1], { excludeOwn: true }));
    }
  }
});

test('본인 제외 끔: n=2에서도 두 라운드가 가능하고 라운드 간 중복이 없다', () => {
  for (let i = 0; i < 500; i++) {
    const [r1, r2] = twoRounds(2, false);
    assert.ok(isPermutation(r1, 2) && isPermutation(r2, 2));
    for (let p = 0; p < 2; p++) assert.notEqual(r1[p], r2[p]);
  }
});

test('본인 제외 끔: 본인 제시문이 실제로 배정되는 경우가 나온다', () => {
  let own = 0;
  for (let i = 0; i < 500; i++) {
    const r = assignRound(4, [], { excludeOwn: false });
    if (r.some((p, idx) => p === idx)) own += 1;
  }
  assert.ok(own > 0);
});

test('본인 제외 켬 n=2: 라운드 1은 가능하지만 라운드 2는 null', () => {
  const r1 = assignRound(2, [], { excludeOwn: true });
  assert.deepEqual(r1, [1, 0]);
  assert.equal(assignRound(2, [r1], { excludeOwn: true }), null);
});

test('rng를 주입하면 결과가 결정적이다', () => {
  const seq = [0.1, 0.7, 0.3, 0.9, 0.5, 0.2, 0.8, 0.4];
  const mk = () => {
    let i = 0;
    return () => seq[i++ % seq.length];
  };
  assert.deepEqual(assignRound(5, [], { rng: mk() }), assignRound(5, [], { rng: mk() }));
});

test('최소 인원: 본인 제외 켬 3명, 끔 2명', () => {
  assert.equal(minParticipants({ excludeOwn: true }), 3);
  assert.equal(minParticipants({ excludeOwn: false }), 2);
});

test('drawOrder는 참가자 전원의 순열이고 매번 섞인다', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const order = drawOrder(5);
    assert.ok(isPermutation(order, 5));
    seen.add(order.join(','));
  }
  assert.ok(seen.size > 1);
});

test('폴백: 순환 이동으로 풀리지 않는 이전 라운드도 backtracking으로 처리한다', () => {
  const prev = [1, 3, 0, 2];
  for (let i = 0; i < 200; i++) {
    const r2 = assignRound(4, [prev], { excludeOwn: true, maxTries: 0 });
    assert.ok(r2 && isValidAssignment(r2, [prev], { excludeOwn: true }));
  }
});
