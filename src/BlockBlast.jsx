import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import KeyboardObby from './KeyboardObby.jsx'
import PaintChallenge from './PaintChallenge.jsx'

const SIZE = 8
const LEVEL_GOAL = 100
const COLORS = ['#ff8fb8', '#ff6b9d', '#f72585', '#ff99c2', '#e85a8c', '#ffb3d1', '#d63384']

const SHAPES = [
  [[1]],
  [[1, 1]],
  [[1], [1]],
  [[1, 1, 1]],
  [[1], [1], [1]],
  [[1, 1], [1, 1]],
  [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
  [[1, 1, 1], [0, 0, 1]],
  [[1, 1, 1], [1, 0, 0]],
  [[1, 0], [1, 0], [1, 1]],
  [[0, 1], [0, 1], [1, 1]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 1, 1]],
  [[1], [1], [1], [1]],
  [[1, 1, 1], [0, 1, 0]],
  [[0, 1], [1, 1], [0, 1]],
  [[1, 0], [1, 1], [1, 0]],
]

function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function randomPiece() {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)]
  const color = 1 + Math.floor(Math.random() * COLORS.length)
  return { shape, color, id: Math.random().toString(36).slice(2) }
}

function randomTray() {
  return [randomPiece(), randomPiece(), randomPiece()]
}

function canPlace(board, shape, row, col) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const rr = row + r
      const cc = col + c
      if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) return false
      if (board[rr][cc]) return false
    }
  }
  return true
}

function placeOnBoard(board, shape, row, col, color) {
  const next = board.map((line) => [...line])
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) next[row + r][col + c] = color
    }
  }
  return next
}

function clearLines(board) {
  const fullRows = []
  const fullCols = []
  for (let r = 0; r < SIZE; r++) {
    if (board[r].every((cell) => cell)) fullRows.push(r)
  }
  for (let c = 0; c < SIZE; c++) {
    if (board.every((row) => row[c])) fullCols.push(c)
  }
  if (!fullRows.length && !fullCols.length) {
    return { board, cleared: 0 }
  }
  const next = board.map((line) => [...line])
  for (const r of fullRows) {
    for (let c = 0; c < SIZE; c++) next[r][c] = 0
  }
  for (const c of fullCols) {
    for (let r = 0; r < SIZE; r++) next[r][c] = 0
  }
  return { board: next, cleared: fullRows.length + fullCols.length }
}

function anyFit(board, pieces) {
  const active = pieces.filter(Boolean)
  if (!active.length) return true
  return active.some((piece) => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (canPlace(board, piece.shape, r, c)) return true
      }
    }
    return false
  })
}

function cellSizeFromBoard(boardEl) {
  if (!boardEl) return 36
  const style = getComputedStyle(boardEl)
  const gap = parseFloat(style.gap) || 0
  const padL = parseFloat(style.paddingLeft) || 0
  const padR = parseFloat(style.paddingRight) || 0
  const inner = boardEl.clientWidth - padL - padR
  return (inner - gap * (SIZE - 1)) / SIZE
}

function PiecePreview({ piece, selected, dragging, onPointerDown }) {
  if (!piece) {
    return <div className="bb-slot empty" />
  }
  const rows = piece.shape.length
  const cols = Math.max(...piece.shape.map((r) => r.length))
  return (
    <button
      type="button"
      className={`bb-slot${selected ? ' selected' : ''}${dragging ? ' dragging' : ''}`}
      onPointerDown={onPointerDown}
    >
      <div
        className="bb-piece"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          opacity: dragging ? 0.15 : 1,
        }}
      >
        {piece.shape.map((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              className="bb-mini"
              style={{
                background: cell ? COLORS[piece.color - 1] : 'transparent',
                visibility: cell ? 'visible' : 'hidden',
              }}
            />
          )),
        )}
      </div>
    </button>
  )
}

