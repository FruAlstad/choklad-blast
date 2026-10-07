import { useCallback, useEffect, useRef, useState } from 'react'

const CANVAS_W = 560
const CANVAS_H = 480
const GROUND_Y = 400

const PARTS = [
  { id: 'foundation', label: 'Grund', color: '#6b6b6b', kind: 'layer' },
  { id: 'walls', label: 'Väggar', color: '#e8c4a0', kind: 'layer' },
  { id: 'roof', label: 'Tak', color: '#8b3a2a', kind: 'layer' },
  { id: 'door', label: 'Dörr', color: '#5c3a21', kind: 'piece' },
  { id: 'window', label: 'Fönster', color: '#6ec1ff', kind: 'piece' },
  { id: 'chimney', label: 'Skorsten', color: '#7a4a3a', kind: 'piece' },
  { id: 'choklad', label: 'Choklad', color: '#4a2f1a', kind: 'piece' },
]

function gradeHouse({ hasFoundation, hasWalls, hasRoof, pieces }) {
  let score = 1
  if (hasFoundation) score += 2
  if (hasWalls) score += 2
  if (hasRoof) score += 2

  const kinds = new Set(pieces.map((p) => p.id))
  if (kinds.has('door')) score += 1
  if (kinds.has('window')) score += 1
  if (kinds.size >= 3) score += 1
  if (hasFoundation && hasWalls && hasRoof && kinds.has('door')) score += 1

  return Math.max(1, Math.min(10, score))
}

function drawScene(ctx, state) {
  const { hasFoundation, hasWalls, hasRoof, pieces } = state

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  sky.addColorStop(0, '#7eb8d4')
  sky.addColorStop(0.55, '#c9e4f0')
  sky.addColorStop(1, '#5c3a21')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.beginPath()
  ctx.arc(480, 70, 36, 0, Math.PI * 2)
  ctx.fillStyle = '#ffd166'
  ctx.fill()

  ctx.fillStyle = '#4fa87c'
  ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y)
  ctx.fillStyle = '#3d8b5f'
  ctx.fillRect(0, GROUND_Y, CANVAS_W, 12)

  const houseX = 150
  const houseW = 260
  const wallH = 160
  const wallY = GROUND_Y - wallH - (hasFoundation ? 18 : 0)

  if (hasFoundation) {
    ctx.fillStyle = '#6b6b6b'
    ctx.fillRect(houseX - 10, GROUND_Y - 18, houseW + 20, 18)
    ctx.fillStyle = '#555'
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(houseX + i * 34, GROUND_Y - 18, 2, 18)
    }
  }

  if (hasWalls) {
    const g = ctx.createLinearGradient(houseX, wallY, houseX, wallY + wallH)
    g.addColorStop(0, '#f3e6d4')
    g.addColorStop(1, '#d4a574')
    ctx.fillStyle = g
    ctx.fillRect(houseX, wallY, houseW, wallH)
    ctx.strokeStyle = '#a67c52'
    ctx.lineWidth = 3
    ctx.strokeRect(houseX + 1.5, wallY + 1.5, houseW - 3, wallH - 3)
  }

  if (hasRoof) {
    const roofTop = wallY - 70
    ctx.beginPath()
    ctx.moveTo(houseX - 24, wallY + 8)
    ctx.lineTo(houseX + houseW / 2, roofTop)
    ctx.lineTo(houseX + houseW + 24, wallY + 8)
    ctx.closePath()
    ctx.fillStyle = '#8b3a2a'
    ctx.fill()
    ctx.strokeStyle = '#5c2418'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.strokeStyle = 'rgba(60, 20, 10, 0.35)'
    ctx.lineWidth = 1.5
    for (let i = 1; i < 5; i++) {
      const y = roofTop + i * 14
      const t = i / 5
      const left = houseX - 24 + t * (houseW / 2 + 24)
      const right = houseX + houseW + 24 - t * (houseW / 2 + 24)
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(right, y)
      ctx.stroke()
    }
  }

  pieces.forEach((p) => drawPiece(ctx, p, { houseX, houseW, wallY, wallH, hasWalls }))
}

