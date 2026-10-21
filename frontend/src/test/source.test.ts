/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { expect, test } from 'vitest'

const SRC = join(import.meta.dirname, '..')
const ROOT = join(SRC, '..')

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return files(path, pattern)
    return pattern.test(entry.name) ? [path] : []
  })
}

const read = (path: string) => readFileSync(path, 'utf-8')
const name = (path: string) => relative(SRC, path).replaceAll('\\', '/')

test('every css.name used in a component exists in its CSS module', () => {
  const missing: string[] = []
  for (const path of files(SRC, /\.tsx?$/)) {
    const source = read(path)
    for (const [, alias, from] of source.matchAll(/import (\w+) from '([^']+\.module\.css)'/g)) {
      const css = read(resolve(dirname(path), from))
      // Skip matches inside strings such as t('ui.close') or '../ui/ui.module.css'.
      const used = source.matchAll(new RegExp(`(?<![\\w.'"/\`])${alias}\\.(\\w+)`, 'g'))
      for (const [, cls] of used) {
        if (!new RegExp(`\\.${cls}(?![\\w-])`).test(css)) missing.push(`${name(path)}: ${alias}.${cls}`)
      }
    }
  }
  expect(missing).toEqual([])
})

test('no source file is over 300 lines (NFR-42)', () => {
  // The translation dictionaries are data (one line per message), so they are exempt.
  const exempt = ['i18n/en.ts', 'i18n/ar.ts']
  const long = files(SRC, /\.(tsx?|css)$/)
    .filter((path) => !exempt.includes(name(path)))
    .map((path) => [name(path), read(path).split('\n').length] as const)
    .filter(([, lines]) => lines > 300)
  expect(long).toEqual([])
})

test('no external URLs are loaded by the page (SEC-83)', () => {
  const sources = [join(ROOT, 'index.html'), ...files(SRC, /\.(tsx?|css)$/).filter((p) => !/\.test\.tsx?$/.test(p))]
  const external = sources.flatMap((path) =>
    [...read(path).matchAll(/(?:src|href)=["']https?:|url\(\s*["']?https?:|@import\s+["']?(?:url\()?https?:/g)].map(
      () => name(path),
    ),
  )
  expect(external).toEqual([])
})

const DIST = join(ROOT, 'dist', 'assets')

test.skipIf(!existsSync(DIST))('production JS and CSS stay under 300 KB gzipped (NFR-02)', () => {
  const total = files(DIST, /\.(js|css)$/).reduce((sum, path) => sum + gzipSync(readFileSync(path)).length, 0)
  expect(total).toBeLessThan(300 * 1024)
})
