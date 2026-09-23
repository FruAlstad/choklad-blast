import { useEffect, useRef, useState } from 'react'

const GRAVITY = 0.55
const MOVE_SPEED = 5.2
const JUMP_VELOCITY = -12.2
const PLAYER_W = 34
const PLAYER_H = 42
const VIEW_W = 960
const VIEW_H = 540

const PLATFORMS = [
  { x: 40, y: 440, w: 160, h: 48, label: 'Start', kind: 'start' },
  { x: 260, y: 400, w: 88, h: 44, label: 'Q' },
  { x: 390, y: 350, w: 88, h: 44, label: 'W' },
  { x: 520, y: 300, w: 88, h: 44, label: 'E' },
  { x: 680, y: 340, w: 110, h: 44, label: 'R', kind: 'check' },
  { x: 860, y: 280, w: 88, h: 44, label: 'T' },
  { x: 1020, y: 220, w: 88, h: 44, label: 'Y' },
  { x: 1180, y: 280, w: 100, h: 44, label: 'U' },
  { x: 1340, y: 360, w: 88, h: 44, label: 'I' },
  { x: 1480, y: 300, w: 120, h: 44, label: 'Check', kind: 'check' },
  { x: 1680, y: 240, w: 88, h: 44, label: 'O' },
  { x: 1820, y: 180, w: 88, h: 44, label: 'P' },
  { x: 1960, y: 240, w: 88, h: 44, label: '[' },
  { x: 2120, y: 320, w: 140, h: 48, label: 'Space' },
  { x: 2340, y: 260, w: 88, h: 44, label: 'A' },
  { x: 2480, y: 200, w: 88, h: 44, label: 'S' },
  { x: 2620, y: 260, w: 100, h: 44, label: 'D', kind: 'check' },
  { x: 2800, y: 200, w: 88, h: 44, label: 'F' },
  { x: 2940, y: 140, w: 88, h: 44, label: 'G' },
  { x: 3080, y: 200, w: 88, h: 44, label: 'H' },
  { x: 3240, y: 280, w: 160, h: 52, label: 'WIN', kind: 'goal' },
]

