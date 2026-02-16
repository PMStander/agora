import { BookViewer, Chapter, Page } from '@bookmotion/core'
import { config } from '../book.config'

// Sudoku grid component
const SudokuGrid: React.FC = () => {
  const cells = Array.from({ length: 81 }, (_, i) => i)
  
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(9, 1fr)',
        border: '2px solid #333',
        width: '3in',
        height: '3in',
      }}
    >
      {cells.map((i) => {
        const row = Math.floor(i / 9)
        const col = i % 9
        const isThickRight = col === 2 || col === 5
        const isThickBottom = row === 2 || row === 5
        
        return (
          <div
            key={i}
            style={{
              borderRight: isThickRight ? '2px solid #333' : '1px solid #ccc',
              borderBottom: isThickBottom ? '2px solid #333' : '1px solid #ccc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14pt',
              fontWeight: 600,
            }}
          >
            {/* Pre-filled example numbers */}
            {[0, 4, 8, 12, 20, 24, 28, 32, 36, 44, 48, 52, 56, 60, 64, 68, 72, 76].includes(i)
              ? ((i % 9) + 1)
              : ''}
          </div>
        )
      })}
    </div>
  )
}

// Word search grid
const WordSearchGrid: React.FC<{ words: string[] }> = ({ words }) => {
  const size = 15
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gap: '2px',
          fontFamily: 'monospace',
          fontSize: '10pt',
        }}
      >
        {Array.from({ length: size * size }).map((_, i) => (
          <div
            key={i}
            style={{
              width: '0.25in',
              height: '0.25in',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #ddd',
            }}
          >
            {letters[Math.floor(Math.random() * letters.length)]}
          </div>
        ))}
      </div>
      <div style={{ marginTop: '0.25in' }}>
        <strong>Find these words:</strong>{' '}
        {words.join(', ')}
      </div>
    </div>
  )
}

// Maze (simplified placeholder)
const Maze: React.FC = () => (
  <div
    style={{
      width: '3in',
      height: '3in',
      border: '2px solid #333',
      position: 'relative',
      background: `
        repeating-linear-gradient(
          0deg,
          #fff,
          #fff 20px,
          #333 20px,
          #333 22px
        ),
        repeating-linear-gradient(
          90deg,
          #fff,
          #fff 20px,
          #333 20px,
          #333 22px
        )
      `,
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: '0.1in',
        left: '0.1in',
        background: 'white',
        padding: '0.05in',
        fontSize: '10pt',
      }}
    >
      Start →
    </span>
    <span
      style={{
        position: 'absolute',
        bottom: '0.1in',
        right: '0.1in',
        background: 'white',
        padding: '0.05in',
        fontSize: '10pt',
      }}
    >
      ← End
    </span>
  </div>
)

// Puzzle page layout
const PuzzlePage: React.FC<{
  title: string
  difficulty: string
  children: React.ReactNode
}> = ({ title, difficulty, children }) => (
  <Page layout="margins">
    <div style={{ textAlign: 'center' }}>
      <h2 style={{ fontSize: '18pt', marginBottom: '0.1in' }}>{title}</h2>
      <span
        style={{
          backgroundColor: difficulty === 'Easy' ? '#86efac' : difficulty === 'Medium' ? '#fde047' : '#fca5a5',
          padding: '0.05in 0.15in',
          borderRadius: '4px',
          fontSize: '9pt',
          fontWeight: 600,
        }}
      >
        {difficulty}
      </span>
    </div>
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: '0.5in',
      }}
    >
      {children}
    </div>
  </Page>
)

export const Root = () => (
  <BookViewer config={config} mode="slide">
    {/* Cover */}
    <Page layout="full-bleed">
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
        }}
      >
        <h1 style={{ fontSize: '36pt', marginBottom: '0.25in' }}>{config.title}</h1>
        <p style={{ fontSize: '14pt' }}>100 Puzzles to Challenge Your Mind</p>
      </div>
    </Page>

    {/* Instructions */}
    <Page layout="margins">
      <h1>How to Use This Book</h1>
      <p>This book contains a variety of puzzles:</p>
      <ul>
        <li><strong>Sudoku:</strong> Fill in numbers 1-9 in each row, column, and 3x3 box</li>
        <li><strong>Word Search:</strong> Find hidden words in the letter grid</li>
        <li><strong>Mazes:</strong> Find your way from start to finish</li>
      </ul>
      <p>Difficulty levels: Easy, Medium, Hard</p>
      <p>Answers are at the back of the book.</p>
    </Page>

    {/* Puzzles */}
    <Chapter title="Sudoku" number={1}>
      <PuzzlePage title="Sudoku #1" difficulty="Easy">
        <SudokuGrid />
      </PuzzlePage>
      <PuzzlePage title="Sudoku #2" difficulty="Medium">
        <SudokuGrid />
      </PuzzlePage>
    </Chapter>

    <Chapter title="Word Search" number={2}>
      <PuzzlePage title="Word Search #1" difficulty="Easy">
        <WordSearchGrid words={['PUZZLE', 'BOOK', 'GAME', 'FUN', 'PLAY']} />
      </PuzzlePage>
    </Chapter>

    <Chapter title="Mazes" number={3}>
      <PuzzlePage title="Maze #1" difficulty="Easy">
        <Maze />
      </PuzzlePage>
    </Chapter>

    {/* Answer key */}
    <Page layout="margins">
      <h1>Answer Key</h1>
      <p>Sudoku #1: See page XX</p>
      <p>Word Search #1: Words marked in original grid</p>
    </Page>
  </BookViewer>
)
