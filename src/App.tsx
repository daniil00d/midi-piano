import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import { POSSIBLE_TARGETS, NOTE_NAMES } from './gameLogic'
import type { Zombie } from './gameLogic'

function midiNoteToName(note: number): string {
  const name = NOTE_NAMES[note % 12]
  const octave = Math.floor(note / 12) - 1
  return `${name}${octave}`
}

function midiNoteToClass(note: number): string {
  return NOTE_NAMES[note % 12]
}

type MIDIStatus = 'idle' | 'requesting' | 'ready' | 'unsupported' | 'denied' | 'error'

export default function App() {
  const [midiStatus, setMidiStatus] = useState<MIDIStatus>('idle')
  const [pressedNotes, setPressedNotes] = useState<Map<number, number>>(new Map()) // note -> velocity
  const [inputNames, setInputNames] = useState<string[]>([])

  // Game state
  const [isPlaying, setIsPlaying] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [zombies, setZombies] = useState<Zombie[]>([])

  // Game refs to avoid dependency loops in intervals
  const zombiesRef = useRef<Zombie[]>([])
  const isPlayingRef = useRef(false)

  useEffect(() => {
    zombiesRef.current = zombies
  }, [zombies])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const startGame = () => {
    setIsPlaying(true)
    setGameOver(false)
    setScore(0)
    setZombies([])
    setPressedNotes(new Map())
  }

  // --- Game Loop Implementation ---
  useEffect(() => {
    if (!isPlaying) return

    const moveInterval = setInterval(() => {
      setZombies((prevZombies) => {
        const nextZombies = prevZombies.map((z) => ({
          ...z,
          y: z.y + z.speed,
        }))

        // Check for game over (zombie reached the bottom, e.g., y > 90)
        if (nextZombies.some((z) => z.y >= 90)) {
          setIsPlaying(false)
          setGameOver(true)
        }

        return nextZombies
      })
    }, 100)

    const spawnInterval = setInterval(() => {
      if (!isPlayingRef.current) return

      const newTarget = POSSIBLE_TARGETS[Math.floor(Math.random() * POSSIBLE_TARGETS.length)]
      const newZombie: Zombie = {
        id: Math.random().toString(36).substring(2, 9),
        x: Math.random() * 80 + 10, // 10% to 90%
        y: 0,
        target: newTarget,
        speed: Math.random() * 0.5 + 0.5, // 0.5 to 1.0 per 100ms
      }

      setZombies((prev) => [...prev, newZombie])
    }, 2000)

    return () => {
      clearInterval(moveInterval)
      clearInterval(spawnInterval)
    }
  }, [isPlaying])

  // --- Hit Logic ---
  useEffect(() => {
    if (!isPlaying || pressedNotes.size === 0 || zombies.length === 0) return

    // Get current pressed notes names
    const currentNotes = Array.from(pressedNotes.keys()).map(midiNoteToClass)
    // Remove duplicates to handle octaves
    const uniqueNotes = Array.from(new Set(currentNotes))

    const hitZombieIndex = zombies.findIndex(z => {
      // Check if all notes in the target are present in the pressed notes
      const hasAllNotes = z.target.notes.every((note: string) => uniqueNotes.includes(note))
      // Strictly require exact number of notes? Let's be lenient for octaves, but strict for the base notes
      return hasAllNotes && z.target.notes.length === uniqueNotes.length
    })

    if (hitZombieIndex !== -1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setZombies(prev => {
        const next = [...prev]
        next.splice(hitZombieIndex, 1)
        return next
      })

      setScore(s => s + 10)
    }

  }, [pressedNotes, isPlaying, zombies])

  const pressedList = Array.from(pressedNotes.entries()).sort((a, b) => a[0] - b[0])

  return (
    <div className="app">
      <header className="header">
        <h1>MIDI Ranger vs Zombies</h1>
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

      <div className="game-container">
        <div className="game-board">
          {isPlaying && zombies.map(zombie => (
            <div
              key={zombie.id}
              className="zombie"
              style={{ left: `${zombie.x}%`, top: `${zombie.y}%` }}
            >
              <div className="zombie-target">{zombie.target.text}</div>
              <div className="zombie-sprite">🧟</div>
            </div>
          ))}

          {isPlaying && (
            <div className="ranger">🤠</div>
          )}

          {!isPlaying && !gameOver && (
            <div className="overlay">
              <h2>Нажми Start, чтобы играть</h2>
              <button onClick={startGame} className="start-btn" disabled={midiStatus !== 'ready'}>
                Start Game
              </button>
            </div>
          )}

          {gameOver && (
            <div className="overlay">
              <h2>Game Over!</h2>
              <p>Score: {score}</p>
              <button onClick={startGame} className="start-btn">
                Restart
              </button>
            </div>
          )}
        </div>

        <div className="score-board">
          <h2>Score: {score}</h2>
        </div>
      </div>

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
