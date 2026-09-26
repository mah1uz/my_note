export const NOTE_MAX_WORDS = 300
export const NOTE_PREVIEW_WORDS = 100

export function countWords(text) {
  return String(text || '').trim().match(/\S+/gu)?.length || 0
}

export function previewNote(text) {
  const source = String(text || '')
  const words = [...source.matchAll(/\S+/gu)]
  if (words.length <= NOTE_PREVIEW_WORDS) return source
  return `${source.slice(0, words[NOTE_PREVIEW_WORDS - 1].index + words[NOTE_PREVIEW_WORDS - 1][0].length).trimEnd()}...`
}
