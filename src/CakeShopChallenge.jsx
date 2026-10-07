import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const DURATION_MS = 5 * 60 * 1000

const ALL_ITEMS = [
  { id: 'mjol', label: 'Mjöl', color: '#f5e6c8' },
  { id: 'socker', label: 'Socker', color: '#fff8ef' },
  { id: 'agg', label: 'Ägg', color: '#ffe08a' },
  { id: 'smor', label: 'Smör', color: '#ffd166' },
  { id: 'mjolk', label: 'Mjölk', color: '#f0f4ff' },
  { id: 'kakao', label: 'Kakao', color: '#4a2f1a' },
  { id: 'choklad', label: 'Choklad', color: '#6f4a2e' },
  { id: 'vanilj', label: 'Vanilj', color: '#e8d4a8' },
  { id: 'jordgubb', label: 'Jordgubbar', color: '#e85a5a' },
  { id: 'banan', label: 'Banan', color: '#f4d35e' },
  { id: 'citron', label: 'Citron', color: '#ffe566' },
  { id: 'grädde', label: 'Grädde', color: '#fff0f5' },
  { id: 'bakpulver', label: 'Bakpulver', color: '#e8eef8' },
  { id: 'salt', label: 'Salt', color: '#dde4ea' },
  { id: 'nötter', label: 'Nötter', color: '#c4a484' },
  { id: 'hallon', label: 'Hallon', color: '#d63384' },
]

const RECIPES = [
  {
    name: 'Chokladkaka',
    need: ['mjol', 'socker', 'agg', 'smor', 'kakao', 'choklad', 'bakpulver'],
  },
  {
    name: 'Jordgubbstårta',
    need: ['mjol', 'socker', 'agg', 'smor', 'jordgubb', 'grädde', 'vanilj'],
  },
  {
    name: 'Banankaka',
    need: ['mjol', 'socker', 'agg', 'smor', 'banan', 'mjolk', 'bakpulver'],
  },
  {
    name: 'Citronkaka',
    need: ['mjol', 'socker', 'agg', 'smor', 'citron', 'vanilj', 'bakpulver'],
  },
  {
    name: 'Hallon-chokladkaka',
    need: ['mjol', 'socker', 'agg', 'kakao', 'hallon', 'choklad', 'grädde'],
  },
  {
    name: 'Nötkaka',
    need: ['mjol', 'socker', 'agg', 'smor', 'nötter', 'vanilj', 'salt'],
  },
]

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function pickRecipe() {
  return RECIPES[Math.floor(Math.random() * RECIPES.length)]
}

function shelfForRecipe(recipe) {
  const needed = new Set(recipe.need)
  const extras = ALL_ITEMS.filter((i) => !needed.has(i.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
  const neededItems = ALL_ITEMS.filter((i) => needed.has(i.id))
  return [...neededItems, ...extras].sort(() => Math.random() - 0.5)
}

function makeRun() {
  const recipe = pickRecipe()
  return { recipe, shelf: shelfForRecipe(recipe) }
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
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.24)
  }
}

function countInCart(cart, id) {
  return cart.filter((x) => x === id).length
}

