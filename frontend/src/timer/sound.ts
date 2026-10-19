/** Two short soft tones, generated with Web Audio (no sound file needed). */
export function playChime() {
  const audio = new AudioContext()
  for (const [i, frequency] of [660, 880].entries()) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    const at = audio.currentTime + i * 0.22
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
    osc.connect(gain).connect(audio.destination)
    osc.start(at)
    osc.stop(at + 0.4)
  }
  setTimeout(() => audio.close(), 1000)
}
