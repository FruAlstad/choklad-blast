import { useCallback, useEffect, useMemo, useState } from 'react'

const SIZE = 8
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

function PiecePreview({ piece, selected, onSelect }) {
  if (!piece) {
    return <div className="bb-slot empty" />
  }
  const rows = piece.shape.length
  const cols = Math.max(...piece.shape.map((r) => r.length))
  return (
    <button
      type="button"
      className={`bb-slot${selected ? ' selected' : ''}`}
      onClick={onSelect}
    >
      <div
        className="bb-piece"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
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

export default function BlockBlast({ onExit }) {
  const [board, setBoard] = useState(emptyBoard)
  const [tray, setTray] = useState(randomTray)
  const [selected, setSelected] = useState(0)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => Number(localStorage.getItem('choklad-blast-best') || 0))
  const [hover, setHover] = useState(null)
  const [gameOver, setGameOver] = useState(false)

  const selectedPiece = tray[selected]

  const previewCells = useMemo(() => {
    if (!hover || !selectedPiece) return null
    if (!canPlace(board, selectedPiece.shape, hover.row, hover.col)) return null
    const cells = new Set()
    selectedPiece.shape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) cells.add(`${hover.row + r}-${hover.col + c}`)
      })
    })
    return { cells, color: selectedPiece.color }
  }, [board, hover, selectedPiece])

  const restart = useCallback(() => {
    setBoard(emptyBoard())
    setTray(randomTray())
    setSelected(0)
    setScore(0)
    setHover(null)
    setGameOver(false)
  }, [])

  const tryPlace = useCallback(
    (row, col) => {
      if (gameOver || !selectedPiece) return
      if (!canPlace(board, selectedPiece.shape, row, col)) return

      let nextBoard = placeOnBoard(board, selectedPiece.shape, row, col, selectedPiece.color)
      const blockScore = selectedPiece.shape.flat().filter(Boolean).length
      const { board: clearedBoard, cleared } = clearLines(nextBoard)
      nextBoard = clearedBoard

      let nextTray = tray.map((p, i) => (i === selected ? null : p))
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

      if (!anyFit(nextBoard, nextTray)) setGameOver(true)
    },
    [best, board, gameOver, score, selected, selectedPiece, tray],
  )

  useEffect(() => {
    if (gameOver) return
    if (!anyFit(board, tray)) setGameOver(true)
  }, [board, tray, gameOver])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onExit()
      if (e.key === '1') setSelected(0)
      if (e.key === '2') setSelected(1)
      if (e.key === '3') setSelected(2)
      if (e.key === 'r' || e.key === 'R') restart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, restart])

  return (
    <div className="bb-screen">
      <h1 className="bb-title">Choklad Blast</h1>
      <header className="bb-top">
        <button type="button" className="bb-btn" onClick={onExit}>
          Tillbaka
        </button>
        <div className="bb-scores">
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

      <div className="bb-board-wrap">
        <div className="bb-board">
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
                  onMouseEnter={() => setHover({ row: r, col: c })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => tryPlace(r, c)}
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
            onSelect={() => piece && setSelected(i)}
          />
        ))}
      </div>

      {gameOver && (
        <div className="bb-overlay">
          <div className="bb-modal">
            <h2 className="bb-gameover">GAME OVER</h2>
            <p>Inga fler block får plats</p>
            <p className="bb-final-score">Poäng: {score}</p>
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
