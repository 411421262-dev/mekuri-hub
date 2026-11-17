#!/usr/bin/env node
// 選擇性連線檢查；一般 npm test 與 CI 不連線到第三方網站。
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPlugin } from '../sdk/lib/project.mjs';
import { createSandbox } from '../sdk/lib/sandbox.mjs';

const plugin = loadPlugin(fileURLToPath(new URL('../sdk/examples/peppercarrot-source/', import.meta.url)));
let requests = 0;
const sb = await createSandbox({ ...plugin, transport: async (req) => {
  requests++;
  const response = await fetch(req.url, { method: req.method, headers: req.headers,
    body: req.body, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
} });

try {
  const result = await sb.call('search', ['', 1]);
  assert.equal(result.items.length, 1);
  const work = await sb.call('getWork', [result.items[0].workKey]);
  const chapters = await sb.call('getChapters', [work.workKey]);
  assert.ok(chapters.length > 0);
  const urls = new Set([work.coverUrl]);
  let totalPages = 0;
  let checkedGif = false;
  let checkedLong = false;
  for (const [i, chapter] of chapters.entries()) {
    const pages = await sb.call('getPages', [chapter.chapterKey]);
    assert.ok(pages.length >= 3);
    totalPages += pages.length;
    if (i === 0 || (!checkedLong && pages.length > 11)) {
      urls.add(pages[0].url);
      urls.add(pages[1].url);
      urls.add(pages.at(-1).url);
      // 也抽查高解析版本；仍只發 HEAD，不下載圖片。
      urls.add(pages[1].url.replace('/low-res/', '/hi-res/'));
      if (pages.length > 11) checkedLong = true;
    }
    const gif = pages.find((p) => p.url.endsWith('.gif'));
    if (gif && !checkedGif) {
      urls.add(gif.url);
      checkedGif = true;
    }
  }
  for (const url of urls) {
    const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200, `${response.status}: ${url}`);
    assert.match(response.headers.get('content-type') ?? '', /^image\//, url);
    console.log(`HEAD 200 ${url}`);
  }
  assert.equal(requests, 1, '索引應只下載一次，其餘呼叫使用快取');
  console.log(`通過：${chapters.length} 話，${totalPages} 頁（含標題及署名頁），${urls.size} 個圖片 URL 抽查，${requests} 次索引請求。`);
} finally {
  sb.dispose();
}
