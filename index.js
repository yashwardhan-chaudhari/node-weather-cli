#!/usr/bin/env node

// Simple weather CLI using Open-Meteo geocoding + forecast (no API key)
// Requires Node.js >= 18 (global fetch available)

const { argv, exit, version } = process;

function usage() {
  console.log(`Usage: weather [options] <city name>

Options:
  -u, --unit <c|f>   Temperature unit: c (Celsius, default) or f (Fahrenheit)
  -h, --help         Show this help

Examples:
  weather London
  weather -u f "New York"
`);
}

function parseArgs() {
  const args = argv.slice(2);
  let unit = 'c';
  let cityParts = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-h' || a === '--help') {
      usage();
      exit(0);
    }
    if (a === '-u' || a === '--unit') {
      const val = args[i + 1];
      if (!val) { console.error('Missing unit after -u'); usage(); exit(1); }
      unit = val.toLowerCase();
      i++;
      continue;
    }
    if (a.startsWith('--unit=')) {
      unit = a.split('=')[1].toLowerCase();
      continue;
    }
    cityParts.push(a);
  }
  if (cityParts.length === 0) { usage(); exit(1); }
  const city = cityParts.join(' ');
  return { city, unit };
}

async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding request failed: ${res.status}`);
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  return data.results[0];
}

async function getWeather(lat, lon, unit) {
  const tempUnit = unit === 'f' ? 'fahrenheit' : 'celsius';
  const windUnit = 'kmh';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=${tempUnit}&windspeed_unit=${windUnit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  return res.json();
}

async function main() {
  // quick node version sanity check
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) {
    console.error('Node.js >=18 is required (for global fetch). Current:', process.version);
    exit(1);
  }

  const { city, unit } = parseArgs();

  try {
    const place = await geocode(city);
    if (!place) {
      console.error(`City not found: ${city}`);
      exit(2);
    }

    const { latitude, longitude, name, country } = place;
    const weatherData = await getWeather(latitude, longitude, unit);
    if (!weatherData.current_weather) {
      console.error('No current weather available for:', name);
      exit(3);
    }

    const cw = weatherData.current_weather;
    const tempUnitSymbol = unit === 'f' ? '°F' : '°C';

    console.log(`\nWeather for ${name}${country ? ', ' + country : ''} (${latitude.toFixed(3)}, ${longitude.toFixed(3)})\n`);
    console.log(`Temperature: ${cw.temperature}${tempUnitSymbol}`);
    console.log(`Wind speed: ${cw.windspeed} km/h`);
    console.log(`Wind direction: ${cw.winddirection}°`);
    console.log(`Weather code: ${cw.weathercode}  (see https://open-meteo.com/en/docs for codes)`);
    console.log(`Observation time: ${cw.time}\n`);
  } catch (err) {
    console.error('Error:', err.message);
    exit(1);
  }
}

main();
