import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSystemAudioLabel, shouldIncludeAudio } from '../src/lib/scanFilter.ts';

test('isSystemAudioLabel matches system folders and names', () => {
  assert.equal(isSystemAudioLabel('/storage/emulated/0/Ringtones/Chime.ogg'), true);
  assert.equal(isSystemAudioLabel('/storage/emulated/0/Notifications/Ping.ogg'), true);
  assert.equal(isSystemAudioLabel('/storage/emulated/0/Alarms/Wake.mp3'), true);
  assert.equal(isSystemAudioLabel('/storage/emulated/0/UI/Click.ogg'), true);
  assert.equal(isSystemAudioLabel('Ringtones'), true);
  assert.equal(isSystemAudioLabel('notification_sound.ogg'), true);
  assert.equal(isSystemAudioLabel('alarm.mp3'), true);
  assert.equal(isSystemAudioLabel('ringtone.mp3'), true);
});

test('isSystemAudioLabel ignores ordinary music names', () => {
  assert.equal(isSystemAudioLabel('/storage/emulated/0/Music/Album/Track.mp3'), false);
  assert.equal(isSystemAudioLabel('Building.mp3'), false);
  assert.equal(isSystemAudioLabel('Human.mp3'), false);
  assert.equal(isSystemAudioLabel('Music'), false);
});

test('shouldIncludeAudio rejects short and system tracks', () => {
  assert.equal(shouldIncludeAudio({ durationMs: 500, uri: '/storage/emulated/0/Music/a.mp3' }), false);
  assert.equal(shouldIncludeAudio({ durationMs: 30_000, uri: '/storage/emulated/0/Ringtones/a.ogg' }), false);
  assert.equal(shouldIncludeAudio({ durationMs: 30_000, filename: 'notification.ogg' }), false);
  assert.equal(shouldIncludeAudio({ durationMs: 30_000, albums: ['Alarms'] }), false);
});

test('shouldIncludeAudio keeps normal tracks and unknown durations', () => {
  assert.equal(shouldIncludeAudio({ durationMs: 30_000, uri: '/storage/emulated/0/Music/a.mp3' }), true);
  assert.equal(shouldIncludeAudio({ durationMs: 0, uri: '/storage/emulated/0/Music/a.mp3' }), true);
  assert.equal(shouldIncludeAudio({ durationMs: 0 }), true);
});
