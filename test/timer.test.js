import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, setRemaining, remainingMs, pauseTimer, startTimer, isPaused } from '../src/timer.js';

test('parseDuration: 분, 소수 분, 분:초를 해석한다', () => {
  assert.equal(parseDuration('3'), 180000);
  assert.equal(parseDuration('1.5'), 90000);
  assert.equal(parseDuration('.5'), 30000);
  assert.equal(parseDuration('3:30'), 210000);
  assert.equal(parseDuration(' 0:45 '), 45000);
  assert.equal(parseDuration('12:05'), 725000);
});

test('parseDuration: 잘못된 입력은 null', () => {
  for (const bad of ['', 'abc', '0', '-1', '3:60', '3:5:1', '1,5']) {
    assert.equal(parseDuration(bad), null, bad);
  }
});

test('setRemaining: 실행 중이면 종료 시각을, 일시정지면 남은 시간을 바꾼다', () => {
  const now = 1_000_000;
  const running = setRemaining(startTimer(60000, now), 30000, now);
  assert.equal(remainingMs(running, now), 30000);
  assert.ok(!isPaused(running));

  const paused = setRemaining(pauseTimer(startTimer(60000, now), now), 15000, now);
  assert.ok(isPaused(paused));
  assert.equal(remainingMs(paused, now + 99999), 15000);

  assert.equal(remainingMs(setRemaining(null, 5000, now), now), 5000);
});
