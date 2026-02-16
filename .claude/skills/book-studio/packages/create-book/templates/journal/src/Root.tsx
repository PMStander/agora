import { BookViewer, Page } from '@bookmotion/core'
import { config } from '../book.config'

// Daily journal page component
const DailyPage: React.FC<{ date: string; prompts: string[] }> = ({
  date,
  prompts,
}) => (
  <Page layout="margins">
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Date header */}
      <div
        style={{
          borderBottom: '2px solid #333',
          paddingBottom: '0.15in',
          marginBottom: '0.25in',
        }}
      >
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14pt', margin: 0 }}>
          {date}
        </h2>
      </div>

      {/* Prompt sections */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25in' }}>
        {prompts.map((prompt, i) => (
          <div
            key={i}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '0.15in',
              flex: 1,
            }}
          >
            <h3
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '10pt',
                fontWeight: 600,
                color: '#666',
                margin: '0 0 0.1in 0',
                textTransform: 'uppercase',
              }}
            >
              {prompt}
            </h3>
            {/* Lines for writing */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2in' }}>
              {Array.from({ length: 8 }).map((_, j) => (
                <div
                  key={j}
                  style={{
                    borderBottom: '1px dotted #ccc',
                    height: '0.25in',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </Page>
)

// Monthly calendar page
const CalendarPage: React.FC<{ month: string }> = ({ month }) => (
  <Page layout="margins">
    <div>
      <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '18pt', marginBottom: '0.25in' }}>
        {month}
      </h1>
      {/* Simple calendar grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.05in',
        }}
      >
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
          <div
            key={day}
            style={{
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '9pt',
              padding: '0.05in',
            }}
          >
            {day}
          </div>
        ))}
        {Array.from({ length: 31 }).map((_, i) => (
          <div
            key={i}
            style={{
              border: '1px solid #ddd',
              padding: '0.05in',
              minHeight: '0.4in',
              fontSize: '9pt',
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>
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
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}
      >
        <h1 style={{ fontSize: '24pt', marginBottom: '0.25in' }}>{config.title}</h1>
        <p style={{ fontSize: '12pt' }}>{config.author}</p>
      </div>
    </Page>

    {/* Intro */}
    <Page layout="margins">
      <div style={{ textAlign: 'center', marginTop: '2in' }}>
        <p style={{ fontStyle: 'italic' }}>
          This journal belongs to:
        </p>
        <div
          style={{
            borderBottom: '1px solid #333',
            width: '60%',
            margin: '0.5in auto 0',
            height: '0.3in',
          }}
        />
      </div>
    </Page>

    {/* Monthly overview */}
    <CalendarPage month="January 2025" />

    {/* Daily pages */}
    <DailyPage
      date="Monday, January 6, 2025"
      prompts={['Gratitude', 'Focus for Today', 'Evening Reflection']}
    />
    <DailyPage
      date="Tuesday, January 7, 2025"
      prompts={['Gratitude', 'Focus for Today', 'Evening Reflection']}
    />
    <DailyPage
      date="Wednesday, January 8, 2025"
      prompts={['Gratitude', 'Focus for Today', 'Evening Reflection']}
    />
  </BookViewer>
)
