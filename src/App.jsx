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

const DEEP_KEYS = new Set(['Space', 'Enter', 'Back', 'Shift'])

function makeNoiseBuffer(ctx, duration, power = 2.2) {
  const size = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < size; i++) {
    const t = i / size
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, power)
  }
  return buffer
}

function panOut(ctx, node, pan = 0) {
  const panner = ctx.createStereoPanner()
  panner.pan.value = Math.max(-0.55, Math.min(0.55, pan))
  node.connect(panner)
  panner.connect(ctx.destination)
}

/** Clean mechanical key sound — short and pleasant, not ASMR-y */
function playKeyDown(ctx, { deep = false, pan = 0 } = {}) {
  const now = ctx.currentTime
  const jitter = Math.random() * 12

  // Main body (warm thock)
  const body = ctx.createOscillator()
  body.type = 'triangle'
  body.frequency.setValueAtTime((deep ? 118 : 195) + jitter, now)
  body.frequency.exponentialRampToValueAtTime(deep ? 62 : 105, now + (deep ? 0.09 : 0.055))
  const bodyGain = ctx.createGain()
  bodyGain.gain.setValueAtTime(deep ? 0.55 : 0.38, now)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + (deep ? 0.1 : 0.065))
  const bodyFilter = ctx.createBiquadFilter()
  bodyFilter.type = 'lowpass'
  bodyFilter.frequency.value = deep ? 900 : 1400
  body.connect(bodyFilter)
  bodyFilter.connect(bodyGain)
  panOut(ctx, bodyGain, pan)

  // Short click transient
  const click = ctx.createBufferSource()
  click.buffer = makeNoiseBuffer(ctx, deep ? 0.035 : 0.022, 3.4)
  const clickFilter = ctx.createBiquadFilter()
  clickFilter.type = 'bandpass'
  clickFilter.frequency.value = deep ? 1400 : 2100
  clickFilter.Q.value = 1.6
  const clickGain = ctx.createGain()
  clickGain.gain.setValueAtTime(deep ? 0.7 : 0.5, now)
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + (deep ? 0.04 : 0.025))
  click.connect(clickFilter)
  clickFilter.connect(clickGain)
  panOut(ctx, clickGain, pan)

  // Soft low bump for heavier keys
  if (deep) {
    const bump = ctx.createOscillator()
    bump.type = 'sine'
    bump.frequency.setValueAtTime(78, now)
    bump.frequency.exponentialRampToValueAtTime(40, now + 0.08)
    const bumpGain = ctx.createGain()
    bumpGain.gain.setValueAtTime(0.45, now)
    bumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
    bump.connect(bumpGain)
    panOut(ctx, bumpGain, pan * 0.4)
    bump.start(now)
    bump.stop(now + 0.1)
  }

  body.start(now)
  click.start(now)
  body.stop(now + 0.12)
}

function playKeyUp(ctx, { deep = false, pan = 0 } = {}) {
  const now = ctx.currentTime
  const click = ctx.createBufferSource()
  click.buffer = makeNoiseBuffer(ctx, 0.018, 3.8)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = deep ? 1600 : 2400
  filter.Q.value = 1.2
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(deep ? 0.22 : 0.15, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)
  click.connect(filter)
  filter.connect(gain)
  panOut(ctx, gain, pan)
  click.start(now)
}

function panForKey(col, cols) {
  if (cols <= 1) return 0
  return (col / (cols - 1)) * 0.9 - 0.45
}

