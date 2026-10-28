// GeoNames cities (population >= 15,000) -> worker/src/cities.json: the offline "nearest city" lookup the Worker
// uses to turn GPS (or an IPTC city name) into a city-level place. Rerun rarely.
//   node worker/scripts/build-cities.mjs
// Data: GeoNames, https://www.geonames.org, CC BY 4.0 (credit it wherever the place names are shown).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "../src/cities.json");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "geonames-"));
const get = (f) => execFileSync("curl", ["-sSfL", "--max-time", "120", "-o", path.join(tmp, f), `https://download.geonames.org/export/dump/${f}`]);
get("cities15000.zip");
get("admin1CodesASCII.txt");
get("countryInfo.txt");
execFileSync("unzip", ["-oq", path.join(tmp, "cities15000.zip"), "-d", tmp]);

const lines = (f) => fs.readFileSync(path.join(tmp, f), "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
const countries = {};
for (const l of lines("countryInfo.txt")) {
  const c = l.split("\t");
  countries[c[0]] = [c[4], c[1]]; // ISO2 -> [name, ISO3]
}
const admin1 = {};
for (const l of lines("admin1CodesASCII.txt")) {
  const c = l.split("\t");
  admin1[c[0]] = c[1]; // "US.NY" -> "New York"
}
const ccList = [], ccIdx = new Map(), adList = [""], adIdx = new Map([["", 0]]);
const idx = (list, map, v) => (map.has(v) ? map.get(v) : (map.set(v, list.length), list.push(v), list.length - 1));
const rows = [];
for (const l of lines("cities15000.txt")) {
  const c = l.split("\t");
  const [, name, , , lat, lon, , , cc, , a1] = c;
  const pop = Number(c[14]) || 0;
  const region = admin1[`${cc}.${a1}`] ?? "";
  rows.push([name, Math.round(Number(lat) * 100) / 100, Math.round(Number(lon) * 100) / 100, idx(ccList, ccIdx, cc), idx(adList, adIdx, region), Math.round(pop / 1000)]);
}
const data = { source: "GeoNames cities15000, CC BY 4.0", countries: ccList.map((cc) => [cc, countries[cc]?.[0] ?? cc, countries[cc]?.[1] ?? ""]), regions: adList, cities: rows };
fs.writeFileSync(out, JSON.stringify(data));
console.log(`${rows.length} cities, ${ccList.length} countries, ${adList.length} regions -> ${path.relative(process.cwd(), out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
