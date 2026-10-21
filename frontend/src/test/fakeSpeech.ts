/** A stand-in for the browser's SpeechRecognition, for unit tests. */
export class FakeRecognition {
  static last: FakeRecognition | null = null
  lang = ''
  interimResults = false
  continuous = false
  started = false
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null

  start() {
    this.started = true
    FakeRecognition.last = this
  }

  stop() {
    this.started = false
    this.onend?.()
  }

  abort() {
    this.stop()
  }

  /** Pretend the user said `text`; `isFinal` false gives a live (interim) result. */
  say(text: string, isFinal = true) {
    const result = Object.assign([{ transcript: text }], { isFinal })
    this.onresult?.({ resultIndex: 0, results: [result] })
  }

  fail(error: string) {
    this.onerror?.({ error })
    this.stop()
  }
}

export function installFakeSpeech() {
  FakeRecognition.last = null
  Object.assign(window, { SpeechRecognition: FakeRecognition })
}

export function removeFakeSpeech() {
  Reflect.deleteProperty(window, 'SpeechRecognition')
  Reflect.deleteProperty(window, 'webkitSpeechRecognition')
}