function DragGhost({ piece, x, y, cellSize }) {
  if (!piece) return null
  const gap = Math.max(2, cellSize * 0.08)
  const rows = piece.shape.length
  const cols = Math.max(...piece.shape.map((r) => r.length))
  const width = cols * cellSize + (cols - 1) * gap
  const height = rows * cellSize + (rows - 1) * gap

  return (
    <div
      className="bb-ghost"
      style={{
        left: x,
        top: y,
        width,
        height,
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
        gap,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {piece.shape.map((row, r) =>
        row.map((cell, c) => (
          <div
            key={`${r}-${c}`}
            className="bb-ghost-cell"
            style={{
              background: cell ? COLORS[piece.color - 1] : 'transparent',
              visibility: cell ? 'visible' : 'hidden',
            }}
          />
        )),
      )}
    </div>
  )
}

export default function BlockBlast({ onExit }) {
  const [board, setBoard] = useState(emptyBoard)
  const [tray, setTray] = useState(randomTray)
  const [selected, setSelected] = useState(0)
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [levelBaseScore, setLevelBaseScore] = useState(0)
  const [best, setBest] = useState(() => Number(localStorage.getItem('choklad-blast-best') || 0))
  const [hover, setHover] = useState(null)
  const [gameOver, setGameOver] = useState(false)
  const [levelUp, setLevelUp] = useState(false)
  const [drag, setDrag] = useState(null)

  const boardRef = useRef(null)
  const dragRef = useRef(null)
  const hoverRef = useRef(null)

  const selectedPiece = tray[selected]
  const activePiece = drag?.moved ? tray[drag.index] : selectedPiece
  const isDragging = Boolean(drag?.moved)
  const levelProgress = Math.min(LEVEL_GOAL, Math.max(0, score - levelBaseScore))
  const blocked = gameOver || levelUp

  const previewCells = useMemo(() => {
    if (!hover || !activePiece) return null
    if (!canPlace(board, activePiece.shape, hover.row, hover.col)) return null
    const cells = new Set()
    activePiece.shape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) cells.add(`${hover.row + r}-${hover.col + c}`)
      })
    })
    return { cells, color: activePiece.color }
  }, [board, hover, activePiece])

  const restart = useCallback(() => {
    setBoard(emptyBoard())
    setTray(randomTray())
    setSelected(0)
    setScore(0)
    setLevel(1)
    setLevelBaseScore(0)
    setHover(null)
    setDrag(null)
    setGameOver(false)
    setLevelUp(false)
  }, [])

  const goNextLevel = useCallback(() => {
    setHover(null)
    setDrag(null)
    if (level === 1) {
      setLevel(2)
      setLevelUp(false)
      return
    }
    const newBase = levelBaseScore + LEVEL_GOAL
    setLevelBaseScore(newBase)
    setLevel((prev) => prev + 1)
    setLevelUp(score - newBase >= LEVEL_GOAL)
  }, [level, levelBaseScore, score])

  const tryPlace = useCallback(
    (row, col, pieceIndex = selected) => {
      const piece = tray[pieceIndex]
      if (blocked || !piece) return false
      if (!canPlace(board, piece.shape, row, col)) return false

      let nextBoard = placeOnBoard(board, piece.shape, row, col, piece.color)
      const blockScore = piece.shape.flat().filter(Boolean).length
      const { board: clearedBoard, cleared } = clearLines(nextBoard)
      nextBoard = clearedBoard

      let nextTray = tray.map((p, i) => (i === pieceIndex ? null : p))
      if (nextTray.every((p) => !p)) nextTray = randomTray()

      const gained = blockScore + cleared * 10 + (cleared > 1 ? cleared * 5 : 0)
      const nextScore = score + gained
      setScore(nextScore)
      if (nextScore > best) {
        setBest(nextScore)
        localStorage.setItem('choklad-blast-best', String(nextScore))
      }

      setBoard(nextBoard)
      setTray(nextTray)
      setHover(null)

      const nextSelected = nextTray.findIndex(Boolean)
      setSelected(nextSelected === -1 ? 0 : nextSelected)

      if (nextScore - levelBaseScore >= LEVEL_GOAL) {
        setLevelUp(true)
        return true
      }

      if (!anyFit(nextBoard, nextTray)) setGameOver(true)
      return true
    },
    [best, blocked, board, levelBaseScore, score, selected, tray],
  )

  const pointerToCell = useCallback((clientX, clientY) => {
    const boardEl = boardRef.current
    if (!boardEl) return null
    const rect = boardEl.getBoundingClientRect()
    const style = getComputedStyle(boardEl)
    const gap = parseFloat(style.gap) || 0
    const padL = parseFloat(style.paddingLeft) || 0
    const padT = parseFloat(style.paddingTop) || 0
    const padR = parseFloat(style.paddingRight) || 0
    const padB = parseFloat(style.paddingBottom) || 0

    const x = clientX - rect.left - padL
    const y = clientY - rect.top - padT
    const innerW = rect.width - padL - padR
    const innerH = rect.height - padT - padB
    if (x < 0 || y < 0 || x > innerW || y > innerH) return null

    const cellW = (innerW - gap * (SIZE - 1)) / SIZE
    const cellH = (innerH - gap * (SIZE - 1)) / SIZE
    const col = Math.floor(x / (cellW + gap))
    const row = Math.floor(y / (cellH + gap))
    if (row < 0 || col < 0 || row >= SIZE || col >= SIZE) return null
    return { row, col }
  }, [])

  const updateHoverFromPoint = useCallback(
    (clientX, clientY, piece, cellSize) => {
      if (!piece) {
        hoverRef.current = null
        setHover(null)
        return
      }
      const rows = piece.shape.length
      const cols = Math.max(...piece.shape.map((r) => r.length))
      const gap = Math.max(2, cellSize * 0.08)
      const width = cols * cellSize + (cols - 1) * gap
      const height = rows * cellSize + (rows - 1) * gap
      // Map ghost top-left (piece is centered on pointer) to a board cell
      const topLeft = pointerToCell(clientX - width / 2 + cellSize / 2, clientY - height / 2 + cellSize / 2)
      if (!topLeft) {
        hoverRef.current = null
        setHover(null)
        return
      }
      hoverRef.current = topLeft
      setHover(topLeft)
    },
    [pointerToCell],
  )

  const endDrag = useCallback(() => {
    const current = dragRef.current
    if (!current) return
    const didDrag = current.moved
    const piece = tray[current.index]
    const cell = hoverRef.current
    if (didDrag && piece && cell) {
      tryPlace(cell.row, cell.col, current.index)
    }
    dragRef.current = null
    hoverRef.current = null
    setDrag(null)
    setHover(null)
  }, [tray, tryPlace])

  const startDrag = useCallback(
    (index, e) => {
      if (blocked || !tray[index]) return
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)

      const boardEl = boardRef.current
      const cellSize = cellSizeFromBoard(boardEl)
      const next = {
        index,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        cellSize,
        pointerId: e.pointerId,
        moved: false,
      }
      dragRef.current = next
      setSelected(index)
      setDrag(next)
    },
    [blocked, tray],
  )

  useEffect(() => {
    if (!drag) return undefined

    const DRAG_THRESHOLD = 8

    const onMove = (e) => {
      const current = dragRef.current
      if (!current || e.pointerId !== current.pointerId) return
      const boardEl = boardRef.current
      const cellSize = cellSizeFromBoard(boardEl)
      const dist = Math.hypot(e.clientX - current.startX, e.clientY - current.startY)
      const moved = current.moved || dist > DRAG_THRESHOLD
      const next = {
        ...current,
        x: e.clientX,
        y: e.clientY - (moved ? cellSize * 0.9 : 0),
        cellSize,
        moved,
      }
      dragRef.current = next
      setDrag(next)
      if (moved) {
        updateHoverFromPoint(next.x, next.y, tray[current.index], cellSize)
      }
    }

    const onUp = (e) => {
      const current = dragRef.current
      if (!current || e.pointerId !== current.pointerId) return
      endDrag()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [drag, endDrag, tray, updateHoverFromPoint])

  useEffect(() => {
    if (blocked) return
    if (!anyFit(board, tray)) setGameOver(true)
  }, [board, tray, blocked])

  useEffect(() => {
    if (level >= 2) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onExit()
      if (e.key === '1') setSelected(0)
      if (e.key === '2') setSelected(1)
      if (e.key === '3') setSelected(2)
      if (e.key === 'r' || e.key === 'R') restart()
      if ((e.key === 'Enter' || e.key === ' ') && levelUp) goNextLevel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNextLevel, level, levelUp, onExit, restart])

  if (level >= 3) {
    return <PaintChallenge onExit={onExit} score={score} />
  }

  if (level >= 2) {
    return (
      <KeyboardObby
        onExit={onExit}
        score={score}
        onComplete={() => setLevel(3)}
      />
    )
  }

  return (
    <div className={`bb-screen${isDragging ? ' is-dragging' : ''}`}>
      <h1 className="bb-title">Choklad Blast</h1>
      <header className="bb-top">
        <button type="button" className="bb-btn" onClick={onExit}>
          Tillbaka
        </button>
        <div className="bb-scores">
          <div>
            <span>Nivå</span>
            <strong>{level}</strong>
          </div>
          <div>
            <span>Poäng</span>
            <strong>{score}</strong>
          </div>
          <div>
            <span>Rekord</span>
            <strong>{best}</strong>
          </div>
        </div>
        <button type="button" className="bb-btn" onClick={restart}>
          Omstart
        </button>
      </header>

      <div className="bb-level-bar" aria-label={`Nivå ${level}: ${levelProgress} av ${LEVEL_GOAL}`}>
        <div
          className="bb-level-fill"
          style={{ width: `${(levelProgress / LEVEL_GOAL) * 100}%` }}
        />
        <span>
          {levelProgress} / {LEVEL_GOAL} till nivå {level + 1}
        </span>
      </div>

      <div className="bb-board-wrap">
        <div className="bb-board" ref={boardRef}>
          {board.map((row, r) =>
            row.map((cell, c) => {
              const key = `${r}-${c}`
              const preview = previewCells?.cells.has(key)
              return (
                <button
                  type="button"
                  key={key}
                  className={`bb-cell${cell ? ' filled' : ''}${preview ? ' preview' : ''}`}
                  style={{
                    background: cell
                      ? COLORS[cell - 1]
                      : preview
                        ? `${COLORS[previewCells.color - 1]}88`
                        : undefined,
                  }}
                  disabled={isDragging || blocked || !selectedPiece}
                  onPointerEnter={() => {
                    if (!isDragging) setHover({ row: r, col: c })
                  }}
                  onPointerLeave={() => {
                    if (!isDragging) setHover(null)
                  }}
                  onClick={() => {
                    if (!isDragging) tryPlace(r, c)
                  }}
                />
              )
            }),
          )}
        </div>
      </div>

      <div className="bb-tray">
        {tray.map((piece, i) => (
          <PiecePreview
            key={piece?.id || `empty-${i}`}
            piece={piece}
            selected={selected === i}
            dragging={drag?.moved && drag?.index === i}
            onPointerDown={(e) => startDrag(i, e)}
          />
        ))}
      </div>

      {isDragging && tray[drag.index] && (
        <DragGhost piece={tray[drag.index]} x={drag.x} y={drag.y} cellSize={drag.cellSize} />
      )}

      {levelUp && (
        <div className="bb-overlay">
          <div className="bb-modal">
            <h2 className="bb-levelup">LEVEL 2</h2>
            <p>Keyboard Obby unlockad!</p>
            <p className="bb-final-score">Poäng: {score}</p>
            <button type="button" className="bb-btn primary" onClick={goNextLevel}>
              Starta Obby
            </button>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="bb-overlay">
          <div className="bb-modal">
            <h2 className="bb-gameover">GAME OVER</h2>
            <p>Inga fler block får plats</p>
            <p className="bb-final-score">
              Nivå {level} · Poäng: {score}
            </p>
            <button type="button" className="bb-btn primary" onClick={restart}>
              Spela igen
            </button>
            <button type="button" className="bb-btn" onClick={onExit}>
              Tillbaka
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
