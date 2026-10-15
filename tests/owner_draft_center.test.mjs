// Owner Draft Center (Jim 15 Oct: one streamlined approval channel). No network I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('owner/index.html');
const js = read('assets/owner.js');
const cfg = read('assets/owner-config.js');
const sql = read('supabase/owner_draft_center_v1.sql');
const fn = read('supabase/functions/owner-push/index.ts');

test('owner page is noindex and not linked from public pages', () => {
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  for (const p of ['index.html', 'catalog/index.html', 'my-ace/index.html']) {
    assert.doesNotMatch(read(p), /href="\/owner\//, `${p} links to /owner/`);
  }
});

test('every element the controller reads exists', () => {
  const ids = [...new Set([...js.matchAll(/\$\("#([a-z0-9-]+)"\)/g)].map(m => m[1]))];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(all).size, all.length, 'duplicate id');
});

test('only owner RPCs are called from the page', () => {
  const calls = [...new Set([...js.matchAll(/rpc\("([a-z_]+)"/g)].map(m => m[1]))].sort();
  assert.deepEqual(calls, ['owner_decide_draft', 'owner_list_drafts', 'owner_save_push_subscription']);
});

test('no secrets in browser files', () => {
  for (const src of [js, cfg, html]) assert.doesNotMatch(src, /sb_secret_|service_role|private_key|sk_live_|sk_test_/);
});

test('decisions are bound to a signed-in owner in the database', () => {
  assert.match(sql, /create trigger owner_drafts_guard before update on ace_v2\.owner_drafts/);
  assert.match(sql, /auth\.uid\(\) is null or not exists/);
  assert.match(sql, /grant execute on function public\.owner_is_owner\(\), public\.owner_list_drafts\(text\),\s*public\.owner_decide_draft\(bigint,text,text\), public\.owner_save_push_subscription\(jsonb,text\) to authenticated/);
  assert.doesNotMatch(sql, /to anon/);
  assert.match(sql, /to service_role;\s*$/);
});

test('change request needs a comment (page and server)', () => {
  assert.match(js, /CHANGE_REQUESTED"&&!comment/);
  assert.match(sql, /comment_required/);
});

test('push private key is generated server-side, never configured by hand', () => {
  assert.match(fn, /generateVAPIDKeys\(\)/);
  assert.doesNotMatch(fn, /Deno\.env\.get\("VAPID/);
});
