// Hand-curated: which Lightroom collections make up which voyage, and where each voyage is.
// Rerun `npm run catalog` after editing. Collections not listed here are reported, not imported.
//
// kind   "trip"  somewhere you went
//        "home"  ongoing life in New York: one open-ended voyage, no date-cluster rules
//        "event" a recurring event (Westminster, NYCC). Shown on the home list and Years, kept off the Places map
// approx true = the CSV does not say where in the region; the coordinate is a stand-in (flagged in the report)
// series  events only: the recurring event this edition belongs to (see SERIES), which gets its own page under /events
// from/to optional date window (YYYY-MM-DD) when the same collections hold two separate trips
// theme  "city" | "nature": only picks which preview photos stand in until real uploads exist
// slug   the site collection page this voyage links to, if one exists (lowercase; the page need not exist yet)

const NYC = { placeSlug: "new-york", placeName: "New York", country: "United States", tz: "America/New_York" };

export const VOYAGES = [
  // ---- events ---------------------------------------------------------------------------
  { id: "westminster-2020", title: "Westminster 2020", kind: "event", series: "westminster", slug: "westminster", ...NYC, place: "Piers 92/94, New York", lat: 40.7686, lon: -73.9985, theme: "city", collections: ["Westminster Agility 2020", "Westminster Selects"] },
  { id: "westminster-2021", title: "Westminster 2021", kind: "event", series: "westminster", slug: "westminster", placeSlug: "tarrytown", placeName: "Tarrytown", country: "United States", tz: "America/New_York", place: "Lyndhurst, Tarrytown, New York", lat: 41.0707, lon: -73.8637, theme: "city", collections: ["Westminster 2021", "W2021 Finals", "Lyndhurst Mansion"] },
  { id: "nycc-2021", title: "NYCC 2021", kind: "event", series: "nycc", slug: "nycc", ...NYC, place: "Javits Center, New York", lat: 40.7577, lon: -74.0021, theme: "city", collections: ["NYCC 2021 Thurs Finals", "NYCC Fri Finals", "NYCC 2021 Sat Finals", "NYCC David Panel", "NYCC The Boys"] },
  { id: "nycc-2022", title: "NYCC 2022", kind: "event", series: "nycc", slug: "nycc", ...NYC, place: "Javits Center, New York", lat: 40.7577, lon: -74.0021, theme: "city", collections: ["NYCC 2022", "NYCC 2022 - Cosplay", "NYCC 2022 SAT", "Teen Wolf"] }, // Teen Wolf is a panel at NYCC 2022

  // ---- home -----------------------------------------------------------------------------
  { id: "new-york", title: "New York", kind: "home", slug: "new-york", ...NYC, place: "New York City", lat: 40.7306, lon: -73.9866, theme: "city", open: true, collections: ["NYC", "New York", "Manhattan", "Brooklyn", "Queens", "COVIDNYC", "NYC XMAS"] },

  // ---- trips ----------------------------------------------------------------------------
  { id: "japan", title: "Japan", kind: "trip", placeSlug: "japan", placeName: "Japan", country: "Japan", tz: "Asia/Tokyo", place: "Tokyo, Japan", lat: 35.68, lon: 139.69, approx: true, theme: "city", collections: ["Japan", "Japan Finals"] },
  { id: "seoul", title: "Seoul", kind: "trip", placeSlug: "seoul", placeName: "Seoul", country: "South Korea", tz: "Asia/Seoul", place: "Seoul, South Korea", lat: 37.57, lon: 126.98, theme: "city", collections: ["Seoul"] },
  { id: "london", title: "London", kind: "trip", placeSlug: "london", placeName: "London", country: "United Kingdom", tz: "Europe/London", place: "London, England", lat: 51.51, lon: -0.13, theme: "city", collections: ["London"] },
  { id: "amsterdam", title: "Amsterdam", kind: "trip", placeSlug: "amsterdam", placeName: "Amsterdam", country: "Netherlands", tz: "Europe/Amsterdam", place: "Amsterdam, Netherlands", lat: 52.37, lon: 4.9, theme: "city", collections: ["Amsterdam"] },
  { id: "iceland", title: "Iceland", kind: "trip", slug: "iceland", placeSlug: "iceland", placeName: "Iceland", country: "Iceland", tz: "Atlantic/Reykjavik", place: "Iceland", lat: 64.15, lon: -21.94, approx: true, theme: "nature", collections: ["Iceland", "Iceland Finals", "iceland finals 2"] },
  { id: "barbados", title: "Barbados", kind: "trip", placeSlug: "barbados", placeName: "Barbados", country: "Barbados", tz: "America/Barbados", place: "Barbados", lat: 13.1, lon: -59.61, theme: "nature", collections: ["Barbadoes"] },
  { id: "rio", title: "Rio", kind: "trip", placeSlug: "rio", placeName: "Rio de Janeiro", country: "Brazil", tz: "America/Sao_Paulo", place: "Rio de Janeiro, Brazil", lat: -22.91, lon: -43.17, theme: "city", collections: ["Rio"] },
  { id: "sao-paulo", title: "São Paulo", kind: "trip", placeSlug: "sao-paulo", placeName: "São Paulo", country: "Brazil", tz: "America/Sao_Paulo", place: "São Paulo, Brazil", lat: -23.55, lon: -46.63, theme: "city", collections: ["Sao Paulo"] },
  { id: "mexico-city", title: "Mexico City", kind: "trip", placeSlug: "mexico-city", placeName: "Mexico City", country: "Mexico", tz: "America/Mexico_City", place: "Mexico City", lat: 19.43, lon: -99.13, theme: "city", collections: ["Mexico City"] },
  { id: "costa-rica", title: "Costa Rica", kind: "trip", placeSlug: "costa-rica", placeName: "Costa Rica", country: "Costa Rica", tz: "America/Costa_Rica", place: "Costa Rica", lat: 9.93, lon: -84.08, approx: true, theme: "nature", collections: ["Costa Rica"] },
  { id: "medellin", title: "Medellín", kind: "trip", placeSlug: "medellin", placeName: "Medellín", country: "Colombia", tz: "America/Bogota", place: "Medellín, Colombia", lat: 6.24, lon: -75.58, theme: "city", collections: ["Medellin", "Medellin Finals"] },
  { id: "cartagena", title: "Cartagena", kind: "trip", placeSlug: "cartagena", placeName: "Cartagena", country: "Colombia", tz: "America/Bogota", place: "Cartagena, Colombia", lat: 10.39, lon: -75.48, theme: "city", collections: ["Cartagena", "Cartagena Finals", "Cartagena Picks", "Playa Blanca Finals"] },
  { id: "eureka", title: "Eureka", kind: "trip", placeSlug: "eureka", placeName: "Eureka", country: "United States", tz: "America/Los_Angeles", place: "Eureka, California", lat: 40.8, lon: -124.16, theme: "nature", collections: ["Eureka", "Eureka Finals"] },
  { id: "san-francisco", title: "San Francisco", kind: "trip", placeSlug: "san-francisco", placeName: "San Francisco", country: "United States", tz: "America/Los_Angeles", place: "San Francisco, California", lat: 37.77, lon: -122.42, theme: "city", collections: ["San Fran"] },
  { id: "texas", title: "Texas", kind: "trip", placeSlug: "texas", placeName: "Texas", country: "United States", tz: "America/Chicago", place: "Texas", lat: 30.27, lon: -97.74, approx: true, theme: "nature", collections: ["Texas 2021", "Texas Finals"] },
  { id: "colorado", title: "Colorado", kind: "trip", placeSlug: "colorado", placeName: "Colorado", country: "United States", tz: "America/Denver", place: "Colorado", lat: 39.74, lon: -104.99, approx: true, theme: "nature", collections: ["Colorado 2021"] },
  { id: "arizona", title: "Arizona", kind: "trip", slug: "arizona", placeSlug: "arizona", placeName: "Arizona", country: "United States", tz: "America/Phoenix", place: "Sedona, Arizona", lat: 34.87, lon: -111.76, theme: "nature", collections: ["Sedona", "Grand Canyon", "Tuscon", "Phoenix"] },
  { id: "new-mexico", title: "New Mexico", kind: "trip", placeSlug: "new-mexico", placeName: "New Mexico", country: "United States", tz: "America/Denver", place: "New Mexico", lat: 35.69, lon: -105.94, approx: true, theme: "nature", collections: ["New Mexico"] },
  { id: "wyoming-2020", title: "Wyoming 2020", kind: "trip", slug: "grand-tetons", placeSlug: "wyoming", placeName: "Wyoming", country: "United States", tz: "America/Denver", place: "Grand Teton and Yellowstone, Wyoming", lat: 43.79, lon: -110.68, theme: "nature", from: "2020-01-01", to: "2020-12-31", collections: ["Grand Teton", "Yellowstone", "SLC"] },
  { id: "wyoming-2022", title: "Wyoming 2022", kind: "trip", slug: "grand-tetons", placeSlug: "wyoming", placeName: "Wyoming", country: "United States", tz: "America/Denver", place: "Grand Teton and Yellowstone, Wyoming", lat: 43.79, lon: -110.68, theme: "nature", from: "2022-01-01", to: "2022-12-31", collections: ["Grand Teton", "Yellowstone", "SLC"] },
  { id: "lisbon", title: "Lisbon", kind: "trip", placeSlug: "lisbon", placeName: "Lisbon", country: "Portugal", tz: "Europe/Lisbon", place: "Lisbon, Portugal", lat: 38.72, lon: -9.14, theme: "city", collections: ["Lisbon"] },
  { id: "madeira", title: "Madeira", kind: "trip", placeSlug: "madeira", placeName: "Madeira", country: "Portugal", tz: "Atlantic/Madeira", place: "Madeira, Portugal", lat: 32.65, lon: -16.91, theme: "nature", collections: ["Madeira"] },
  { id: "norway", title: "Norway", kind: "trip", placeSlug: "norway", placeName: "Norway", country: "Norway", tz: "Europe/Oslo", place: "Norway", lat: 59.91, lon: 10.75, approx: true, theme: "nature", collections: ["Norway"] },
  { id: "stockholm", title: "Stockholm", kind: "trip", placeSlug: "stockholm", placeName: "Stockholm", country: "Sweden", tz: "Europe/Stockholm", place: "Stockholm, Sweden", lat: 59.33, lon: 18.07, theme: "city", collections: ["Stockholm"] },
  { id: "brighton", title: "Brighton", kind: "trip", placeSlug: "brighton", placeName: "Brighton", country: "United Kingdom", tz: "Europe/London", place: "Brighton, England", lat: 50.82, lon: -0.14, theme: "city", collections: ["Brighton"] },
  { id: "ecuador", title: "Ecuador", kind: "trip", placeSlug: "ecuador", placeName: "Ecuador", country: "Ecuador", tz: "America/Guayaquil", place: "Ecuador", lat: -0.18, lon: -78.47, approx: true, theme: "nature", collections: ["Ecuador"] },
  { id: "bogota", title: "Bogotá", kind: "trip", placeSlug: "bogota", placeName: "Bogotá", country: "Colombia", tz: "America/Bogota", place: "Bogotá, Colombia", lat: 4.71, lon: -74.07, theme: "city", collections: ["Bogota"] },
  { id: "oaxaca", title: "Oaxaca", kind: "trip", placeSlug: "oaxaca", placeName: "Oaxaca", country: "Mexico", tz: "America/Mexico_City", place: "Oaxaca, Mexico", lat: 17.07, lon: -96.73, theme: "city", collections: ["Oaxaca", "Oaxaca Web Selects"] },
  { id: "new-jersey", title: "New Jersey", kind: "trip", placeSlug: "new-jersey", placeName: "New Jersey", country: "United States", tz: "America/New_York", place: "New Jersey", lat: 40.72, lon: -74.17, approx: true, theme: "city", collections: ["Chiyuki House 2025 New Jersey", "New Jersey"] },
  { id: "pennsylvania", title: "Pennsylvania", kind: "trip", placeSlug: "pennsylvania", placeName: "Pennsylvania", country: "United States", tz: "America/New_York", place: "Sesame Place, Pennsylvania", lat: 40.18, lon: -74.92, approx: true, theme: "city", collections: ["Fist Time Sesame Place 2025"] },
];

// Recurring events: one page per series, one gallery group per edition.
export const SERIES = {
  westminster: { name: "Westminster", about: "The Westminster Kennel Club dog show, New York" },
  nycc: { name: "NYCC", about: "New York Comic Con, Javits Center" },
};

export const PALETTE = ["#d9a05b", "#5fa8d3", "#d9776a", "#7fbf7b", "#a98be0", "#d6c35a", "#4fbfae", "#d98bb0"];
