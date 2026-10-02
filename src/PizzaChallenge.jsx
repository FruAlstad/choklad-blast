import { useCallback, useEffect, useRef, useState } from 'react'

const DURATION_MS = 3 * 60 * 1000
const CANVAS_W = 520
const CANVAS_H = 520
const CX = CANVAS_W / 2
const CY = CANVAS_H / 2
const CRUST_R = 210
const DOUGH_R = 195

const TOPPINGS = [
  { id: 'sauce', label: 'Tomatsås', color: '#c0392b', kind: 'spread', size: 0 },
  { id: 'cheese', label: 'Ost', color: '#f4d35e', kind: 'spread', size: 0 },
  { id: 'pepperoni', label: 'Pepperoni', color: '#a83333', kind: 'dot', size: 22 },
  { id: 'mushroom', label: 'Svamp', color: '#c4a484', kind: 'mushroom', size: 18 },
  { id: 'olive', label: 'Oliver', color: '#2c2c2c', kind: 'ring', size: 12 },
  { id: 'choklad', label: 'Choklad', color: '#4a2f1a', kind: 'chunk', size: 16 },
  { id: 'basil', label: 'Basilika', color: '#3d8b5f', kind: 'leaf', size: 14 },
]

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

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

function gradePizza({ hasSauce, hasCheese, toppings, timedOut, timeLeftMs }) {
  let score = 1
  if (hasSauce) score += 2
  if (hasCheese) score += 2

  const kinds = new Set(toppings.map((t) => t.id))
  if (kinds.size >= 1) score += 1
  if (kinds.size >= 3) score += 1
  if (kinds.size >= 5) score += 1
  if (toppings.length >= 8) score += 1
  if (toppings.length >= 18) score += 1

  if (!timedOut && hasSauce && hasCheese && toppings.length >= 5) {
    if (timeLeftMs > 45_000) score += 1
  }

  if (timedOut && !hasSauce && toppings.length < 3) score = Math.min(score, 3)

  return Math.max(1, Math.min(10, score))
}

function drawBase(ctx, hasSauce, hasCheese) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  const bg = ctx.createRadialGradient(CX, CY, 40, CX, CY, 280)
  bg.addColorStop(0, '#5c3a21')
  bg.addColorStop(1, '#2a1a10')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.beginPath()
  ctx.arc(CX, CY, CRUST_R, 0, Math.PI * 2)
  ctx.fillStyle = '#c47a3a'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(CX, CY, DOUGH_R, 0, Math.PI * 2)
  const dough = ctx.createRadialGradient(CX - 30, CY - 30, 20, CX, CY, DOUGH_R)
  dough.addColorStop(0, '#f0c98a')
  dough.addColorStop(1, '#d4a056')
  ctx.fillStyle = dough
  ctx.fill()

  if (hasSauce) {
    ctx.beginPath()
    ctx.arc(CX, CY, DOUGH_R - 18, 0, Math.PI * 2)
    ctx.fillStyle = '#c0392b'
    ctx.globalAlpha = 0.92
    ctx.fill()
    ctx.globalAlpha = 1
  }

  if (hasCheese) {
    ctx.beginPath()
    ctx.arc(CX, CY, DOUGH_R - 28, 0, Math.PI * 2)
    ctx.fillStyle = '#f4d35e'
    ctx.globalAlpha = 0.85
    ctx.fill()
    ctx.globalAlpha = 1

    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + 0.3
      const r = 40 + (i % 5) * 22
      ctx.beginPath()
      ctx.arc(CX + Math.cos(a) * r, CY + Math.sin(a) * r, 10 + (i % 3) * 3, 0, Math.PI * 2)
      ctx.fillStyle = i % 2 === 0 ? '#ffe08a' : '#e8c04a'
      ctx.globalAlpha = 0.55
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

function drawTopping(ctx, t) {
  const { x, y, id, size, rot = 0 } = t
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)

  if (id === 'pepperoni') {
    ctx.beginPath()
    ctx.arc(0, 0, size, 0, Math.PI * 2)
    ctx.fillStyle = '#a83333'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-size * 0.25, -size * 0.2, size * 0.22, 0, Math.PI * 2)
    ctx.arc(size * 0.2, size * 0.15, size * 0.18, 0, Math.PI * 2)
    ctx.fillStyle = '#8b2828'
    ctx.fill()
  } else if (id === 'mushroom') {
    ctx.fillStyle = '#c4a484'
    ctx.beginPath()
    ctx.ellipse(0, -size * 0.15, size, size * 0.55, 0, Math.PI, 0)
    ctx.fill()
    ctx.fillStyle = '#a88868'
    ctx.fillRect(-size * 0.22, -size * 0.1, size * 0.44, size * 0.7)
  } else if (id === 'olive') {
    ctx.beginPath()
    ctx.arc(0, 0, size, 0, Math.PI * 2)
    ctx.fillStyle = '#2c2c2c'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2)
    ctx.fillStyle = '#5c3a21'
    ctx.fill()
  } else if (id === 'choklad') {
    ctx.fillStyle = '#4a2f1a'
    ctx.fillRect(-size, -size * 0.7, size * 2, size * 1.4)
    ctx.fillStyle = '#6f4a2e'
    ctx.fillRect(-size * 0.7, -size * 0.45, size * 1.4, size * 0.9)
  } else if (id === 'basil') {
    ctx.fillStyle = '#3d8b5f'
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 0.55, size, rot * 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#2f6b48'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.8)
    ctx.lineTo(0, size * 0.8)
    ctx.stroke()
  }

  ctx.restore()
}

