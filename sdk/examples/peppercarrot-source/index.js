/*!
MIT License

Copyright (c) 2026 mekuri contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// SPDX-License-Identifier: MIT
// 官方公開 API；不修改或重新散布漫畫圖片，包含原始署名頁。
const BASE = 'https://www.peppercarrot.com';
const INDEX = `${BASE}/0_sources/episodes-v1.json`;
const LANGUAGES = { cn: '中文（簡體）', en: 'English', fr: 'Français', ja: '日本語' };
const CACHE_KEY = 'peppercarrot-index-v1';
const CACHE_MS = 60 * 60 * 1000;
const EPISODE = /^ep(\d+)_([A-Za-z0-9-]+)$/;
const PAGE_FILE = /^Pepper-and-Carrot_by-David-Revoy_E\d+(?:P\d+)?\.(?:jpg|gif|png)$/;

function fail(message) {
  throw new Error(`Pepper&Carrot：${message}`);
}

function validateIndex(data) {
  if (!Array.isArray(data) || data.length === 0) fail('官方章節索引格式不符，請更新插件');
  const names = new Set();
  for (const ep of data) {
    if (!ep || typeof ep.name !== 'string' || !EPISODE.test(ep.name) || names.has(ep.name) ||
        !Array.isArray(ep.translated_languages) || !ep.translated_languages.every((x) => typeof x === 'string') ||
        !ep.pages || typeof ep.pages !== 'object' || Array.isArray(ep.pages)) fail('官方章節索引格式不符，請更新插件');
    names.add(ep.name);
    const files = Object.values(ep.pages);
    if (!ep.pages.cover || !ep.pages.title || !ep.pages.credits || files.length > 1000 ||
        !files.every((f) => typeof f === 'string' && PAGE_FILE.test(f)) ||
        !Object.keys(ep.pages).some((k) => /^\d+$/.test(k))) fail('官方頁面索引格式不符，請更新插件');
  }
  return data;
}

async function episodes() {
  const now = Date.now();
  const cached = await mekuri.storage.get(CACHE_KEY);
  if (cached && Number.isFinite(cached.at) && cached.at <= now && now - cached.at < CACHE_MS) {
    try { return validateIndex(cached.data); } catch { /* 舊快取無效時重新取得 */ }
  }
  const response = await mekuri.http.request({ url: INDEX, responseType: 'json' });
  if (response.status !== 200) fail(`無法取得章節索引（HTTP ${response.status}），請稍後重試`);
  const data = validateIndex(response.body);
  await mekuri.storage.set(CACHE_KEY, { at: now, data });
  return data;
}

function languageOf(workKey) {
  const match = typeof workKey === 'string' && /^peppercarrot:(cn|en|fr|ja)$/.exec(workKey);
  if (!match) fail('不支援的作品代碼');
  return match[1];
}

function imageUrl(ep, language, filename, resolution = 'low-res') {
  return `${BASE}/0_sources/${ep.name}/${resolution}/${language}_${filename}`;
}

function work(ep, language) {
  return {
    workKey: `peppercarrot:${language}`,
    title: `Pepper&Carrot · ${LANGUAGES[language]}`,
    author: 'David Revoy 與翻譯、協作團隊',
    description: '小魔女 Pepper 與貓咪 Carrot 的奇幻冒險。原作、翻譯與繪圖依 CC BY 4.0 授權。© David Revoy 與協作者；每話保留原始署名頁。來源與完整署名：https://www.peppercarrot.com/en/about/index.html 。圖片未經修改。本插件為非官方工具。',
    coverUrl: imageUrl(ep, language, ep.pages.cover),
    url: `${BASE}/${language}/webcomics/index.html`,
    readingDirection: 'ltr',
  };
}

async function available(language) {
  return (await episodes()).filter((ep) => ep.translated_languages.includes(language))
    .sort((a, b) => Number(EPISODE.exec(a.name)[1]) - Number(EPISODE.exec(b.name)[1]));
}

export async function search(query, page) {
  if (!Number.isInteger(page) || page < 1) fail('搜尋頁碼必須從 1 開始');
  if (page > 1) return { items: [], hasMore: false };
  const q = String(query ?? '').toLowerCase().replace(/[\s&＆·-]/g, '');
  if (q && !['peppercarrot', '小辣椒', '胡蘿蔔', '胡萝卜'].some((alias) => alias.includes(q))) return { items: [], hasMore: false };
  const setting = mekuri.settings.get('language');
  const language = Object.hasOwn(LANGUAGES, setting) ? setting : 'cn';
  const list = await available(language);
  if (!list.length) return { items: [], hasMore: false };
  const w = work(list[0], language);
  return { items: [{ workKey: w.workKey, title: w.title, coverUrl: w.coverUrl, subtitle: 'David Revoy · CC BY 4.0' }], hasMore: false };
}

export async function getWork(workKey) {
  const language = languageOf(workKey);
  const list = await available(language);
  if (!list.length) fail('目前沒有此語言的完整章節');
  return work(list[0], language);
}

export async function getChapters(workKey) {
  const language = languageOf(workKey);
  return (await available(language)).map((ep) => {
    const [, number, title] = EPISODE.exec(ep.name);
    return { chapterKey: `${workKey}/${ep.name}`, title: `${Number(number)} · ${title.replace(/-/g, ' ')}`, number: Number(number) };
  });
}

export async function getPages(chapterKey) {
  const match = typeof chapterKey === 'string' && /^(peppercarrot:(?:cn|en|fr|ja))\/(ep\d+_[A-Za-z0-9-]+)$/.exec(chapterKey);
  if (!match) fail('不支援的章節代碼');
  const language = languageOf(match[1]);
  const ep = (await episodes()).find((item) => item.name === match[2]);
  if (!ep || !ep.translated_languages.includes(language)) fail('找不到此語言的章節');
  const resolution = mekuri.settings.get('resolution') === 'hi-res' ? 'hi-res' : 'low-res';
  const story = Object.keys(ep.pages).filter((key) => /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b));
  return ['title', ...story, 'credits'].map((key) => ({ url: imageUrl(ep, language, ep.pages[key], resolution) }));
}
