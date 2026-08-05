// functions/api/generate.js
//
// Cloudflare Pages Function.
// Runs at /api/generate — the word bank lives here, server-side, and is
// never sent to the browser. The client only ever receives the finished
// password string.

const VW_WORDS = [
  "golf", "beetle", "polo", "passat", "jetta", "tiguan", "touareg", "atlas",
  "scirocco", "corrado", "karmann", "vanagon", "microbus", "camper", "kombi",
  "wolfsburg", "autobahn", "turbo", "diesel", "cabrio", "bora", "lupo", "fox",
  "amarok", "caddy", "transporter", "rabbit", "thing", "dasher", "vento",
  "sharan", "touran", "eos", "phaeton", "buzz", "splitscreen", "baywindow",
  "ragtop", "herbie", "hannover", "emden", "zwickau", "puebla", "gti",
  "gli", "tdi", "tsi", "dsg", "cruiser", "aircooled", "type1",
  "type2", "notchback", "fastback", "squareback", "campervan"
];

const CAR_WORDS = [
  "boot", "bonnet", "wingmirror", "indicator", "windscreen", "exhaust",
  "gearbox", "clutch", "handbrake", "dashboard", "glovebox", "numberplate",
  "alloywheel", "spoiler", "bumper", "headlight", "taillight", "wiper",
  "sunroof", "towbar", "roofrack", "sparewheel", "fusebox", "hazards",
  "dipstick", "aircon", "seatbelt", "choke", "hubcap", "dashcam",
  "footwell", "wingnut", "carpark", "layby", "roundabout", "motorway",
  "mirror", "clutchplate", "sparkplug", "radiator"
];

const ALL_WORDS = [...new Set([...VW_WORDS, ...CAR_WORDS])];
const SYMBOLS = ["!", "@", "#", "$", "%", "&", "*", "-", "+"];

// Cloudflare Workers expose the Web Crypto API — use it for better randomness
// than Math.random().
function randInt(min, max) {
  const range = max - min + 1;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return min + (buf[0] % range);
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function pickTwoDistinct(arr) {
  const a = pick(arr);
  let b = pick(arr);
  while (b === a && arr.length > 1) b = pick(arr);
  return [a, b];
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function mixCase(word) {
  const chars = word.split("");
  const hits = Math.max(1, Math.round(chars.length * 0.35));
  const indices = new Set();
  while (indices.size < hits && indices.size < chars.length) {
    indices.add(randInt(0, chars.length - 1));
  }
  indices.forEach(i => { chars[i] = chars[i].toUpperCase(); });
  return chars.join("");
}

function maybeAddSymbol(str, includeSymbols) {
  if (!includeSymbols) return str;
  const symbol = pick(SYMBOLS);
  const pos = randInt(1, str.length);
  return str.slice(0, pos) + symbol + str.slice(pos);
}

function twoDigits() {
  return String(randInt(0, 99)).padStart(2, "0");
}

function fourDigits() {
  return String(randInt(0, 9999)).padStart(4, "0");
}

function generateSimple({ includeSymbols, mixedCase }) {
  let [w1, w2] = pickTwoDistinct(ALL_WORDS);
  if (mixedCase) {
    w1 = mixCase(w1);
    w2 = mixCase(w2);
  }
  let pass = `${w1}${w2}${twoDigits()}`;
  return maybeAddSymbol(pass, includeSymbols);
}

function generateComplex({ includeSymbols, mixedCase }) {
  let [w1, w2] = pickTwoDistinct(ALL_WORDS);
  w1 = capitalize(mixedCase ? mixCase(w1) : w1);
  w2 = capitalize(mixedCase ? mixCase(w2) : w2);
  let pass = `${w1}${fourDigits()}${w2}`;
  return maybeAddSymbol(pass, includeSymbols);
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const type = url.searchParams.get("type") === "complex" ? "complex" : "simple";
  const includeSymbols = url.searchParams.get("symbols") === "1";
  const mixedCase = url.searchParams.get("mixed") === "1";

  const password = type === "complex"
    ? generateComplex({ includeSymbols, mixedCase })
    : generateSimple({ includeSymbols, mixedCase });

  return new Response(JSON.stringify({ password }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
