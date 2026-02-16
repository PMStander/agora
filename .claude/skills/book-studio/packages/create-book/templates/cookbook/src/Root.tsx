import { BookViewer, Chapter, Page, staticFile } from '@bookmotion/core'
import { config } from '../book.config'

// Recipe card component
interface RecipeCardProps {
  title: string
  description?: string
  prepTime: number
  cookTime: number
  servings: number
  ingredients: string[]
  steps: string[]
  tips?: string[]
  image?: string
  tags?: string[]
}

const RecipeCard: React.FC<RecipeCardProps> = ({
  title,
  description,
  prepTime,
  cookTime,
  servings,
  ingredients,
  steps,
  tips,
  image,
  tags,
}) => (
  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    {/* Header */}
    <div style={{ marginBottom: '0.25in' }}>
      <h2
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontSize: '24pt',
          fontWeight: 700,
          color: '#333',
          margin: '0 0 0.125in 0',
        }}
      >
        {title}
      </h2>
      
      {tags && (
        <div style={{ display: 'flex', gap: '0.125in', marginBottom: '0.125in' }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                backgroundColor: '#f0f0f0',
                padding: '0.05in 0.1in',
                borderRadius: '4px',
                fontSize: '8pt',
                color: '#666',
                textTransform: 'uppercase',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      
      {description && (
        <p
          style={{
            fontFamily: 'Merriweather, serif',
            fontSize: '10pt',
            fontStyle: 'italic',
            color: '#666',
            margin: 0,
          }}
        >
          {description}
        </p>
      )}
    </div>

    {/* Meta info */}
    <div
      style={{
        display: 'flex',
        gap: '0.25in',
        padding: '0.15in 0',
        borderTop: '1px solid #ddd',
        borderBottom: '1px solid #ddd',
        marginBottom: '0.25in',
        fontSize: '9pt',
        color: '#666',
      }}
    >
      <span>⏱️ Prep: {prepTime} min</span>
      <span>🔥 Cook: {cookTime} min</span>
      <span>🍽️ Serves: {servings}</span>
    </div>

    {/* Main content */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: image ? '1fr 1fr' : '0.4fr 0.6fr',
        gap: '0.25in',
        flex: 1,
      }}
    >
      {/* Ingredients */}
      <div>
        <h3
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '12pt',
            fontWeight: 600,
            margin: '0 0 0.125in 0',
            color: '#333',
          }}
        >
          Ingredients
        </h3>
        <ul
          style={{
            margin: 0,
            paddingLeft: '0.2in',
            fontSize: '10pt',
            lineHeight: 1.8,
          }}
        >
          {ingredients.map((ingredient, i) => (
            <li key={i}>{ingredient}</li>
          ))}
        </ul>
      </div>

      {/* Right side - image or steps */}
      <div>
        {image ? (
          <img
            src={staticFile(image)}
            alt={title}
            style={{
              width: '100%',
              height: '2.5in',
              objectFit: 'cover',
              borderRadius: '8px',
              marginBottom: '0.25in',
            }}
          />
        ) : null}

        <h3
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '12pt',
            fontWeight: 600,
            margin: '0 0 0.125in 0',
            color: '#333',
          }}
        >
          Instructions
        </h3>
        <ol
          style={{
            margin: 0,
            paddingLeft: '0.2in',
            fontSize: '10pt',
            lineHeight: 1.8,
          }}
        >
          {steps.map((step, i) => (
            <li key={i} style={{ marginBottom: '0.1in' }}>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>

    {/* Tips */}
    {tips && (
      <div
        style={{
          marginTop: '0.25in',
          padding: '0.15in',
          backgroundColor: '#fffbeb',
          borderLeft: '3px solid #f59e0b',
          borderRadius: '0 4px 4px 0',
        }}
      >
        <strong style={{ fontSize: '9pt', color: '#92400e' }}>Chef's Tips:</strong>
        <ul style={{ margin: '0.1in 0 0 0', paddingLeft: '0.2in', fontSize: '9pt' }}>
          {tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
)

// Cover page
const CoverPage: React.FC = () => (
  <Page layout="full-bleed">
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #f5f5f5 0%, #e8d5b7 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontSize: '36pt',
          fontWeight: 700,
          color: '#5c4a3d',
          marginBottom: '0.5in',
        }}
      >
        {config.title}
      </h1>
      <p
        style={{
          fontFamily: 'Merriweather, serif',
          fontSize: '16pt',
          fontStyle: 'italic',
          color: '#7d6b5d',
        }}
      >
        A collection of beloved family recipes
      </p>
      <p
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontSize: '12pt',
          color: '#5c4a3d',
          marginTop: '1in',
        }}
      >
        by {config.author}
      </p>
    </div>
  </Page>
)

export const Root = () => (
  <BookViewer config={config} mode="slide">
    {/* Front matter */}
    <CoverPage />
    
    <Page layout="margins">
      <div style={{ textAlign: 'center', marginTop: '2in' }}>
        <h1>{config.title}</h1>
        <p style={{ fontStyle: 'italic' }}>
          A collection of recipes passed down through generations
        </p>
        <p style={{ marginTop: '2in' }}>
          © 2025 {config.author}
        </p>
      </div>
    </Page>

    {/* Breakfast chapter */}
    <Chapter title="Breakfast" number={1}>
      <Page layout="margins">
        <RecipeCard
          title="Fluffy Pancakes"
          description="Light and airy pancakes perfect for weekend mornings"
          prepTime={15}
          cookTime={10}
          servings={4}
          ingredients={[
            '2 cups all-purpose flour',
            '2 tablespoons sugar',
            '2 teaspoons baking powder',
            '1/2 teaspoon salt',
            '2 eggs',
            '1 3/4 cups milk',
            '1/4 cup melted butter',
            '1 teaspoon vanilla extract',
          ]}
          steps={[
            'Whisk together dry ingredients in a large bowl.',
            'In another bowl, beat eggs and mix in milk, butter, and vanilla.',
            'Pour wet ingredients into dry ingredients and stir until just combined.',
            'Heat a griddle over medium heat. Pour 1/4 cup batter per pancake.',
            'Cook until bubbles form on surface, then flip and cook until golden.',
          ]}
          tips={[
            'Don\'t overmix the batter - lumps are okay!',
            'Keep pancakes warm in a 200°F oven while cooking batches.',
          ]}
          tags={['breakfast', 'sweet']}
        />
      </Page>
    </Chapter>

    {/* Main dishes */}
    <Chapter title="Main Dishes" number={2}>
      <Page layout="margins">
        <RecipeCard
          title="Classic Spaghetti Carbonara"
          description="Authentic Italian pasta with eggs, cheese, and pancetta"
          prepTime={10}
          cookTime={20}
          servings={4}
          ingredients={[
            '400g spaghetti',
            '200g pancetta or guanciale, diced',
            '4 large egg yolks',
            '100g Pecorino Romano, grated',
            '50g Parmesan, grated',
            'Freshly ground black pepper',
            'Salt for pasta water',
          ]}
          steps={[
            'Bring a large pot of salted water to boil and cook pasta until al dente.',
            'While pasta cooks, sauté pancetta in a large pan until crispy.',
            'Mix egg yolks with grated cheeses and plenty of black pepper.',
            'Reserve 1 cup pasta water, then drain pasta.',
            'Working quickly, add hot pasta to the pancetta pan.',
            'Remove from heat and add egg mixture, tossing constantly.',
            'Add pasta water as needed to create a creamy sauce.',
          ]}
          tips={[
            'The residual heat from pasta cooks the eggs - work quickly!',
            'Never add salt to the egg mixture - the cheese is salty enough.',
            'Use guanciale for the most authentic flavor.',
          ]}
          tags={['italian', 'dinner', 'quick']}
        />
      </Page>
    </Chapter>

    {/* Desserts */}
    <Chapter title="Desserts" number={3}>
      <Page layout="margins">
        <RecipeCard
          title="Chocolate Chip Cookies"
          description="Classic chewy cookies with crispy edges"
          prepTime={15}
          cookTime={12}
          servings={24}
          ingredients={[
            '2 1/4 cups all-purpose flour',
            '1 teaspoon baking soda',
            '1 teaspoon salt',
            '1 cup butter, softened',
            '3/4 cup granulated sugar',
            '3/4 cup brown sugar',
            '2 eggs',
            '2 teaspoons vanilla extract',
            '2 cups chocolate chips',
          ]}
          steps={[
            'Preheat oven to 375°F (190°C).',
            'Mix flour, baking soda, and salt.',
            'Beat butter and sugars until creamy.',
            'Add eggs and vanilla, beat well.',
            'Gradually blend in flour mixture.',
            'Stir in chocolate chips.',
            'Drop by rounded tablespoon onto ungreased baking sheets.',
            'Bake 9 to 11 minutes until golden brown.',
          ]}
          tips={[
            'Chill dough for 30 minutes for thicker cookies.',
            'Use a mix of chocolate chip types for variety.',
          ]}
          tags={['dessert', 'baking', 'sweet']}
        />
      </Page>
    </Chapter>
  </BookViewer>
)
