/** Normalize Android speech transcripts before intent matching. */
export function normalizeVoiceCommand(text) {
  return (typeof text === 'string' ? text : '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Map a recognized utterance to an existing assistant action. */
export function classifyVoiceCommand(transcript) {
  // Accept both one-step requests and a wake phrase followed by the request
  // in the same utterance (for example, “Hi Navi, open camera”).
  const command = normalizeVoiceCommand(transcript)
    .replace(/^(?:(?:hey|hi)\s+)?nav(?:i|y|\s+i)\s+/, '')
    .replace(/^(?:hey|hi)\s+navy\s+/, '');
  const hasAny = (phrases) => phrases.some((phrase) => command === phrase || command.includes(phrase));
  const hasWord = (words) => words.some((word) => new RegExp(`\\b${word}\\b`).test(command));

  if (hasAny(['stop assistance', 'stop voice assistance']) || command === 'stop') return 'stop-assistance';
  if (hasAny(['stop speaking', 'silence'])) return 'stop-speaking';
  if (hasAny(['repeat response', 'repeat'])) return 'repeat';
  if (hasAny(['start listening again', 'listen again'])) return 'start-listening';
  if (hasAny([
    'read this document', 'what is written here', 'what s written here',
    'read this text', 'read the text', 'read text', 'read the sign', 'read this',
    'read aloud', 'read what this says', 'what does this say', 'read the label',
  ]) || (hasWord(['read']) && hasWord(['text', 'document', 'sign', 'label', 'writing', 'words']))) return 'read-text';
  if (hasAny([
    'identify objects around me', 'what objects are nearby', 'tell me which objects you can see',
    'detect objects', 'detect the objects', 'find objects', 'find the objects', 'what objects are around me',
    'what objects can you see', 'objects around me', 'objects nearby', 'objects near me',
  ]) || (hasWord(['object', 'objects']) && hasWord(['detect', 'find', 'identify', 'locate', 'nearby', 'around', 'surrounding']))) return 'yolo';
  if (hasAny(['open camera'])) return 'open-camera';
  if (hasAny([
    'take a picture', 'take picture', 'capture an image', 'capture image', 'capture a picture',
    'detect my surroundings', 'describe my surroundings', 'tell me what is around me',
    'what is in front of me', 'what do you see', 'tell me what you see',
    'what s in front of me', 'describe my surroundings', 'describe what is around me',
    'what is around me', 'what s around me', 'show me my surroundings', 'take a photo',
    'capture a photo', 'what can you see',
  ]) || hasWord(['surroundings', 'surrounding'])) return 'gemini';
  return 'unknown';
}