/** Gaming lobby music with a solid 4/4 beat. */
function startLobbyMusic(ctx) {
  const master = ctx.createGain()
  master.gain.value = 0.0001
  master.connect(ctx.destination)

  const now = ctx.currentTime
  master.gain.exponentialRampToValueAtTime(0.28, now + 0.8)

  const BPM = 108
  const stepDur = 60 / BPM / 4 // 16th notes
  const stepsPerBar = 16

  const padFreqs = [146.83, 196.0, 246.94] // D3 G3 B3
  const padNodes = padFreqs.map((freq, i) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const gain = ctx.createGain()
    gain.gain.value = 0.03 + i * 0.006
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 700
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    osc.start(now)
    return osc
  })

  const noiseBurst = (duration, power = 3) => {
    const size = Math.max(1, Math.floor(ctx.sampleRate * duration))
    const buf = ctx.createBuffer(1, size, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < size; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / size, power)
    }
    return buf
  }

  const playKick = (t) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.95, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    osc.connect(g)
    g.connect(master)
    osc.start(t)
    osc.stop(t + 0.2)

    const click = ctx.createBufferSource()
    click.buffer = noiseBurst(0.02, 4)
    const cf = ctx.createBiquadFilter()
    cf.type = 'lowpass'
    cf.frequency.value = 800
    const cg = ctx.createGain()
    cg.gain.setValueAtTime(0.35, t)
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.025)
    click.connect(cf)
    cf.connect(cg)
    cg.connect(master)
    click.start(t)
  }

  const playSnare = (t) => {
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBurst(0.12, 2.2)
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = 1800
    nf.Q.value = 0.8
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.55, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    noise.connect(nf)
    nf.connect(ng)
    ng.connect(master)
    noise.start(t)

    const tone = ctx.createOscillator()
    tone.type = 'triangle'
    tone.frequency.setValueAtTime(200, t)
    tone.frequency.exponentialRampToValueAtTime(120, t + 0.06)
    const tg = ctx.createGain()
    tg.gain.setValueAtTime(0.25, t)
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
    tone.connect(tg)
    tg.connect(master)
    tone.start(t)
    tone.stop(t + 0.1)
  }

  const playHat = (t, open = false) => {
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBurst(open ? 0.08 : 0.03, open ? 2 : 4)
    const nf = ctx.createBiquadFilter()
    nf.type = 'highpass'
    nf.frequency.value = 7000
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(open ? 0.12 : 0.08, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.08 : 0.03))
    noise.connect(nf)
    nf.connect(ng)
    ng.connect(master)
    noise.start(t)
  }

  const playBass = (t, freq) => {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq, t)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(520, t)
    filter.frequency.exponentialRampToValueAtTime(180, t + 0.18)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    osc.connect(filter)
    filter.connect(g)
    g.connect(master)
    osc.start(t)
    osc.stop(t + 0.25)
  }

  const playLead = (t, freq) => {
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = freq
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2200
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    osc.connect(filter)
    filter.connect(g)
    g.connect(master)
    osc.start(t)
    osc.stop(t + 0.22)
  }

  const bassNotes = [73.42, 0, 73.42, 0, 87.31, 0, 73.42, 0, 98.0, 0, 87.31, 0, 73.42, 0, 65.41, 0]
  const leadNotes = [293.66, 0, 349.23, 0, 392.0, 0, 349.23, 293.66, 0, 261.63, 293.66, 0, 349.23, 0, 392.0, 0]

  let step = 0
  let timerId = null
  let stopped = false
  let nextTime = ctx.currentTime + 0.05

  const tick = () => {
    if (stopped) return
    const t = nextTime
    const s = step % stepsPerBar

    if (s === 0 || s === 8 || s === 10) playKick(t)
    if (s === 4 || s === 12) playSnare(t)
    if (s % 2 === 0) playHat(t, s === 6 || s === 14)
    if (s % 4 === 3) playHat(t, false)

    if (bassNotes[s]) playBass(t, bassNotes[s])
    if (leadNotes[s]) playLead(t, leadNotes[s])

    step += 1
    nextTime += stepDur
    const delay = Math.max(0, (nextTime - ctx.currentTime) * 1000 - 5)
    timerId = window.setTimeout(tick, delay)
  }
  tick()

  return {
    stop() {
      if (stopped) return
      stopped = true
      if (timerId) window.clearTimeout(timerId)
      const t = ctx.currentTime
      try {
        master.gain.cancelScheduledValues(t)
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t)
        master.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      } catch {
        // ignore
      }
      window.setTimeout(() => {
        try {
          padNodes.forEach((osc) => osc.stop())
        } catch {
          // ignore
        }
      }, 600)
    },
  }
}

