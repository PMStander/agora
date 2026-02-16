import { BookViewer, Chapter, Page, usePageConfig } from '@bookmotion/core'
import { config } from '../book.config'

// Running header component
const RunningHeader: React.FC = () => {
  const { isLeftPage, chapter } = usePageConfig()
  
  return (
    <div
      style={{
        fontFamily: 'Merriweather, serif',
        fontSize: '9pt',
        fontStyle: 'italic',
        textAlign: 'center',
        borderBottom: '0.5pt solid #ccc',
        paddingBottom: '0.125in',
        color: '#666',
      }}
    >
      {isLeftPage ? chapter?.title : config.title}
    </div>
  )
}

// Page number component
const PageNumber: React.FC = () => {
  const { pageNumber, isFirstPage } = usePageConfig()
  
  if (isFirstPage) return null
  
  return (
    <div
      style={{
        fontFamily: 'Merriweather, serif',
        fontSize: '9pt',
        textAlign: 'center',
        color: '#666',
      }}
    >
      {pageNumber}
    </div>
  )
}

// Chapter opening page
const ChapterOpening: React.FC<{ epigraph?: { quote: string; author: string } }> = ({
  epigraph,
}) => {
  const { chapter } = usePageConfig()
  
  return (
    <Page layout="margins" footer={<PageNumber />}>
      <div style={{ marginTop: '3in' }}>
        {chapter?.number && (
          <h1
            style={{
              fontFamily: 'Merriweather, serif',
              fontSize: '24pt',
              fontWeight: 300,
              textAlign: 'center',
              marginBottom: '0.5in',
              color: '#333',
            }}
          >
            Chapter {chapter.number}
          </h1>
        )}
        
        <h2
          style={{
            fontFamily: 'Merriweather, serif',
            fontSize: '18pt',
            fontWeight: 400,
            fontStyle: 'italic',
            textAlign: 'center',
            color: '#555',
          }}
        >
          {chapter?.title}
        </h2>
        
        {epigraph && (
          <div
            style={{
              marginTop: '2in',
              textAlign: 'right',
              fontStyle: 'italic',
              color: '#666',
            }}
          >
            <p>{epigraph.quote}</p>
            <p style={{ marginTop: '0.25in' }}>— {epigraph.author}</p>
          </div>
        )}
      </div>
    </Page>
  )
}

// Body text page
const BodyText: React.FC<{ paragraphs: string[] }> = ({ paragraphs }) => {
  return (
    <Page layout="margins" header={<RunningHeader />} footer={<PageNumber />}>
      <div style={{ textAlign: 'justify' }}>
        {paragraphs.map((text, i) => (
          <p
            key={i}
            style={{
              fontFamily: 'Merriweather, serif',
              fontSize: '11pt',
              lineHeight: 1.5,
              textIndent: i === 0 ? 0 : '1em',
              marginBottom: 0,
              marginTop: i === 0 ? 0 : '0.5em',
            }}
          >
            {text}
          </p>
        ))}
      </div>
    </Page>
  )
}

// Title page
const TitlePage: React.FC = () => (
  <Page layout="margins">
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'Merriweather, serif',
          fontSize: '28pt',
          fontWeight: 300,
          marginBottom: '0.5in',
        }}
      >
        {config.title}
      </h1>
      <p style={{ fontSize: '14pt', fontStyle: 'italic' }}>by</p>
      <p style={{ fontSize: '16pt', marginTop: '0.25in' }}>{config.author}</p>
    </div>
  </Page>
)

export const Root = () => (
  <BookViewer config={config} mode="slide">
    {/* Front matter */}
    <TitlePage />
    
    <Page layout="margins">
      <div style={{ marginTop: '2in' }}>
        <h2>Contents</h2>
        <p>Chapter 1: The Beginning .................... 1</p>
        <p>Chapter 2: The Journey ..................... 15</p>
      </div>
    </Page>

    {/* Chapter 1 */}
    <Chapter title="The Beginning" number={1}>
      <ChapterOpening
        epigraph={{
          quote: "Every great story begins with a single step into the unknown.",
          author: "Anonymous",
        }}
      />
      <BodyText
        paragraphs={[
          "It was the kind of morning that made you believe anything was possible. The sun rose slowly over the horizon, painting the sky in shades of pink and gold that seemed almost too perfect to be real.",
          "Sarah stood at her window, watching the world wake up. She had made her decision the night before, in that strange hour between midnight and dawn when the mind is both most tired and most clear.",
          "Today was the day she would leave. Not because she had to, but because she needed to understand what lay beyond the familiar streets of her childhood.",
        ]}
      />
    </Chapter>

    {/* Chapter 2 */}
    <Chapter title="The Journey" number={2}>
      <ChapterOpening />
      <BodyText
        paragraphs={[
          "The road stretched before her like a ribbon of possibility. Each mile marker was a small victory, a tangible measure of the distance she was putting between herself and everything she had known.",
          "She stopped at a diner just past noon, the kind of place that existed in every small town across America. The coffee was hot and bitter, exactly what she needed to stay awake.",
          "A truck driver at the counter noticed her bag and asked where she was headed. 'Forward,' she replied, and he laughed in a way that suggested he understood.",
        ]}
      />
    </Chapter>
  </BookViewer>
)
