// Generates src/data/countries.json from the world-countries package (dev dependency).
// Run once with:  npm run gen:countries   (the generated file is committed to the repo)
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const wc = require("world-countries");

const REGION_OF = (c) => {
  const sub = c.subregion || "";
  const reg = c.region || "";
  if (c.cca2 === "MX") return "Latin America & Caribbean";
  if (["AM", "AZ", "GE"].includes(c.cca2)) return "Central Asia & Caucasus";
  if (c.cca2 === "CY") return "Europe";
  if (c.cca2 === "TR") return "Middle East & North Africa";
  if (c.cca2 === "SD") return "Sub-Saharan Africa"; // analytic convention (Horn of Africa)
  if (c.cca2 === "IR") return "Middle East & North Africa"; // analytic convention (Gulf security complex)
  if (reg === "Africa") return sub === "Northern Africa" ? "Middle East & North Africa" : "Sub-Saharan Africa";
  if (sub === "Western Asia") return "Middle East & North Africa";
  if (sub === "Central Asia") return "Central Asia & Caucasus";
  if (sub === "Southern Asia") return "South Asia";
  if (sub === "Eastern Asia" || sub === "South-Eastern Asia") return "East & Southeast Asia";
  if (reg === "Europe") return "Europe";
  if (reg === "Oceania") return "Oceania";
  if (sub === "Northern America" || sub === "North America" || c.cca2 === "US" || c.cca2 === "CA") return "North America";
  if (reg === "Americas") return "Latin America & Caribbean";
  return null;
};

const ASCII = /^[A-Za-z][A-Za-z .'\-]+$/;
const out = [];
for (const c of wc) {
  if (c.cca2 === "AQ" || c.cca2 === "UM" || c.cca2 === "BV" || c.cca2 === "HM" || c.cca2 === "TF" || c.cca2 === "GS") continue;
  const region = REGION_OF(c);
  if (!region) continue;
  const aliases = new Set();
  const add = (s) => {
    if (!s || typeof s !== "string") return;
    const t = s.trim();
    if (t.length < 4 || !ASCII.test(t)) return;
    aliases.add(t);
  };
  add(c.name.common);
  add(c.name.official);
  for (const s of c.altSpellings || []) add(s);
  const dem = c.demonyms?.eng;
  add(dem?.m);
  add(dem?.f);
  out.push({
    iso2: c.cca2,
    iso3: c.cca3,
    num: c.ccn3 || "",
    name: c.name.common,
    region,
    lat: c.latlng?.[0] ?? 0,
    lng: c.latlng?.[1] ?? 0,
    aliases: [...aliases],
  });
}
out.sort((a, b) => a.name.localeCompare(b.name));
mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/countries.json", JSON.stringify(out));
// Slim copy without alias lists for browser bundles
writeFileSync("src/data/countries-lite.json", JSON.stringify(out.map(({ aliases, ...rest }) => rest)));
console.log(`Wrote ${out.length} countries`);
const byRegion = {};
for (const c of out) byRegion[c.region] = (byRegion[c.region] || 0) + 1;
console.log(byRegion);
