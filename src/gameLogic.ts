export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export interface TargetDef {
  text: string
  notes: string[]
}

export const CHORDS: TargetDef[] = [
  { text: 'C Maj', notes: ['C', 'E', 'G'] },
  { text: 'D Maj', notes: ['D', 'F#', 'A'] },
  { text: 'E Maj', notes: ['E', 'G#', 'B'] },
  { text: 'F Maj', notes: ['F', 'A', 'C'] },
  { text: 'G Maj', notes: ['G', 'B', 'D'] },
  { text: 'A Maj', notes: ['A', 'C#', 'E'] },
  { text: 'B Maj', notes: ['B', 'D#', 'F#'] },
  { text: 'C Min', notes: ['C', 'D#', 'G'] },
  { text: 'D Min', notes: ['D', 'F', 'A'] },
  { text: 'E Min', notes: ['E', 'G', 'B'] },
  { text: 'F Min', notes: ['F', 'G#', 'C'] },
  { text: 'G Min', notes: ['G', 'A#', 'D'] },
  { text: 'A Min', notes: ['A', 'C', 'E'] },
  { text: 'B Min', notes: ['B', 'D', 'F#'] },
]

export const SINGLE_NOTES: TargetDef[] = NOTE_NAMES.map((name) => ({ text: name, notes: [name] }))

export const POSSIBLE_TARGETS: TargetDef[] = [...SINGLE_NOTES, ...CHORDS]

export interface Zombie {
  id: string
  x: number // 0 to 100
  y: number // 0 to 100
  target: TargetDef
  speed: number
}
