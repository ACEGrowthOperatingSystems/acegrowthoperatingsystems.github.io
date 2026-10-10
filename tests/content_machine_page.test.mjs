import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('content-machine/index.html', 'utf8');

test('5.09 offer page is held, noindex and keyed to SA-CONTENT-CREATION', () => {
  assert.match(html, /data-release-state="APPROVAL_HELD"/);
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(html, /data-buy="SA-CONTENT-CREATION"/);
  assert.match(html, /data-price-for="SA-CONTENT-CREATION"/);
  assert.match(html, /The problem it solves/);
});

test('5.09 offer page carries legal links and no banned offers or brands', () => {
  assert.match(html, /href="..\/terms\/"/);
  assert.match(html, /href="..\/refund\/"/);
  assert.doesNotMatch(html, /Content Starter|\$99|WithYou/i);
  assert.doesNotMatch(html, /guarantee/i);
});