function App() {
  const audioRef = useRef(null)
  const lobbyRef = useRef(null)
  const [pressed, setPressed] = useState(() => new Set())
  const [playing, setPlaying] = useState(false)
  const [musicOn, setMusicOn] = useState(false)

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioRef.current.state === 'suspended') {
      audioRef.current.resume()
    }
    return audioRef.current
  }, [])

  const ensureLobbyMusic = useCallback(() => {
    const ctx = ensureAudio()
    if (!lobbyRef.current) {
      lobbyRef.current = startLobbyMusic(ctx)
      setMusicOn(true)
    }
    return ctx
  }, [ensureAudio])

  const playDown = useCallback(
    (label, col, cols) => {
      const ctx = ensureLobbyMusic()
      playKeyDown(ctx, {
        deep: DEEP_KEYS.has(label),
        pan: panForKey(col, cols),
      })
    },
    [ensureLobbyMusic],
  )

  const playUp = useCallback((label, col, cols) => {
    if (!audioRef.current) return
    playKeyUp(audioRef.current, {
      deep: DEEP_KEYS.has(label),
      pan: panForKey(col, cols),
    })
  }, [])

  const startGame = useCallback(() => {
    // Keep / start beat through the whole game, not just the lobby
    ensureLobbyMusic()
    setPlaying(true)
  }, [ensureLobbyMusic])

  const exitGame = useCallback(() => {
    setPlaying(false)
    ensureLobbyMusic()
  }, [ensureLobbyMusic])

  const toggleMusic = useCallback(() => {
    if (lobbyRef.current) {
      lobbyRef.current.stop()
      lobbyRef.current = null
      setMusicOn(false)
      return
    }
    ensureLobbyMusic()
  }, [ensureLobbyMusic])

  const pressKey = useCallback(
    (id, label, col, cols) => {
      setPressed((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        return next
      })
      playDown(label, col, cols)
      if (label === 'Space') startGame()
    },
    [playDown, startGame],
  )

  const releaseKey = useCallback(
    (id, label, col, cols) => {
      setPressed((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (label != null) playUp(label, col ?? 0, cols ?? 1)
    },
    [playUp],
  )

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

    const findKeys = (label) => {
      const found = []
      rows.forEach((row, i) => {
        row.forEach((k, j) => {
          if (k === label) found.push({ id: `${i}-${j}`, col: j, cols: row.length })
        })
      })
      return found
    }

    const down = (e) => {
      const label = labelFromCode(e.code, e.key)
      if (!label) return
      const keys = findKeys(label)
      if (!keys.length) return
      e.preventDefault()
      keys.forEach(({ id, col, cols }) => pressKey(id, label, col, cols))
    }

    const up = (e) => {
      const label = labelFromCode(e.code, e.key)
      if (!label) return
      findKeys(label).forEach(({ id, col, cols }) => releaseKey(id, label, col, cols))
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [playing, pressKey, releaseKey])

  useEffect(() => {
    return () => {
      lobbyRef.current?.stop()
      lobbyRef.current = null
    }
  }, [])

  const musicButton = (
    <button
      type="button"
      className={`music-toggle${musicOn ? ' is-on' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        toggleMusic()
      }}
      title={musicOn ? 'Stäng av musik' : 'Sätt på musik'}
    >
      {musicOn ? 'Musik på' : 'Musik'}
    </button>
  )

  if (playing) {
    return (
      <>
        {musicButton}
        <BlockBlast onExit={exitGame} />
      </>
    )
  }

  return (
    <div className="keyboard-bg">
      {musicButton}
      <p className="keyboard-hint">Tryck på tangenterna · Space = Play</p>
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
                    pressKey(id, key, j, row.length)
                  }}
                  onPointerUp={() => releaseKey(id, key, j, row.length)}
                  onPointerCancel={() => releaseKey(id, key, j, row.length)}
                  onPointerLeave={(e) => {
                    if (e.buttons === 0) releaseKey(id, key, j, row.length)
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
