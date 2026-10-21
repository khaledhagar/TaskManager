/// <reference types="node" />
import { render, screen } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CardComposer } from '../board/CardComposer'
import { DescriptionEditor } from '../board/DescriptionEditor'
import { FilterBar } from '../board/FilterBar'
import { EMPTY_FILTERS } from '../board/logic'
import { installFakeSpeech, removeFakeSpeech } from '../test/fakeSpeech'

beforeEach(installFakeSpeech)
afterEach(removeFakeSpeech)

const MIC = { name: 'Start voice input' }

describe('where the microphone appears (T-606)', () => {
  test('new card title, description and search have one', () => {
    render(<CardComposer onAdd={vi.fn()} onClose={vi.fn()} />)
    render(<DescriptionEditor details="" onSave={vi.fn()} />)
    render(
      <FilterBar filters={EMPTY_FILTERS} onChange={vi.fn()} labels={[]} shown={0} total={0} searchRef={{ current: null }} me={1} />,
    )
    expect(screen.getAllByRole('button', MIC)).toHaveLength(3)
  })

  test('account screens (email and password fields) never use it', () => {
    const folder = join(__dirname, '../auth')
    const files = readdirSync(folder).filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    for (const file of [...files.map((f) => join(folder, f)), join(__dirname, '../shell/PasswordDialog.tsx'), join(__dirname, '../shell/UpgradeDialog.tsx')]) {
      expect(readFileSync(file, 'utf-8'), file).not.toContain('MicButton')
    }
  })
})
