import { describe, expect, test } from 'vitest'
import { ar } from './ar'
import { formatDate, formatNumber, translate } from './core'
import { en } from './en'
import type { Message } from './messages'

const placeholders = (message: Message) =>
  Object.values(typeof message === 'string' ? { other: message } : message)
    .flatMap((text) => text.match(/\{\w+\}/g) ?? [])
    .filter((name, i, all) => all.indexOf(name) === i)
    .sort()

describe('dictionaries (T-240)', () => {
  test('Arabic has every English key and no extra keys', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort())
  })

  test('Arabic uses the same placeholders as English', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(ar[key]), key).toEqual(placeholders(en[key]))
    }
  })

  test('no message contains HTML (SEC-143)', () => {
    for (const dict of [en, ar]) {
      for (const message of Object.values(dict)) {
        for (const text of typeof message === 'string' ? [message] : Object.values(message)) {
          expect(text).not.toMatch(/<\/?[a-z]/i)
        }
      }
    }
  })
})

describe('translate (T-241)', () => {
  test('fills placeholders', () => {
    expect(translate('en', 'board.progress', { done: 2, total: 5 })).toBe('2 of 5 done')
    expect(translate('ar', 'board.progress', { done: 2, total: 5 })).toBe('تم إنجاز 2 من 5')
  })

  test('English plurals use one and other', () => {
    expect(translate('en', 'column.cardCount', { count: 1 })).toBe('1 card')
    expect(translate('en', 'column.cardCount', { count: 0 })).toBe('0 cards')
    expect(translate('en', 'column.cardCount', { count: 5 })).toBe('5 cards')
  })

  test('Arabic plurals follow the six Arabic forms', () => {
    const cards = (count: number) => translate('ar', 'column.cardCount', { count })
    expect(cards(0)).toBe('لا بطاقات')
    expect(cards(1)).toBe('بطاقة واحدة')
    expect(cards(2)).toBe('بطاقتان')
    expect(cards(3)).toBe('3 بطاقات')
    expect(cards(11)).toBe('11 بطاقة')
    expect(cards(100)).toBe('100 بطاقة')
  })
})

describe('formatting (T-242)', () => {
  const march = new Date(2026, 2, 5)

  test('dates use the language month names', () => {
    expect(formatDate('en', march, { month: 'short', day: 'numeric' })).toBe('Mar 5')
    expect(formatDate('ar', march, { month: 'long', day: 'numeric' })).toBe('5 مارس')
  })

  test('Arabic uses Western digits by default', () => {
    expect(formatNumber('ar', 1234)).toMatch(/^1.?234$/)
    expect(formatDate('ar', march, { year: 'numeric' })).toBe('2026')
  })
})
