import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function el(tag){return {tag,children:[],dataset:{},hidden:true,appendChild(c){this.children.push(c);return c;},set textContent(v){this._t=v;},get textContent(){return this._t??this.children.map(c=>c.textContent??'').join('');}};}
function run(productKey, extra={}){
  const nodes={billingDisclosure:el('div')};
  const document={body:{dataset:{productKey}},getElementById:id=>nodes[id]||null,createElement:el,createTextNode:t=>({textContent:t})};
  const window={...extra};
  vm.runInNewContext(fs.readFileSync('assets/checkout-disclosure.js','utf8'),{window,document});
  return {box:nodes.billingDisclosure,D:window.ACE_DISCLOSURE};
}
const words=s=>s.trim().split(/\s+/).length;

test('disclosure states every 12 Oct billing fact and stays within length limits', () => {
  const {D}=run('ACE-MKT');
  const all=D.bullets.join(' ');
  for (const re of [/charged today/, /first delivery/, /3-month minimum/, /\$20, \$50 or \$100/, /alert at 80% of your credit/, /10% of your monthly credit/, /questionnaire/, /No refunds after onboarding starts/])
    assert.match(all, re);
  assert.ok(words(all) <= 90, `disclosure is ${words(all)} words`);
  assert.ok(words(D.ackLabel) <= 35 && D.ackLabel.startsWith('I understand'));
  assert.ok(words(D.leadGenerator) <= 30);
  assert.ok(words(D.autoTopUpLabel) <= 20 && /runs out/.test(D.autoTopUpLabel));
  assert.doesNotMatch(all + D.ackLabel, /!|guarantee/i);
});

test('required tick box is rendered; auto top-up only once wired; LG line only on Lead Generator', () => {
  const a=run('ACE-MKT');
  const ids=a.box.children.flatMap(c=>c.children||[]).map(c=>c.id).filter(Boolean);
  assert.deepEqual(ids,['billingAck']);
  assert.equal(a.box.hidden,false);
  assert.ok(!a.box.textContent.includes('warm up'));
  const b=run('ACE-LEADGEN',{ACE_CHECKOUT:{autoTopUpWired:true}});
  assert.deepEqual(b.box.children.flatMap(c=>c.children||[]).map(c=>c.id).filter(Boolean),['billingAck','autoTopUp']);
  assert.ok(b.box.textContent.includes('warm up'));
});

test('buy button never navigates without the acknowledgement', () => {
  const src=fs.readFileSync('assets/checkout.js','utf8');
  assert.match(src, /getElementById\("billingAck"\)/);
  assert.ok(src.indexOf('ack&&!ack.checked') < src.indexOf('window.location.assign'));
  const html=fs.readFileSync('checkout/ace-mkt/index.html','utf8');
  assert.match(html, /id="billingDisclosure"/);
  assert.ok(html.indexOf('checkout-disclosure.js') < html.indexOf('assets/checkout.js'));
  assert.doesNotMatch(html, /usage pauses at 100%/);
});
