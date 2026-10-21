/** Text helpers for voice commands: tidy speech, compare names in English and Arabic. */

/** Arabic short vowels and the stretching mark: speech services rarely add them, people do. */
const MARKS = /[ً-ْٰـ]/g
/** Quotes before a word, and punctuation after one (but not inside, e.g. "domain.com"). */
const EDGES = /(^|\s)["'«»“”‘’]+|["'«»“”‘’.,!?؟،؛;:]+(?=\s|$)/g

/** Remove vowel marks and the punctuation around words; single spaces. */
export function clean(text: string): string {
  return text.replace(MARKS, '').replace(EDGES, '$1').replace(/\s+/g, ' ').trim()
}

/**
 * Lower case, and one Arabic letter form for each sound (أ إ آ -> ا, ة -> ه, ى -> ي).
 * Every change keeps the length, so a match in the folded text points at the same place in the
 * original, which keeps its spelling for new titles.
 */
export function fold(text: string): string {
  return text.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
}

export const key = (text: string) => fold(clean(text))

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length]
}

/** 3: same name; 2: the name starts with or contains the words said; 1: a small slip; 0: no. */
function score(said: string, name: string): number {
  if (!said) return 0
  if (said === name) return 3
  if (said.length >= 3 && (` ${name} `.includes(` ${said} `) || name.startsWith(said))) return 2
  return 1 - distance(said, name) / Math.max(said.length, name.length) >= 0.75 ? 1 : 0
}

/** The items whose name fits best what was said; empty when none fits. */
export function findMatches<T>(said: string, items: T[], names: (item: T) => string[]): T[] {
  const s = key(said)
  const scored = items.map((item) => ({ item, score: Math.max(0, ...names(item).map((n) => score(s, key(n)))) }))
  const best = Math.max(0, ...scored.map((x) => x.score))
  return best === 0 ? [] : scored.filter((x) => x.score === best).map((x) => x.item)
}