const WORLD_W = 3500
const SPAWN = { x: 90, y: 360 }

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawKey(ctx, p, camX) {
  const x = p.x - camX
  const y = p.y
  const r = 10

  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  roundRectPath(ctx, x + 3, y + 6, p.w, p.h, r)
  ctx.fill()

  let top = '#a67c52'
  let mid = '#8b5e3c'
  let bot = '#6f4a2e'
  if (p.kind === 'check') {
    top = '#7ec8a3'
    mid = '#4fa87c'
    bot = '#2f7a55'
  } else if (p.kind === 'goal') {
    top = '#ffb3d1'
    mid = '#ff6b9d'
    bot = '#d63384'
  } else if (p.kind === 'start') {
    top = '#d4a574'
    mid = '#b8874f'
    bot = '#8b5e3c'
  }

  const g = ctx.createLinearGradient(x, y, x, y + p.h)
  g.addColorStop(0, top)
  g.addColorStop(0.55, mid)
  g.addColorStop(1, bot)
  ctx.fillStyle = g
  roundRectPath(ctx, x, y, p.w, p.h, r)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255,230,200,0.28)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = '#f3e6d4'
  ctx.font = `700 ${Math.min(22, p.w * 0.28)}px "Segoe UI", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(p.label, x + p.w / 2, y + p.h / 2)
}

export default function KeyboardObby({ onExit, onComplete, score = 0 }) {
  const canvasRef = useRef(null)
  const keysRef = useRef(new Set())
  const stateRef = useRef(null)
  const [status, setStatus] = useState('playing') // playing | won | dead flash
  const [checkpoint, setCheckpoint] = useState(0)
  const [deaths, setDeaths] = useState(0)

  useEffect(() => {
    stateRef.current = {
      x: SPAWN.x,
      y: SPAWN.y,
      vx: 0,
      vy: 0,
      onGround: false,
      camX: 0,
      checkIdx: 0,
      finished: false,
    }
  }, [])

  useEffect(() => {
    const down = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'A', 'd', 'D', 'w', 'W'].includes(e.key)) {
        e.preventDefault()
      }
      keysRef.current.add(e.key)
      if (e.key === 'Escape') onExit()
      if ((e.key === 'r' || e.key === 'R') && status !== 'won') {
        setCheckpoint(0)
        setDeaths(0)
        setStatus('playing')
        stateRef.current = {
          x: SPAWN.x,
          y: SPAWN.y,
          vx: 0,
          vy: 0,
          onGround: false,
          camX: 0,
          checkIdx: 0,
          finished: false,
        }
      }
    }
    const up = (e) => keysRef.current.delete(e.key)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [onExit, status])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    let frame = 0
    let last = performance.now()

    const tick = (now) => {
      frame = requestAnimationFrame(tick)
      const dt = Math.min(2, (now - last) / (1000 / 60))
      last = now

      const s = stateRef.current
      if (!s || status === 'won') {
        paint(ctx, s)
        return
      }

      const keys = keysRef.current
      const left = keys.has('ArrowLeft') || keys.has('a') || keys.has('A')
      const right = keys.has('ArrowRight') || keys.has('d') || keys.has('D')
      const jump =
        keys.has('ArrowUp') || keys.has('w') || keys.has('W') || keys.has(' ') || keys.has('Space')

      s.vx = 0
      if (left) s.vx = -MOVE_SPEED
      if (right) s.vx = MOVE_SPEED

      if (jump && s.onGround) {
        s.vy = JUMP_VELOCITY
        s.onGround = false
      }

      s.vy += GRAVITY * dt
      s.x += s.vx * dt
      s.y += s.vy * dt

      s.onGround = false
      const player = { x: s.x, y: s.y, w: PLAYER_W, h: PLAYER_H }

      for (const p of PLATFORMS) {
        if (!rectsOverlap(player, p)) continue

        const prevBottom = s.y - s.vy * dt + PLAYER_H
        const landing = s.vy >= 0 && prevBottom <= p.y + 8

        if (landing) {
          s.y = p.y - PLAYER_H
          s.vy = 0
          s.onGround = true

          if (p.kind === 'check') {
            const checks = PLATFORMS.filter((x) => x.kind === 'check' || x.kind === 'start')
            const idx = checks.indexOf(p)
            if (idx > s.checkIdx) {
              s.checkIdx = idx
              setCheckpoint(idx)
            }
          }
          if (p.kind === 'goal') {
            s.finished = true
            setStatus('won')
          }
        } else if (s.vy < 0 && s.y < p.y + p.h && s.y + PLAYER_H > p.y + p.h - 12) {
          s.y = p.y + p.h
          s.vy = 0
        } else if (s.vx > 0) {
          s.x = p.x - PLAYER_W
        } else if (s.vx < 0) {
          s.x = p.x + p.w
        }
      }

      if (s.y > VIEW_H + 80) {
        setDeaths((d) => d + 1)
        const checks = PLATFORMS.filter((p) => p.kind === 'check' || p.kind === 'start')
        const pad = checks[s.checkIdx] || PLATFORMS[0]
        s.x = pad.x + pad.w / 2 - PLAYER_W / 2
        s.y = pad.y - PLAYER_H - 2
        s.vx = 0
        s.vy = 0
        s.camX = Math.max(0, pad.x - 200)
      }

      const targetCam = s.x - VIEW_W * 0.35
      s.camX += (targetCam - s.camX) * 0.12
      s.camX = Math.max(0, Math.min(WORLD_W - VIEW_W, s.camX))

      paint(ctx, s)
    }

    const paint = (ctx, s) => {
      const camX = s?.camX || 0

      const bg = ctx.createLinearGradient(0, 0, 0, VIEW_H)
      bg.addColorStop(0, '#5c3a21')
      bg.addColorStop(0.45, '#3e2718')
      bg.addColorStop(1, '#2a1a10')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)

      // floating key silhouettes in background
      ctx.globalAlpha = 0.08
      for (let i = 0; i < 18; i++) {
        const bx = ((i * 210 - camX * 0.25) % (VIEW_W + 120)) - 40
        const by = 40 + (i % 5) * 70
        ctx.fillStyle = '#f3e6d4'
        roundRectPath(ctx, bx, by, 54, 36, 8)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // void floor hint
      ctx.fillStyle = 'rgba(255, 100, 140, 0.12)'
      ctx.fillRect(0, VIEW_H - 18, VIEW_W, 18)
      ctx.fillStyle = 'rgba(255, 140, 170, 0.35)'
      ctx.font = '700 12px Segoe UI, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('void — don\'t fall', VIEW_W / 2, VIEW_H - 5)

      for (const p of PLATFORMS) {
        if (p.x + p.w < camX - 40 || p.x > camX + VIEW_W + 40) continue
        drawKey(ctx, p, camX)
      }

      if (s) {
        const px = s.x - camX
        const py = s.y

        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        roundRectPath(ctx, px + 3, py + 4, PLAYER_W, PLAYER_H, 8)
        ctx.fill()

        const pg = ctx.createLinearGradient(px, py, px, py + PLAYER_H)
        pg.addColorStop(0, '#ff99c2')
        pg.addColorStop(1, '#f72585')
        ctx.fillStyle = pg
        roundRectPath(ctx, px, py, PLAYER_W, PLAYER_H, 8)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,230,200,0.45)'
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.fillStyle = '#fff0d8'
        ctx.font = '800 14px Segoe UI, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('☻', px + PLAYER_W / 2, py + PLAYER_H / 2)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [status])

  const hold = (code, pressed) => {
    if (pressed) keysRef.current.add(code)
    else keysRef.current.delete(code)
  }

  return (
    <div className="obby-screen">
      <header className="obby-top">
        <button type="button" className="bb-btn" onClick={onExit}>
          Tillbaka
        </button>
        <div className="obby-title-wrap">
          <h1 className="obby-title">Level 2 · Keyboard Obby</h1>
          <p className="obby-sub">Roblox-vibes, men på ett chokladtangentbord</p>
        </div>
        <div className="obby-stats">
          <div>
            <span>Poäng</span>
            <strong>{score}</strong>
          </div>
          <div>
            <span>Deaths</span>
            <strong>{deaths}</strong>
          </div>
        </div>
      </header>

      <div className="obby-stage">
        <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="obby-canvas" />
        {status === 'won' && (
          <div className="obby-overlay">
            <div className="bb-modal">
              <h2 className="bb-levelup">OBBY CLEAR!</h2>
              <p>Du klarade keyboard-obbin</p>
              <p className="bb-final-score">
                Deaths: {deaths} · Poäng: {score}
              </p>
              <button type="button" className="bb-btn primary" onClick={onComplete || onExit}>
                {onComplete ? 'Fortsätt till Level 3' : 'Tillbaka till meny'}
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

      <p className="obby-hint">A/D eller ← → för att springa · W / Space / ↑ för att hoppa · R omstart</p>

      <div className="obby-touch">
        <button
          type="button"
          className="obby-pad"
          onPointerDown={(e) => {
            e.preventDefault()
            hold('a', true)
          }}
          onPointerUp={() => hold('a', false)}
          onPointerLeave={() => hold('a', false)}
          onPointerCancel={() => hold('a', false)}
        >
          ←
        </button>
        <button
          type="button"
          className="obby-pad jump"
          onPointerDown={(e) => {
            e.preventDefault()
            hold(' ', true)
          }}
          onPointerUp={() => hold(' ', false)}
          onPointerLeave={() => hold(' ', false)}
          onPointerCancel={() => hold(' ', false)}
        >
          Hoppa
        </button>
        <button
          type="button"
          className="obby-pad"
          onPointerDown={(e) => {
            e.preventDefault()
            hold('d', true)
          }}
          onPointerUp={() => hold('d', false)}
          onPointerLeave={() => hold('d', false)}
          onPointerCancel={() => hold('d', false)}
        >
          →
        </button>
      </div>
    </div>
  )
}
