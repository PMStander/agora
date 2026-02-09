import type { A2UIMessage, A2UIComponent } from '../../../hooks/useA2UI';
import { registerTemplate } from '../registry';

// --- Pattern matching ---

const TEMP_PATTERN = /(-?\d+(?:\.\d+)?)\s*°\s*([CF])/i;
const TEMP_STAR_PATTERN = /\*\*(-?\d+(?:\.\d+)?)\s*°\s*([CF])\*\*/i;
const HUMIDITY_PATTERN = /humidity[:\s]*(\d+)\s*%/i;
const WIND_PATTERN = /(?:wind|breeze)[^.]{0,30}?(\d+(?:\.\d+)?)\s*(km\/h|mph|m\/s|knots?)/i;
const HIGH_LOW_PATTERN = /(?:high|max)[:\s]*(-?\d+)/i;
const LOW_PATTERN = /(?:low|min|cool)[:\s]*(?:(?:to\s+)?(?:around\s+)?)?(-?\d+)/i;
const LOCATION_PATTERN = /(?:^|\n)\s*(?:in|for|at)\s+([A-Z][a-zA-Z\s\-']+?)(?:\s*(?:right now|today|currently|:|\.|,))/i;
const LOCATION_LEADING = /^([A-Z][a-zA-Z\s\-']+?)(?:\s*(?:right now|today|currently|:))/im;

const WEATHER_KEYWORDS = [
  'sunny', 'cloudy', 'rain', 'snow', 'wind', 'humidity', 'breeze',
  'forecast', 'weather', 'overcast', 'drizzle', 'thunderstorm',
  'storm', 'hail', 'fog', 'mist', 'clear', 'partly',
  'temperature', 'celsius', 'fahrenheit', 'skies',
];

const CONDITION_MAP: Record<string, string> = {
  sunny: 'Sunny',
  clear: 'Clear',
  cloudy: 'Cloudy',
  'partly cloudy': 'Partly Cloudy',
  overcast: 'Overcast',
  rain: 'Rain',
  drizzle: 'Drizzle',
  thunderstorm: 'Thunderstorm',
  storm: 'Storm',
  snow: 'Snow',
  hail: 'Hail',
  fog: 'Fog',
  mist: 'Misty',
};

function detectCondition(text: string): string {
  const lower = text.toLowerCase();
  for (const [keyword, label] of Object.entries(CONDITION_MAP)) {
    if (lower.includes(keyword)) return label;
  }
  return 'Unknown';
}

function detectLocation(text: string): string {
  const leadMatch = text.match(LOCATION_LEADING);
  if (leadMatch) return leadMatch[1].trim();
  const match = text.match(LOCATION_PATTERN);
  if (match) return match[1].trim();
  return 'Weather';
}

registerTemplate({
  id: 'weather',
  name: 'Weather Card',

  match(text: string): number {
    const lower = text.toLowerCase();
    let score = 0;

    // Temperature is the strongest signal
    if (TEMP_PATTERN.test(text) || TEMP_STAR_PATTERN.test(text)) score += 0.4;

    // Weather keywords
    const uniqueHits = new Set<string>();
    for (const kw of WEATHER_KEYWORDS) {
      if (lower.includes(kw)) uniqueHits.add(kw);
    }
    score += Math.min(uniqueHits.size * 0.1, 0.4);

    // Location signal
    if (LOCATION_PATTERN.test(text) || LOCATION_LEADING.test(text)) score += 0.1;

    return score;
  },

  extract(text: string): Record<string, unknown> {
    const tempMatch = text.match(TEMP_STAR_PATTERN) || text.match(TEMP_PATTERN);
    const temperature = tempMatch ? parseFloat(tempMatch[1]) : null;
    const unit = tempMatch ? tempMatch[2].toUpperCase() : 'C';

    const humidityMatch = text.match(HUMIDITY_PATTERN);
    const humidity = humidityMatch ? parseInt(humidityMatch[1], 10) : null;

    const windMatch = text.match(WIND_PATTERN);
    const windSpeed = windMatch ? `${windMatch[1]} ${windMatch[2]}` : null;

    const highMatch = text.match(HIGH_LOW_PATTERN);
    const high = highMatch ? parseInt(highMatch[1], 10) : null;

    const lowMatch = text.match(LOW_PATTERN);
    const low = lowMatch ? parseInt(lowMatch[1], 10) : null;

    const condition = detectCondition(text);
    const location = detectLocation(text);

    // First meaningful sentence as description
    const sentences = text.split(/[.!]\s/);
    const description = sentences.length > 1
      ? sentences.slice(0, 2).join('. ').substring(0, 150)
      : text.substring(0, 150);

    return {
      location,
      temperature: temperature !== null ? `${temperature}°${unit}` : 'N/A',
      temperatureRaw: temperature,
      unit,
      condition,
      humidity,
      windSpeed,
      high: high !== null ? `${high}°` : null,
      low: low !== null ? `${low}°` : null,
      description: description.trim(),
    };
  },

  generate(data: Record<string, unknown>, surfaceId: string): A2UIMessage[] {
    const components: A2UIComponent[] = [
      { id: 'root', type: 'Column', children: ['main-card'] },
      { id: 'main-card', type: 'Card', props: { title: `${data.location}` }, children: ['stats-row'] },
      { id: 'stats-row', type: 'Row', children: ['temp-stat', 'condition-stat'] },
      { id: 'temp-stat', type: 'Stat', props: { value: '{{temperature}}', label: 'Temperature' } },
      { id: 'condition-stat', type: 'Stat', props: { value: '{{condition}}', label: 'Condition' } },
    ];

    const cardChildren = ['stats-row'];

    // Optional high/low row
    if (data.high || data.low) {
      components.push(
        { id: 'highlow-row', type: 'Row', children: [] as string[] },
      );
      const hlChildren: string[] = [];
      if (data.high) {
        components.push({ id: 'high-stat', type: 'Stat', props: { value: '{{high}}', label: 'High' } });
        hlChildren.push('high-stat');
      }
      if (data.low) {
        components.push({ id: 'low-stat', type: 'Stat', props: { value: '{{low}}', label: 'Low' } });
        hlChildren.push('low-stat');
      }
      const hlRow = components.find(c => c.id === 'highlow-row')!;
      hlRow.children = hlChildren;
      cardChildren.push('highlow-row');
    }

    // Optional details row (humidity, wind)
    if (data.humidity || data.windSpeed) {
      const detailChildren: string[] = [];
      if (data.humidity) {
        components.push({ id: 'humidity-badge', type: 'Badge', props: { label: `Humidity: ${data.humidity}%`, tone: 'info' } });
        detailChildren.push('humidity-badge');
      }
      if (data.windSpeed) {
        components.push({ id: 'wind-badge', type: 'Badge', props: { label: `Wind: ${data.windSpeed}`, tone: 'info' } });
        detailChildren.push('wind-badge');
      }
      components.push({ id: 'detail-row', type: 'Row', children: detailChildren });
      cardChildren.push('detail-row');
    }

    // Description
    components.push({ id: 'desc', type: 'Text', props: { text: '{{description}}' } });
    cardChildren.push('desc');

    // Update the card's children
    const mainCard = components.find(c => c.id === 'main-card')!;
    mainCard.children = cardChildren;

    return [
      { type: 'dataModelUpdate', surfaceId, data },
      { type: 'surfaceUpdate', surfaceId, components },
      { type: 'beginRendering', surfaceId, rootId: 'root', catalog: 'auto-weather' },
    ];
  },
});
