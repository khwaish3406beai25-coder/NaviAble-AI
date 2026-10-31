const stageStarts = new Map();

function monotonicNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function writeEvent(event, details = {}, atMs = monotonicNow()) {
  if (__DEV__) {
    console.info('[VoicePerf]', event, {
      timestamp: new Date().toISOString(),
      atMs: Math.round(atMs),
      ...details,
    });
  }
  return atMs;
}

export function markVoiceEvent(event, details = {}) {
  return writeEvent(event, details);
}

export function startVoiceStage(stage, details = {}) {
  const atMs = monotonicNow();
  stageStarts.set(stage, atMs);
  writeEvent(`${stage} started`, details, atMs);
  return atMs;
}

export function finishVoiceStage(stage, details = {}) {
  const atMs = monotonicNow();
  const startedAt = stageStarts.get(stage);
  stageStarts.delete(stage);
  const durationMs = startedAt === undefined ? undefined : Math.round(atMs - startedAt);
  writeEvent(`${stage} completed`, { ...details, ...(durationMs === undefined ? {} : { durationMs }) }, atMs);
  return durationMs;
}
