import { describe, expect, test } from 'vitest'
import { attachmentError, backgroundError, fitWithin, formatSize } from './uploads'

const file = (name: string, size: number) => new File([new Uint8Array(size)], name)

describe('attachment checks before upload (T-221)', () => {
  test.each(['spec.pdf', 'photo.JPG', 'notes.txt', 'data.csv', 'report.docx', 'deck.pptx', 'sheet.xlsx'])(
    '%s is allowed',
    (name) => expect(attachmentError(file(name, 10))).toBeNull(),
  )

  test.each(['drawing.svg', 'page.html', 'run.exe', 'script.js', 'archive.zip', 'noext'])(
    '%s is refused',
    (name) => expect(attachmentError(file(name, 10))).toMatch(/isn't allowed/),
  )

  test('files over 4 MB are refused with their size', () => {
    expect(attachmentError(file('big.pdf', 5 * 1024 * 1024))).toBe('This file is 5.0 MB. The limit is 4 MB.')
  })
})

describe('background checks and shrinking (T-223)', () => {
  test('only photos up to 10 MB', () => {
    expect(backgroundError(file('a.webp', 100))).toBeNull()
    expect(backgroundError(file('a.gif', 100))).toMatch(/JPG, PNG or WebP/)
    expect(backgroundError(file('a.jpg', 11 * 1024 * 1024))).toMatch(/limit is 10 MB/)
  })

  test('photos are scaled to at most 2560 px on the longest side', () => {
    expect(fitWithin(6000, 4000)).toEqual({ width: 2560, height: 1707 })
    expect(fitWithin(3000, 5000)).toEqual({ width: 1536, height: 2560 })
    expect(fitWithin(1200, 800)).toEqual({ width: 1200, height: 800 })
  })

  test('sizes read naturally', () => {
    expect(formatSize(900)).toBe('900 B')
    expect(formatSize(2048)).toBe('2 KB')
    expect(formatSize(3.5 * 1024 * 1024)).toBe('3.5 MB')
  })
})
