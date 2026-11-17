import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPackage, inspectPackage, MAX_PACKAGE_BYTES } from '../sdk/lib/package.mjs';
import { exampleManifest, exampleCode } from './helpers.mjs';

test('打包時拒絕壓縮前超過 50 MB 的內容，即使壓縮後很小', () => {
  assert.throws(() => createPackage({ manifest: exampleManifest(), code: ' '.repeat(MAX_PACKAGE_BYTES + 1) }), /解壓後大小.*超過上限/);
});

test('壓縮前大小包含 manifest、主程式與圖示的總和', () => {
  const manifest = { ...exampleManifest(), icon: 'icon.svg' };
  const manifestSize = Buffer.byteLength(JSON.stringify(manifest, null, 2) + '\n');
  const code = exampleCode();
  const iconSize = MAX_PACKAGE_BYTES - manifestSize - Buffer.byteLength(code);
  const icon = new Uint8Array(iconSize);
  const bytes = createPackage({ manifest, code, icon });
  assert.deepEqual(inspectPackage(bytes).errors, []);
  assert.throws(() => createPackage({ manifest, code, icon: new Uint8Array(iconSize + 1) }), /解壓後大小.*超過上限/);
});