export default function PizzaChallenge({ onExit, onComplete, score: carryScore = 0 }) {
  const canvasRef = useRef(null)
  const audioRef = useRef(null)
  const endRef = useRef(null)
  const remainingRef = useRef(DURATION_MS)
  const stateRef = useRef({ hasSauce: false, hasCheese: false, toppings: [] })

  const [tool, setTool] = useState('sauce')
  const [hasSauce, setHasSauce] = useState(false)
  const [hasCheese, setHasCheese] = useState(false)
  const [toppings, setToppings] = useState([])
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

  const redraw = useCallback((sauce, cheese, pieces) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    drawBase(ctx, sauce, cheese)
    pieces.forEach((t) => drawTopping(ctx, t))
  }, [])

  useEffect(() => {
    redraw(hasSauce, hasCheese, toppings)
  }, [hasSauce, hasCheese, toppings, redraw])

  const finish = useCallback(
    (fromTimeout) => {
      if (endRef.current) return
      endRef.current = true

      const { hasSauce: s, hasCheese: c, toppings: pieces } = stateRef.current
      const timeLeftMs = fromTimeout ? 0 : remainingRef.current
      const g = gradePizza({
        hasSauce: s,
        hasCheese: c,
        toppings: pieces,
        timedOut: fromTimeout,
        timeLeftMs,
      })

      if (fromTimeout) {
        setTimedOut(true)
        try {
          playAlarm(ensureAudio())
        } catch {
          // ignore
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

  const onCanvasClick = (e) => {
    if (done) return
    ensureAudio()
    const { x, y } = pos(e)
    const dist = Math.hypot(x - CX, y - CY)
    if (dist > DOUGH_R - 8) return

    const def = TOPPINGS.find((t) => t.id === tool)
    if (!def) return

    if (def.kind === 'spread') {
      if (def.id === 'sauce') {
        setHasSauce(true)
        stateRef.current.hasSauce = true
      } else {
        setHasCheese(true)
        stateRef.current.hasCheese = true
      }
      return
    }

    const piece = {
      id: def.id,
      x,
      y,
      size: def.size * (0.85 + Math.random() * 0.3),
      rot: Math.random() * Math.PI * 2,
    }
    setToppings((prev) => {
      const next = [...prev, piece]
      stateRef.current.toppings = next
      return next
    })
  }

  const resetPizza = () => {
    if (done) return
    setHasSauce(false)
    setHasCheese(false)
    setToppings([])
    stateRef.current = { hasSauce: false, hasCheese: false, toppings: [] }
  }

  const urgent = remaining <= 15_000 && !done

  return (
    <div className="pizza-screen">
      <header className="paint-top">
        <button type="button" className="bb-btn" onClick={onExit}>
          Tillbaka
        </button>
        <div className="paint-title-wrap">
          <h1 className="paint-title">Level 4 · Gör en pizza</h1>
          <p className="paint-theme">
            Välj topping och klicka på degen · <strong>Bygg din pizza!</strong>
          </p>
        </div>
        <div className={`paint-timer${urgent ? ' urgent' : ''}`}>
          <span>Tid</span>
          <strong>{formatTime(remaining)}</strong>
        </div>
      </header>

      <div className="pizza-tools">
        {TOPPINGS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pizza-tool${tool === t.id ? ' active' : ''}`}
            disabled={done}
            onClick={() => setTool(t.id)}
          >
            <span className="pizza-tool-dot" style={{ background: t.color }} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="pizza-stage">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="pizza-canvas"
          onPointerDown={onCanvasClick}
        />
      </div>

      <div className="paint-actions">
        <button type="button" className="bb-btn" disabled={done} onClick={resetPizza}>
          Börja om
        </button>
        <button
          type="button"
          className="bb-btn primary paint-done-btn"
          disabled={done}
          onClick={() => finish(false)}
        >
          Servera!
        </button>
        <div className="paint-carry">Poäng med: {carryScore}</div>
      </div>

      {done && (
        <div className="paint-overlay">
          <div className="bb-modal">
            <h2 className={timedOut ? 'bb-gameover' : 'bb-levelup'}>
              {timedOut ? 'TIDEN ÄR SLUT!' : 'PIZZA SERVERAD!'}
            </h2>
            {timedOut && <p className="paint-alarm-note">⏰ Alarm!</p>}
            <p>
              {hasSauce ? 'Sås ✓' : 'Ingen sås'} · {hasCheese ? 'Ost ✓' : 'Ingen ost'} ·{' '}
              {toppings.length} toppings
            </p>
            <p className="paint-grade">Betyg: {grade} / 10</p>
            <button
              type="button"
              className="bb-btn primary"
              onClick={onComplete || onExit}
            >
              {onComplete ? 'Fortsätt till Level 5' : 'Tillbaka till meny'}
            </button>
            {onComplete && (
              <button type="button" className="bb-btn" onClick={onExit}>
                Tillbaka till meny
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
