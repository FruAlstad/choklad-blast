import { useCallback, useEffect, useRef, useState } from 'react'

const DURATION_MS = 5 * 60 * 1000
const PAPER = '#fff8ef'

const THEMES = [
  'En chokladkaka',
  'Ett rosa tangentbord',
  'En katt på en tangent',
  'En cupcake',
  'En regnbåge av godis',
  'En robot som äter choklad',
  'Ett hus av choklad',
  'En unicorn med keycaps',
  'En solnedgång över kakao',
  'En spelkontroll i choklad',
  'En blomma gjord av knappar',
  'En pizza med chokladtopping',
]

const COLORS = [
  '#2a1a10',
  '#6f4a2e',
  '#a67c52',
  '#f3e6d4',
  '#ffffff',
  '#ff8fb8',
  '#f72585',
  '#ff6b9d',
  '#7ec8a3',
  '#4fa87c',
  '#6ec1ff',
  '#ffd166',
]

function playAlarm(ctx) {
  const now = ctx.currentTime
  for (let i = 0; i < 4; i++) {
    const t = now + i * 0.28
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, t)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.24)
  }
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function gradePainting({ paintedRatio, colorCount, strokeCount, timeLeftMs, timedOut }) {
  let score = 1

  // Did they paint something meaningful?
  if (paintedRatio > 0.01) score += 1
  if (paintedRatio > 0.04) score += 1
  if (paintedRatio > 0.1) score += 1
  if (paintedRatio > 0.2) score += 1

  // Variety & effort
  if (colorCount >= 2) score += 1
  if (colorCount >= 4) score += 1
  if (strokeCount >= 8) score += 1
  if (strokeCount >= 25) score += 1

  // Time bonus for finishing early with actual work
  if (!timedOut && paintedRatio > 0.03) {
    if (timeLeftMs > 60_000) score += 1
    if (timeLeftMs > 150_000) score += 1
  }

  // Soft penalty for timeout with almost blank canvas
  if (timedOut && paintedRatio < 0.02) score = Math.min(score, 3)

  return Math.max(1, Math.min(10, score))
}

