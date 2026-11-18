import assert from 'node:assert/strict';
import test from 'node:test';
import { pickedImageFromAsset } from '../src/lib/artworkInput.ts';

test('keeps a provided name, mime and size', () => {
  assert.deepEqual(
    pickedImageFromAsset({
      uri: 'file:///a.heic',
      fileName: 'Cover.HEIC',
      mimeType: 'image/heic',
      fileSize: 1234,
    }),
    { uri: 'file:///a.heic', name: 'Cover.HEIC', mimeType: 'image/heic', sizeBytes: 1234 },
  );
});

test('falls back to a generated name and mime from the extension', () => {
  const picked = pickedImageFromAsset({ uri: 'content://x/photo.png' });
  assert.equal(picked.mimeType, 'image/png');
  assert.match(picked.name, /^artwork-\d+\.png$/);
  assert.equal(picked.sizeBytes, 0);
});

test('unknown extension falls back to image/jpeg and .jpg', () => {
  const picked = pickedImageFromAsset({ uri: 'content://x/blob' });
  assert.equal(picked.mimeType, 'image/jpeg');
  assert.match(picked.name, /\.jpg$/);
});
