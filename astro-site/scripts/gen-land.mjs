// Generates src/lib/land-dots.json: land cells on a 3° grid for the dotted maps.
// Run: node scripts/gen-land.mjs   (needs d3, topojson-client, world-atlas — already dependencies)
import fs from "node:fs";
import { geoContains } from "d3";
import { feature } from "topojson-client";
import land from "world-atlas/land-110m.json" with { type: "json" };

const STEP = 3;
const topo = feature(land, land.objects.land);
const dots = [];
for (let lat = 78 - STEP / 2; lat > -58; lat -= STEP)
  for (let lon = -180 + STEP / 2; lon < 180; lon += STEP)
    if (geoContains(topo, [lon, lat])) dots.push([lon, lat]);
fs.writeFileSync(new URL("../src/lib/land-dots.json", import.meta.url), JSON.stringify(dots));
console.log(dots.length, "land dots");
