import { useState, useEffect, useCallback } from 'react'
import './App.css'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function midiNoteToName(note: number): string {
  const name = NOTE_NAMES[note % 12]
  const octave = Math.floor(note / 12) - 1
  return `${name}${octave}`
}

type MIDIStatus = 'idle' | 'requesting' | 'ready' | 'unsupported' | 'denied' | 'error'

export default function App() {
  const [midiStatus, setMidiStatus] = useState<MIDIStatus>('idle')
  const [pressedNotes, setPressedNotes] = useState<Map<number, number>>(new Map()) // note -> velocity
  const [inputNames, setInputNames] = useState<string[]>([])

  const handleMIDIMessage = useCallback((event: MIDIMessageEvent) => {
    const data = event.data
    if (!data || data.length < 3) return
    const status = data[0]
    const note = data[1]
    const velocity = data[2]
    const isNoteOn = status === 0x90 || status === 0x99 // note on (channel 0 or 9)
    const isNoteOff = status === 0x80 || status === 0x89 // note off
    const isNoteOnWithZeroVel = (status & 0xf0) === 0x90 && velocity === 0

    if (isNoteOn && velocity > 0) {
      setPressedNotes((prev) => new Map(prev).set(note, velocity))
    } else if (isNoteOff || isNoteOnWithZeroVel) {
      setPressedNotes((prev) => {
        const next = new Map(prev)
        next.delete(note)
        return next
      })
    }
  }, [])

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.requestMIDIAccess) {
      setMidiStatus('unsupported')
    }
  }, [])

  const connectMIDI = useCallback(() => {
    if (!navigator.requestMIDIAccess) return
    setMidiStatus('requesting')
    navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        setMidiStatus('ready')
        const names: string[] = []
        access.inputs.forEach((input) => {
          names.push(input.name ?? input.id ?? 'MIDI Input')
          input.onmidimessage = handleMIDIMessage
        })
        setInputNames(names)
        access.onstatechange = () => {
          const newNames: string[] = []
          access.inputs.forEach((input) => {
            newNames.push(input.name ?? input.id ?? 'MIDI Input')
            if (input.onmidimessage !== handleMIDIMessage) {
              input.onmidimessage = handleMIDIMessage
            }
          })
          setInputNames(newNames)
        }
      })
      .catch((err: Error) => {
        setMidiStatus(err.name === 'SecurityError' ? 'denied' : 'error')
        console.error('MIDI access error:', err)
      })
  }, [handleMIDIMessage])

  const pressedList = Array.from(pressedNotes.entries()).sort((a, b) => a[0] - b[0])

  return (
    <div className="app">
      <header className="header">
        <h1>MIDI Piano</h1>
        <div className={`status status--${midiStatus}`}>
          {midiStatus === 'idle' && 'Нажмите «Подключить MIDI»'}
          {midiStatus === 'requesting' && 'Подключение…'}
          {midiStatus === 'ready' && (inputNames.length ? `Готово · ${inputNames.join(', ')}` : 'Готово · устройств не найдено')}
          {midiStatus === 'unsupported' && 'Web MIDI не поддерживается (нужен Chrome/Edge)'}
          {midiStatus === 'denied' && 'Доступ к MIDI запрещён'}
          {midiStatus === 'error' && 'Ошибка подключения'}
        </div>
        {midiStatus === 'idle' && (
          <button type="button" className="connect-btn" onClick={connectMIDI}>
            Подключить MIDI
          </button>
        )}
      </header>

      <section className="notes-section">
        <h2>Нажатые клавиши</h2>
        {pressedList.length === 0 ? (
          <p className="notes-empty">Нажимайте клавиши на MIDI-клавиатуре</p>
        ) : (
          <ul className="notes-list">
            {pressedList.map(([note, velocity]) => (
              <li key={note} className="note-item">
                <span className="note-name">{midiNoteToName(note)}</span>
                <span className="note-midi">#{note}</span>
                <span className="note-velocity">vel {velocity}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
