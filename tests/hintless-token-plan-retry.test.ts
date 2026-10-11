import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyMainModelFailure, mainModelFailureDelayMs, probeRetryDelayMs, sameModelRetriesRemain } from '../extensions/main-model-recovery.js';

const raw = '429 {"type":"error","error":{"type":"rate_limit_error","message":"Token Plan rate limit reached: Upgrade your Token Plan or switch to pay-as-you-go API usage. (2062)"},"request_id":"opaque"}';

test('field Token Plan 2062 error retries eagerly without inventing a quota reset', () => {
  const failure = classifyMainModelFailure(raw);
  for (let attempt = 1; attempt <= 10; attempt++) {
    assert.equal(mainModelFailureDelayMs(failure, attempt), 5000);
    assert.equal(probeRetryDelayMs(raw, attempt), 5000, 'saved diagnostics use the same policy after restore');
  }
  assert.equal(mainModelFailureDelayMs(failure, 11), 60000, 'eager window is bounded');
  assert.equal(sameModelRetriesRemain(10, 10), false, 'spent configured same-model budget admits fallback selection');
  assert.equal(mainModelFailureDelayMs(classifyMainModelFailure(raw + '; retry after 3 hours'), 2), 3 * 60 * 60_000, 'real reset hints remain authoritative');
});
