/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseSync } from 'oxc-parser'
import { expect, test } from 'vitest'

const SRC = join(import.meta.dirname, '..')
const TEXT_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'label', 'alt']
/** Technical strings that look like words but are never shown to users. */
const ALLOWED = new Set([
  'AbortError', 'Accept-Language', 'Content-Type', 'Escape', 'Enter', 'Tab', 'Space', 'Backspace',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Task Manager', 'Instrument Sans Variable', 'noopener noreferrer', 'Notification', 'Esc',
])

/** Data files that hold words but no interface text. */
const DATA_FILES = new Set(['commonPasswords.ts'])

type Node = { type: string; [key: string]: unknown }

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'i18n' || entry.name === 'test' ? [] : sourceFiles(path)
    if (DATA_FILES.has(entry.name)) return []
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

const looksLikeProse = (text: string) => /^[A-Z][a-z]+/.test(text) || /[a-z]{2,}'?[a-z]* [a-z]{2,}/i.test(text)

/** User-facing English found in one file. */
function findEnglish(path: string): string[] {
  const found: string[] = []
  const check = (text: string, always: boolean) => {
    const value = text.trim()
    if (ALLOWED.has(value) || !/[A-Za-z]{2,}/.test(value)) return
    if (always || looksLikeProse(value)) found.push(value)
  }
  const visit = (node: unknown, parent?: Node): void => {
    if (Array.isArray(node)) return node.forEach((child) => visit(child, parent))
    if (!node || typeof node !== 'object') return
    const n = node as Node
    if (n.type === 'ImportDeclaration' || n.type === 'ExportNamedDeclaration' && n.source) return
    if (n.type === 'JSXText') check(n.value as string, true)
    if (n.type === 'Literal' && typeof n.value === 'string') {
      const attribute = parent?.type === 'JSXAttribute' ? (parent.name as { name: string }).name : null
      if (attribute !== 'className') check(n.value, TEXT_ATTRIBUTES.includes(attribute ?? ''))
    }
    if (n.type === 'TemplateElement') check((n.value as { cooked: string }).cooked, false)
    for (const [key, child] of Object.entries(n)) if (key !== 'type') visit(child, n)
  }
  visit(parseSync(path, readFileSync(path, 'utf-8')).program)
  return found
}

test('no hard-coded user-facing English in components (T-245)', () => {
  const report = sourceFiles(SRC).flatMap((path) =>
    findEnglish(path).map((text) => `${relative(SRC, path)}: ${text}`),
  )
  expect(report).toEqual([])
})