export default function CakeShopChallenge({ onExit, score: carryScore = 0 }) {
  const audioRef = useRef(null)
  const endRef = useRef(null)
  const remainingRef = useRef(DURATION_MS)
  const runIdRef = useRef(0)

  const [runId, setRunId] = useState(0)
  const [{ recipe, shelf }, setRun] = useState(() => makeRun())
  const [cart, setCart] = useState([])
  const [gubbeAt, setGubbeAt] = useState(0)
  const [remaining, setRemaining] = useState(DURATION_MS)
  const [status, setStatus] = useState('playing') // playing | won | timeout
  const [message, setMessage] = useState('')

  // New random cake + reset when restarting the level
  useEffect(() => {
    if (runId === 0) return
    setRun(makeRun())
    setCart([])
    setGubbeAt(0)
    setRemaining(DURATION_MS)
    remainingRef.current = DURATION_MS
    setStatus('playing')
    setMessage('')
    endRef.current = null
  }, [runId])

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioRef.current.state === 'suspended') audioRef.current.resume()
    return audioRef.current
  }, [])

  const neededCounts = useMemo(() => {
    const map = {}
    recipe.need.forEach((id) => {
      map[id] = (map[id] || 0) + 1
    })
    return map
  }, [recipe])

  const allGot = useMemo(() => {
    return Object.entries(neededCounts).every(([id, n]) => countInCart(cart, id) >= n)
  }, [cart, neededCounts])

  const wrongCount = useMemo(() => {
    const needed = new Set(recipe.need)
    return cart.filter((id) => !needed.has(id)).length
  }, [cart, recipe])

  const finishWin = useCallback(() => {
    if (endRef.current) return
    endRef.current = true
    setStatus('won')
  }, [])

  const finishTimeout = useCallback(() => {
    if (endRef.current) return
    endRef.current = true
    setStatus('timeout')
    try {
      playAlarm(ensureAudio())
    } catch {
      // ignore
    }
  }, [ensureAudio])

  useEffect(() => {
    if (status !== 'playing') return undefined
    const started = performance.now()
    const thisRun = runId
    const id = window.setInterval(() => {
      if (runIdRef.current !== thisRun) return
      const left = DURATION_MS - (performance.now() - started)
      remainingRef.current = left
      setRemaining(left)
      if (left <= 0) {
        window.clearInterval(id)
        remainingRef.current = 0
        setRemaining(0)
        finishTimeout()
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [status, runId, finishTimeout])

  useEffect(() => {
    runIdRef.current = runId
  }, [runId])

  useEffect(() => {
    if (status === 'playing' && allGot) finishWin()
  }, [allGot, status, finishWin])

  const restartLevel = () => {
    setRunId((n) => n + 1)
  }

  const buyItem = (index) => {
    if (status !== 'playing') return
    ensureAudio()
    const item = shelf[index]
    if (!item) return
    setGubbeAt(index)
    setCart((prev) => [...prev, item.id])
    const need = neededCounts[item.id] || 0
    const have = countInCart(cart, item.id)
    if (need === 0) {
      setMessage(`${item.label}? Det står inte i receptet…`)
    } else if (have + 1 >= need) {
      setMessage(`${item.label} — klart!`)
    } else {
      setMessage(`Tog ${item.label}`)
    }
  }

  const removeFromCart = (index) => {
    if (status !== 'playing') return
    setCart((prev) => prev.filter((_, i) => i !== index))
    setMessage('La tillbaka en vara')
  }

  const urgent = remaining <= 30_000 && status === 'playing'
  const itemById = (id) => ALL_ITEMS.find((i) => i.id === id)

  return (
    <div className="shop-screen">
      <header className="paint-top">
        <button type="button" className="bb-btn" onClick={onExit}>
          Tillbaka
        </button>
        <div className="paint-title-wrap">
          <h1 className="paint-title">Level 6 · Handla till kakan</h1>
          <p className="paint-theme">
            Recept: <strong>{recipe.name}</strong> · Gubben ska handla rätt saker
          </p>
        </div>
        <div className={`paint-timer${urgent ? ' urgent' : ''}`}>
          <span>Tid</span>
          <strong>{formatTime(remaining)}</strong>
        </div>
      </header>

      <div className="shop-layout">
        <aside className="shop-recipe">
          <h2>Recept</h2>
          <p className="shop-cake-name">{recipe.name}</p>
          <ul>
            {recipe.need.map((id) => {
              const item = itemById(id)
              const got = countInCart(cart, id) >= 1
              return (
                <li key={id} className={got ? 'got' : ''}>
                  <span className="shop-dot" style={{ background: item?.color }} />
                  {item?.label}
                  {got ? ' ✓' : ''}
                </li>
              )
            })}
          </ul>
          <p className="shop-carry">Poäng med: {carryScore}</p>
          {wrongCount > 0 && <p className="shop-wrong">Fel varor i korgen: {wrongCount}</p>}
        </aside>

        <div className="shop-main">
          <div className="shop-aisle" aria-label="Butikshylla">
            {shelf.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                type="button"
                className={`shop-item${gubbeAt === index ? ' gubbe-here' : ''}`}
                disabled={status !== 'playing'}
                onClick={() => buyItem(index)}
              >
                {gubbeAt === index && <span className="shop-gubbe" aria-hidden="true" />}
                <span className="shop-item-icon" style={{ background: item.color }} />
                <span className="shop-item-label">{item.label}</span>
              </button>
            ))}
          </div>

          {message && <p className="shop-message">{message}</p>}

          <div className="shop-cart">
            <h3>Korg ({cart.length})</h3>
            <div className="shop-cart-items">
              {cart.length === 0 && <span className="shop-cart-empty">Tom — klicka på varor</span>}
              {cart.map((id, index) => {
                const item = itemById(id)
                const ok = Boolean(neededCounts[id])
                return (
                  <button
                    key={`${id}-${index}`}
                    type="button"
                    className={`shop-cart-chip${ok ? ' ok' : ' bad'}`}
                    disabled={status !== 'playing'}
                    title="Ta bort"
                    onClick={() => removeFromCart(index)}
                  >
                    {item?.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="shop-hint">Klicka på varorna gubben ska köpa · Fel varor kan du ta bort från korgen</p>

      {status === 'won' && (
        <div className="paint-overlay">
          <div className="bb-modal">
            <h2 className="bb-levelup">KLARE ATT BAKA!</h2>
            <p>
              Du handlade till <strong>{recipe.name}</strong>
            </p>
            {wrongCount > 0 ? (
              <p>Lite extra i korgen ({wrongCount}) — men receptet är klart</p>
            ) : (
              <p>Perfekt inköpslista</p>
            )}
            <button type="button" className="bb-btn primary" onClick={onExit}>
              Tillbaka till meny
            </button>
          </div>
        </div>
      )}

      {status === 'timeout' && (
        <div className="paint-overlay">
          <div className="bb-modal">
            <h2 className="bb-gameover">TIDEN ÄR SLUT!</h2>
            <p className="paint-alarm-note">Du hann inte handla klart</p>
            <p>Du måste börja om level 6</p>
            <button type="button" className="bb-btn primary" onClick={restartLevel}>
              Börja om leveln
            </button>
            <button type="button" className="bb-btn" onClick={onExit}>
              Tillbaka till meny
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
