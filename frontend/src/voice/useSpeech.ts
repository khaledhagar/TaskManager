import { useEffect, useRef, useState } from 'react'
import { currentLanguage } from '../i18n/language'
import type { Key } from '../i18n/messages'

type Alternative = { transcript: string }
type Result = ArrayLike<Alternative> & { isFinal: boolean }
type ResultEvent = { resultIndex: number; results: ArrayLike<Result> }
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: ResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionClass = new () => Recognition

/** The browser's speech recognition, if it has one (Chrome, Edge, Safari; not Firefox). */
function engine(): RecognitionClass | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const speechSupported = () => engine() !== undefined

const ERRORS: Record<string, Key> = {
  'not-allowed': 'voice.blocked',
  'service-not-allowed': 'voice.blocked',
  'no-speech': 'voice.noSpeech',
  network: 'voice.network',
}

type Handlers = {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (message: Key) => void
  onEnd: () => void
}

/**
 * Turn speech into text in the app's language. The microphone runs only between start() and
 * stop(), or until the browser stops after a pause (SEC-181).
 */
export function useSpeech(handlers: Handlers) {
  const [listening, setListening] = useState(false)
  const recognition = useRef<Recognition | null>(null)
  const latest = useRef(handlers)

  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => () => recognition.current?.abort(), [])

  function start() {
    const Engine = engine()
    if (!Engine) return
    const r = new Engine()
    r.lang = currentLanguage() === 'ar' ? 'ar-EG' : 'en-US'
    r.interimResults = true
    r.continuous = false
    r.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) latest.current.onFinal(result[0].transcript)
        else interim += result[0].transcript
      }
      if (interim) latest.current.onInterim(interim)
    }
    r.onerror = (event) => latest.current.onError(ERRORS[event.error] ?? 'voice.failed')
    r.onend = () => {
      recognition.current = null
      setListening(false)
      latest.current.onEnd()
    }
    recognition.current = r
    r.start()
    setListening(true)
  }

  const stop = () => recognition.current?.stop()

  return { listening, start, stop }
}