export default function PaintChallenge({ onExit, score: carryScore = 0 }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const audioRef = useRef(null)
  const statsRef = useRef({ strokes: 0, colors: new Set() })
  const endRef = useRef(null)
  const remainingRef = useRef(DURATION_MS)

  const [theme] = useState(() => THEMES[Math.floor(Math.random() * THEMES.length)])
  const [color, setColor] = useState(COLORS[5])
  const [brush, setBrush] = useState(14)
  const [eraser, setEraser] = useState(false)
  const [remaining, setRemaining] = useState(DURATION_MS)
  const [done, setDone] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [grade, setGrade] = useState(null)

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioRef.current.state === 'suspended') audioRef.current.resume()
    return audioRef.current
  }, [])

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useEffect(() => {
    initCanvas()
  }, [initCanvas])

  const finish = useCallback(
    (fromTimeout) => {
      if (endRef.current) return
      endRef.current = true

      const canvas = canvasRef.current
      let paintedRatio = 0
      if (canvas) {
        const ctx = canvas.getContext('2d')
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        let painted = 0
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          if (r < 250 || g < 245 || b < 230) painted++
        }
        paintedRatio = painted / (data.length / 16)
      }

      const timeLeftMs = fromTimeout ? 0 : remainingRef.current
      const g = gradePainting({
        paintedRatio,
        colorCount: statsRef.current.colors.size,
        strokeCount: statsRef.current.strokes,
        timeLeftMs,
        timedOut: fromTimeout,
      })

      if (fromTimeout) {
        setTimedOut(true)
        try {
          playAlarm(ensureAudio())
        } catch {
          // ignore audio errors
        }
      }

      setGrade(g)
      setDone(true)
    },
    [ensureAudio],
  )

  useEffect(() => {
    if (done) return undefined
    const started = performance.now()
    const id = window.setInterval(() => {
      const left = DURATION_MS - (performance.now() - started)
      remainingRef.current = left
      setRemaining(left)
      if (left <= 0) {
        window.clearInterval(id)
        remainingRef.current = 0
        setRemaining(0)
        finish(true)
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [done, finish])

  const pos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = (e) => {
    if (done) return
    e.preventDefault()
    ensureAudio()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { x, y } = pos(e)
    const paintColor = eraser ? PAPER : color
    drawingRef.current = true
    canvas.setPointerCapture?.(e.pointerId)
    ctx.strokeStyle = paintColor
    ctx.fillStyle = paintColor
    ctx.lineWidth = eraser ? brush * 1.6 : brush
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.01, y)
    ctx.stroke()
    if (!eraser) {
      statsRef.current.strokes += 1
      statsRef.current.colors.add(color)
    }
  }

  const moveDraw = (e) => {
    if (!drawingRef.current || done) return
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = pos(e)
    ctx.strokeStyle = eraser ? PAPER : color
    ctx.lineWidth = eraser ? brush * 1.6 : brush
    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const endDraw = () => {
    drawingRef.current = false
  }

  const urgent = remaining <= 15_000 && !done

  return (
    <div className="paint-screen">
      <header className="paint-top">
        <button type="button" className="bb-btn" onClick={onExit}>
          Tillbaka
        </button>
        <div className="paint-title-wrap">
          <h1 className="paint-title">Level 3 · Måla temat</h1>
          <p className="paint-theme">Tema: <strong>{theme}</strong></p>
        </div>
        <div className={`paint-timer${urgent ? ' urgent' : ''}`}>
          <span>Tid</span>
          <strong>{formatTime(remaining)}</strong>
        </div>
      </header>

      <div className="paint-tools">
        <div className="paint-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`paint-swatch${!eraser && color === c ? ' active' : ''}`}
              style={{ background: c }}
              aria-label={c}
              disabled={done}
              onClick={() => {
                setColor(c)
                setEraser(false)
              }}
            />
          ))}
          <button
            type="button"
            className={`paint-swatch paint-eraser${eraser ? ' active' : ''}`}
            disabled={done}
            title="Suddi"
            onClick={() => setEraser(true)}
          >
            Suddi
          </button>
        </div>
        <div className="paint-brushes">
          {[6, 14, 28].map((size) => (
            <button
              key={size}
              type="button"
              className={`bb-btn${brush === size ? ' primary' : ''}`}
              disabled={done}
              onClick={() => setBrush(size)}
            >
              {size === 6 ? 'Fin' : size === 14 ? 'Normal' : 'Tjock'}
            </button>
          ))}
        </div>
      </div>

      <div className="paint-stage">
        <canvas
          ref={canvasRef}
          width={900}
          height={520}
          className={`paint-canvas${eraser ? ' erasing' : ''}`}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          onPointerLeave={endDraw}
        />
      </div>

      <div className="paint-actions">
        <button
          type="button"
          className="bb-btn"
          disabled={done}
          onClick={() => {
            initCanvas()
            statsRef.current = { strokes: 0, colors: new Set() }
          }}
        >
          Rensa
        </button>
        <button
          type="button"
          className="bb-btn primary paint-done-btn"
          disabled={done}
          onClick={() => finish(false)}
        >
          Klar
        </button>
        <div className="paint-carry">Poäng med: {carryScore}</div>
      </div>

      {done && (
        <div className="paint-overlay">
          <div className="bb-modal">
            <h2 className={timedOut ? 'bb-gameover' : 'bb-levelup'}>
              {timedOut ? 'TIDEN ÄR SLUT!' : 'KLART!'}
            </h2>
            {timedOut && <p className="paint-alarm-note">⏰ Alarm!</p>}
            <p>Tema: {theme}</p>
            <p className="paint-grade">Betyg: {grade} / 10</p>
            <button type="button" className="bb-btn primary" onClick={onExit}>
              Tillbaka till meny
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