function drawPiece(ctx, p, layout) {
  const { houseX, houseW, wallY, wallH, hasWalls } = layout

  if (p.id === 'door') {
    const w = 48
    const h = 90
    const x = hasWalls ? houseX + houseW / 2 - w / 2 : p.x - w / 2
    const y = hasWalls ? wallY + wallH - h : p.y - h
    ctx.fillStyle = '#5c3a21'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#3d2414'
    ctx.fillRect(x + 6, y + 8, w - 12, h - 16)
    ctx.beginPath()
    ctx.arc(x + w - 12, y + h / 2, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffd166'
    ctx.fill()
    return
  }

  if (p.id === 'window') {
    const s = 42
    const x = p.x - s / 2
    const y = p.y - s / 2
    ctx.fillStyle = '#6ec1ff'
    ctx.fillRect(x, y, s, s)
    ctx.strokeStyle = '#fff8ef'
    ctx.lineWidth = 4
    ctx.strokeRect(x, y, s, s)
    ctx.beginPath()
    ctx.moveTo(x + s / 2, y)
    ctx.lineTo(x + s / 2, y + s)
    ctx.moveTo(x, y + s / 2)
    ctx.lineTo(x + s, y + s / 2)
    ctx.strokeStyle = '#fff8ef'
    ctx.lineWidth = 3
    ctx.stroke()
    return
  }

  if (p.id === 'chimney') {
    const w = 36
    const h = 70
    const x = hasWalls ? houseX + houseW - 70 : p.x - w / 2
    const y = hasWalls ? wallY - 95 : p.y - h
    ctx.fillStyle = '#7a4a3a'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#5c3428'
    ctx.fillRect(x - 4, y, w + 8, 12)
    ctx.globalAlpha = 0.35
    ctx.fillStyle = '#ddd'
    ctx.beginPath()
    ctx.arc(x + w / 2 - 6, y - 14, 10, 0, Math.PI * 2)
    ctx.arc(x + w / 2 + 8, y - 28, 12, 0, Math.PI * 2)
    ctx.arc(x + w / 2 - 2, y - 44, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    return
  }

  if (p.id === 'choklad') {
    const s = 28
    ctx.fillStyle = '#4a2f1a'
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
    ctx.fillStyle = '#6f4a2e'
    ctx.fillRect(p.x - s / 2 + 4, p.y - s / 2 + 4, s - 8, s - 8)
    ctx.strokeStyle = '#3d2414'
    ctx.lineWidth = 2
    ctx.strokeRect(p.x - s / 2 + 4, p.y - s / 2 + 4, s - 8, s - 8)
  }
}

export default function HouseChallenge({ onExit, onComplete, score: carryScore = 0 }) {
  const canvasRef = useRef(null)
  const endRef = useRef(null)
  const stateRef = useRef({
    hasFoundation: false,
    hasWalls: false,
    hasRoof: false,
    pieces: [],
  })

  const [tool, setTool] = useState('foundation')
  const [hasFoundation, setHasFoundation] = useState(false)
  const [hasWalls, setHasWalls] = useState(false)
  const [hasRoof, setHasRoof] = useState(false)
  const [pieces, setPieces] = useState([])
  const [done, setDone] = useState(false)
  const [grade, setGrade] = useState(null)
  const [hint, setHint] = useState('')

  const redraw = useCallback((next) => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawScene(canvas.getContext('2d'), next)
  }, [])

  useEffect(() => {
    redraw({ hasFoundation, hasWalls, hasRoof, pieces })
  }, [hasFoundation, hasWalls, hasRoof, pieces, redraw])

  const finish = useCallback(() => {
    if (endRef.current) return
    endRef.current = true

    const s = stateRef.current
    setGrade(
      gradeHouse({
        hasFoundation: s.hasFoundation,
        hasWalls: s.hasWalls,
        hasRoof: s.hasRoof,
        pieces: s.pieces,
      }),
    )
    setDone(true)
  }, [])

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
    const { x, y } = pos(e)
    const def = PARTS.find((p) => p.id === tool)
    if (!def) return

    if (def.kind === 'layer') {
      if (def.id === 'foundation') {
        setHasFoundation(true)
        stateRef.current.hasFoundation = true
        setHint('')
        return
      }
      if (def.id === 'walls') {
        if (!stateRef.current.hasFoundation) {
          setHint('Lägg grunden först!')
          return
        }
        setHasWalls(true)
        stateRef.current.hasWalls = true
        setHint('')
        return
      }
      if (def.id === 'roof') {
        if (!stateRef.current.hasWalls) {
          setHint('Bygg väggarna först!')
          return
        }
        setHasRoof(true)
        stateRef.current.hasRoof = true
        setHint('')
        return
      }
    }

    if (!stateRef.current.hasWalls && def.id !== 'choklad') {
      setHint('Bygg väggarna innan du sätter detaljer!')
      return
    }

    if (def.id === 'door' && stateRef.current.pieces.some((p) => p.id === 'door')) {
      setHint('Huset har redan en dörr')
      return
    }
    if (def.id === 'chimney' && stateRef.current.pieces.some((p) => p.id === 'chimney')) {
      setHint('Huset har redan en skorsten')
      return
    }

    const piece = { id: def.id, x, y }
    setPieces((prev) => {
      const next = [...prev, piece]
      stateRef.current.pieces = next
      return next
    })
    setHint('')
  }

  const resetHouse = () => {
    if (done) return
    setHasFoundation(false)
    setHasWalls(false)
    setHasRoof(false)
    setPieces([])
    stateRef.current = {
      hasFoundation: false,
      hasWalls: false,
      hasRoof: false,
      pieces: [],
    }
    setHint('')
  }

  const doorCount = pieces.filter((p) => p.id === 'door').length
  const windowCount = pieces.filter((p) => p.id === 'window').length

  return (
    <div className="house-screen">
      <header className="paint-top">
        <button type="button" className="bb-btn" onClick={onExit}>
          Tillbaka
        </button>
        <div className="paint-title-wrap">
          <h1 className="paint-title">Level 5 · Bygg ett hus</h1>
          <p className="paint-theme">
            Grund → väggar → tak · sen dörr &amp; fönster · <strong>Bygg ditt hus!</strong>
          </p>
        </div>
        <div className="paint-carry">Poäng med: {carryScore}</div>
      </header>

      <div className="pizza-tools">
        {PARTS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`pizza-tool${tool === p.id ? ' active' : ''}`}
            disabled={done}
            onClick={() => setTool(p.id)}
          >
            <span className="pizza-tool-dot" style={{ background: p.color }} />
            {p.label}
          </button>
        ))}
      </div>

      {hint && <p className="house-hint">{hint}</p>}

      <div className="pizza-stage">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="house-canvas"
          onPointerDown={onCanvasClick}
        />
      </div>

      <div className="paint-actions">
        <button type="button" className="bb-btn" disabled={done} onClick={resetHouse}>
          Börja om
        </button>
        <button
          type="button"
          className="bb-btn primary paint-done-btn"
          disabled={done}
          onClick={finish}
        >
          Inflyttning!
        </button>
      </div>

      {done && (
        <div className="paint-overlay">
          <div className="bb-modal">
            <h2 className="bb-levelup">HUSET KLAR!</h2>
            <p>
              {hasFoundation ? 'Grund ✓' : 'Ingen grund'} · {hasWalls ? 'Väggar ✓' : 'Inga väggar'} ·{' '}
              {hasRoof ? 'Tak ✓' : 'Inget tak'}
            </p>
            <p>
              {doorCount} dörr · {windowCount} fönster
            </p>
            <p className="paint-grade">Betyg: {grade} / 10</p>
            <button
              type="button"
              className="bb-btn primary"
              onClick={onComplete || onExit}
            >
              {onComplete ? 'Fortsätt till Level 6' : 'Tillbaka till meny'}
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
