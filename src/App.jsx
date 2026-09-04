import { useCallback, useEffect, useRef, useState } from 'react'
import BlockBlast from './BlockBlast.jsx'

const rows = [
  ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Back'],
  ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
  ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
  ['Ctrl', 'Win', 'Alt', 'Space', 'Alt', 'Fn', 'Ctrl'],
]

const wideKeys = new Set([
  'Back',
  'Tab',
  'Caps',
  'Enter',
  'Shift',
  'Space',
  'Ctrl',
  'Win',
  'Alt',
  'Fn',
  'Esc',
])

function createAsmrClick(ctx, deep = false) {
  const now = ctx.currentTime
  const noiseDuration = deep ? 0.09 : 0.055

  const bufferSize = Math.floor(ctx.sampleRate * noiseDuration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2)
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.value = deep ? 380 : 920
  noiseFilter.Q.value = deep ? 0.7 : 1.4

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(deep ? 2.2 : 1.8, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDuration)

  noise.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(ctx.destination)

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(deep ? 140 : 210, now)
  osc.frequency.exponentialRampToValueAtTime(deep ? 70 : 95, now + 0.08)

  const oscGain = ctx.createGain()
  oscGain.gain.setValueAtTime(deep ? 1.5 : 1.2, now)
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

  osc.connect(oscGain)
  oscGain.connect(ctx.destination)

  noise.start(now)
  osc.start(now)
  osc.stop(now + 0.12)
}

function App() {
  const audioRef = useRef(null)
  const [pressed, setPressed] = useState(() => new Set())
  const [playing, setPlaying] = useState(false)

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioRef.current.state === 'suspended') {
      audioRef.current.resume()
    }
    return audioRef.current
  }, [])

  const playClick = useCallback(
    (label) => {
      const ctx = ensureAudio()
      createAsmrClick(ctx, label === 'Space' || label === 'Enter' || label === 'Back')
    },
    [ensureAudio],
  )

  const startGame = useCallback(() => {
    setPlaying(true)
  }, [])

  const pressKey = useCallback(
    (id, label) => {
      setPressed((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        return next
      })
      playClick(label)
      if (label === 'Space') startGame()
    },
    [playClick, startGame],
  )

  const releaseKey = useCallback((id) => {
    setPressed((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  useEffect(() => {
    if (playing) return undefined

    const labelFromCode = (code, key) => {
      if (code === 'Space') return 'Space'
      if (code === 'Backspace') return 'Back'
      if (code === 'Enter') return 'Enter'
      if (code === 'Tab') return 'Tab'
      if (code === 'Escape') return 'Esc'
      if (code === 'CapsLock') return 'Caps'
      if (code.startsWith('Shift')) return 'Shift'
      if (code.startsWith('Control')) return 'Ctrl'
      if (code.startsWith('Alt')) return 'Alt'
      if (code === 'MetaLeft' || code === 'MetaRight') return 'Win'
      if (key.length === 1) return key.toUpperCase()
      return null
    }

    const findIds = (label) => {
      const ids = []
      rows.forEach((row, i) => {
        row.forEach((k, j) => {
          if (k === label) ids.push(`${i}-${j}`)
        })
      })
      return ids
    }

    const down = (e) => {
      const label = labelFromCode(e.code, e.key)
      if (!label) return
      const ids = findIds(label)
      if (!ids.length) return
      e.preventDefault()
      ids.forEach((id) => pressKey(id, label))
    }

    const up = (e) => {
      const label = labelFromCode(e.code, e.key)
      if (!label) return
      findIds(label).forEach(releaseKey)
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [playing, pressKey, releaseKey])

  if (playing) {
    return <BlockBlast onExit={() => setPlaying(false)} />
  }

  return (
    <div className="keyboard-bg">
      <div className="keyboard">
        {rows.map((row, i) => (
          <div className="keyboard-row" key={i}>
            {row.map((key, j) => {
              const id = `${i}-${j}`
              const isPressed = pressed.has(id)
              return (
                <button
                  type="button"
                  key={id}
                  className={`key${wideKeys.has(key) ? ` key-${key.toLowerCase()}` : ''}${isPressed ? ' is-pressed' : ''}`}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    pressKey(id, key)
                  }}
                  onPointerUp={() => releaseKey(id)}
                  onPointerCancel={() => releaseKey(id)}
                  onPointerLeave={(e) => {
                    if (e.buttons === 0) releaseKey(id)
                  }}
                >
                  <span>{key === 'Space' ? 'Play' : key}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
