import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { applyLanguage } from '../i18n/language'
import { ToastProvider } from '../ui/Toast'
import { FakeRecognition, installFakeSpeech, removeFakeSpeech } from '../test/fakeSpeech'
import { MicButton } from './MicButton'

function Field({ start = '', sentences = false }: { start?: string; sentences?: boolean }) {
  const [value, setValue] = useState(start)
  return (
    <ToastProvider>
      <input aria-label="Title" value={value} onChange={(e) => setValue(e.target.value)} />
      <MicButton value={value} onChange={setValue} sentences={sentences} />
    </ToastProvider>
  )
}

const mic = (name: string) => screen.getByRole('button', { name })

beforeEach(() => {
  localStorage.clear()
  applyLanguage('en')
  installFakeSpeech()
})
afterEach(removeFakeSpeech)

describe('voice input (T-600 to T-605)', () => {
  test('starts and stops; live words show in the field; longer text gets them added at the end', async () => {
    render(<Field start="Call" sentences />)
    await userEvent.click(mic('Start voice input'))
    const engine = FakeRecognition.last!
    expect(engine.started).toBe(true)
    expect(engine.lang).toBe('en-US')
    expect(engine.interimResults).toBe(true)
    expect(mic('Stop voice input')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Listening')).toBeInTheDocument()
    act(() => engine.say('the sup', false))
    expect(screen.getByLabelText('Title')).toHaveValue('Call the sup')
    act(() => engine.say('the supplier'))
    expect(screen.getByLabelText('Title')).toHaveValue('Call the supplier')
    await userEvent.click(mic('Stop voice input'))
    expect(engine.started).toBe(false)
    expect(mic('Start voice input')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Stopped')).toBeInTheDocument()
  })

  test('uses Arabic (Egypt) when the app is in Arabic', async () => {
    applyLanguage('ar')
    render(<Field />)
    await userEvent.click(mic('Start voice input'))
    expect(FakeRecognition.last!.lang).toBe('ar-EG')
  })

  test('is not shown when the browser has no speech recognition', () => {
    removeFakeSpeech()
    render(<Field />)
    expect(screen.queryByRole('button', { name: 'Start voice input' })).toBeNull()
  })

  test.each([
    ['not-allowed', 'The microphone is blocked for this site. Click the lock icon next to the web address, allow Microphone, then press the microphone button again.'],
    ['no-speech', 'No speech was heard. Try again.'],
    ['network', 'Voice input needs an internet connection.'],
    ['audio-capture', 'Voice input stopped. Try again.'],
  ])('error %s shows a translated message', async (error, message) => {
    render(<Field />)
    await userEvent.click(mic('Start voice input'))
    act(() => FakeRecognition.last!.fail(error))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(mic('Start voice input')).toHaveAttribute('aria-pressed', 'false')
  })

  test('the privacy notice shows on first use only', async () => {
    render(<Field />)
    await userEvent.click(mic('Start voice input'))
    expect(screen.getByText(/turns your speech into text/)).toBeInTheDocument()
    await userEvent.click(mic('Stop voice input'))
    await userEvent.click(mic('Start voice input'))
    expect(screen.getAllByText(/turns your speech into text/)).toHaveLength(1)
  })
})

describe('punctuation from the speech service (T-765)', () => {
  test('one-line fields such as search drop the trailing "." or "?"', async () => {
    render(<Field />)
    await userEvent.click(mic('Start voice input'))
    act(() => FakeRecognition.last!.say('design page.'))
    expect(screen.getByLabelText('Title')).toHaveValue('design page')
    act(() => FakeRecognition.last!.stop())
    await userEvent.click(mic('Start voice input'))
    act(() => FakeRecognition.last!.say('ما هو المتأخر؟'))
    expect(screen.getByLabelText('Title')).toHaveValue('ما هو المتأخر')
  })

  test('T-767 a one-line field such as a card name is replaced by what is said', async () => {
    render(<Field start="Old name" />)
    await userEvent.click(mic('Start voice input'))
    act(() => FakeRecognition.last!.say('New name', false))
    expect(screen.getByLabelText('Title')).toHaveValue('New name')
    act(() => FakeRecognition.last!.say('New name for the card.'))
    expect(screen.getByLabelText('Title')).toHaveValue('New name for the card')
  })

  test('sentence fields keep it', async () => {
    render(<Field sentences />)
    await userEvent.click(mic('Start voice input'))
    act(() => FakeRecognition.last!.say('Ship it today.'))
    expect(screen.getByLabelText('Title')).toHaveValue('Ship it today.')
  })
})
