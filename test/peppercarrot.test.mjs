import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadPlugin, readJson, packProject } from '../sdk/lib/project.mjs';
import { runCases, fakeTransport } from '../sdk/lib/runner.mjs';
import { createSandbox } from '../sdk/lib/sandbox.mjs';
import { verifyPackage } from '../sdk/lib/verify.mjs';

const DIR = fileURLToPath(new URL('../sdk/examples/peppercarrot-source/', import.meta.url));
const CASES = readJson(`${DIR}/cases.json`);
const INDEX = 'https://www.peppercarrot.com/0_sources/episodes-v1.json';
const { manifest, code } = loadPlugin(DIR);

test('Pepper&Carrot：上架插件包與原始碼一致', async () => {
  const packed = await packProject(DIR);
  const hubDir = new URL(`../plugins/${manifest.id}/`, import.meta.url);
  assert.deepEqual(readJson(new URL('manifest.json', hubDir)), manifest);
  assert.deepEqual(readFileSync(new URL(`${manifest.version}.mekuri-plugin`, hubDir)), Buffer.from(packed.bytes));
});

for (const platform of ['windows', 'android']) {
  test(`Pepper&Carrot ${platform}：原始碼與打包後的所有案例`, async () => {
    const packed = await packProject(DIR);
    const check = await verifyPackage(packed.bytes);
    assert.deepEqual(check.errors, []);
    assert.deepEqual(check.warnings, []);
    for (const pluginCode of [code, check.code]) {
      const r = await runCases({ manifest, code: pluginCode, cases: CASES, platform });
      assert.equal(r.failed, 0, JSON.stringify(r.results.filter((x) => !x.ok), null, 2));
      assert.equal(r.passed, CASES.cases.length);
      const cached = r.results.find((x) => x.name.startsWith('快取'));
      assert.deepEqual(cached.requests, [`GET ${INDEX}`]);
      for (const name of ['不相關搜尋沒有結果', '第二頁沒有重複結果', '拒絕章節路徑注入']) {
        assert.deepEqual(r.results.find((x) => x.name === name).requests, []);
      }
    }
  });
}

test('Pepper&Carrot：語言設定、hi-res、失效快取及 API 錯誤', async () => {
  const requests = [];
  const sb = await createSandbox({ manifest, code, settings: { language: 'en', resolution: 'hi-res' },
    storage: { 'peppercarrot-index-v1': { at: 0, data: [] } },
    transport: fakeTransport(CASES.responses, (req) => requests.push(req.url)) });
  try {
    assert.equal((await sb.call('search', ['', 1])).items[0].workKey, 'peppercarrot:en');
    const pages = await sb.call('getPages', ['peppercarrot:cn/ep01_The-Start']);
    assert.ok(pages.every((p) => p.url.includes('/hi-res/cn_')));
    assert.equal(requests.length, 1);
  } finally {
    sb.dispose();
  }
  for (const response of [
    { status: 503, body: '' },
    { status: 200, body: '{bad json' },
    { status: 200, body: '{}' },
    { status: 200, body: '[{"name":"../../evil"}]' },
  ]) {
    const r = await runCases({ manifest, code, cases: {
      responses: { [INDEX]: response },
      cases: [{ call: 'getChapters', args: ['peppercarrot:cn'], expectError: 'PLUGIN_ERROR' }],
    } });
    assert.equal(r.failed, 0, JSON.stringify(r.results));
  }
});

test('Pepper&Carrot：新鮮快取不連線，過期或損壞的快取重新取得', async () => {
  const data = JSON.parse(CASES.responses[INDEX].body);
  for (const [cached, expectedRequests] of [
    [{ at: Date.now(), data }, 0],
    [{ at: 0, data }, 1],
    [{ at: Date.now(), data: [] }, 1],
  ]) {
    let count = 0;
    const sb = await createSandbox({ manifest, code,
      storage: { 'peppercarrot-index-v1': cached },
      transport: fakeTransport(CASES.responses, () => count++) });
    try {
      assert.equal((await sb.call('getChapters', ['peppercarrot:cn'])).length, 3);
      assert.equal(count, expectedRequests);
    } finally {
      sb.dispose();
    }
  }
});

test('Pepper&Carrot：拒絕官方資料中的不安全檔名', async () => {
  const data = JSON.parse(CASES.responses[INDEX].body);
  data[0].pages.cover = '../../evil.jpg';
  const r = await runCases({ manifest, code, cases: {
    responses: { [INDEX]: { status: 200, body: JSON.stringify(data) } },
    cases: [{ call: 'getWork', args: ['peppercarrot:cn'], expectError: 'PLUGIN_ERROR' }],
  } });
  assert.equal(r.failed, 0);
});
