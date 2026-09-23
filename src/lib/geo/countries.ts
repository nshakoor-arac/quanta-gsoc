import raw from "@/data/countries.json";

export interface Country {
  iso2: string;
  iso3: string;
  num: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export const COUNTRIES: Country[] = raw as Country[];
export const BY_ISO2: Record<string, Country> = Object.fromEntries(COUNTRIES.map((c) => [c.iso2, c]));
export const BY_ISO3: Record<string, Country> = Object.fromEntries(COUNTRIES.map((c) => [c.iso3, c]));
export const BY_NUM: Record<string, Country> = Object.fromEntries(COUNTRIES.filter((c) => c.num).map((c) => [String(Number(c.num)), c]));
export const REGIONS: string[] = [...new Set(COUNTRIES.map((c) => c.region))].sort();

export function countryName(iso2: string): string {
  return BY_ISO2[iso2]?.name ?? iso2;
}
export function regionOfCountry(iso2: string): string | undefined {
  return BY_ISO2[iso2]?.region;
}
export function countriesInRegion(region: string): Country[] {
  return COUNTRIES.filter((c) => c.region === region);
}

/* ------------------------------------------------------------------
   Matcher: finds countries mentioned in a headline or excerpt.
   Deterministic and inspectable. Known ambiguities are handled by rules.
   ------------------------------------------------------------------ */

interface Rule {
  re: RegExp;
  iso2: string;
  len: number;
}

// Extra aliases: abbreviations, former names, disputed territories and hotspot cities.
const EXTRA: Record<string, string[]> = {
  US: ["U.S.", "US", "Washington DC", "Pentagon", "White House"],
  GB: ["UK", "Britain", "England", "Scotland", "Wales", "Northern Ireland", "London"],
  AE: ["UAE", "Emirati", "Dubai", "Abu Dhabi"],
  CD: ["DRC", "DR Congo", "Congo", "Kinshasa", "Goma", "Bukavu", "North Kivu", "South Kivu", "Ituri"],
  CG: ["Brazzaville", "Congo-Brazzaville"],
  PS: ["Gaza", "Gaza Strip", "West Bank", "Gaza City", "Rafah", "Khan Younis", "Ramallah", "Hamas"],
  IL: ["Tel Aviv", "Jerusalem", "Israeli"],
  UA: ["Kyiv", "Kiev", "Kharkiv", "Odesa", "Odessa", "Zaporizhzhia", "Donetsk", "Kherson", "Donbas", "Crimea"],
  RU: ["Moscow", "Kremlin"],
  SD: ["Khartoum", "El Fasher", "Darfur", "Kordofan", "Omdurman", "Port Sudan", "Rapid Support Forces"],
  SS: ["Juba"],
  SY: ["Damascus", "Aleppo", "Idlib"],
  LB: ["Beirut", "Hezbollah"],
  YE: ["Sanaa", "Houthis", "Houthi", "Hodeidah", "Aden"],
  IR: ["Tehran"],
  IQ: ["Baghdad", "Mosul"],
  AF: ["Kabul", "Taliban"],
  PK: ["Islamabad", "Karachi", "Balochistan", "Khyber Pakhtunkhwa"],
  IN: ["New Delhi", "Kashmir", "Manipur"],
  MM: ["Burma", "Myanmar", "Rakhine", "Yangon", "Naypyidaw"],
  CN: ["Beijing", "Xinjiang", "Hong Kong SAR"],
  TW: ["Taipei"],
  KP: ["Pyongyang", "DPRK"],
  KR: ["Seoul"],
  ET: ["Addis Ababa", "Tigray", "Amhara", "Oromia"],
  SO: ["Mogadishu", "Somaliland", "Al-Shabaab"],
  KE: ["Nairobi"],
  NG: ["Abuja", "Lagos", "Boko Haram"],
  ML: ["Bamako"],
  BF: ["Ouagadougou"],
  NE: ["Niamey"],
  CF: ["Bangui"],
  MZ: ["Cabo Delgado"],
  HT: ["Port-au-Prince"],
  VE: ["Caracas"],
  CO: ["Bogota", "Bogotá"],
  MX: ["Mexico City"],
  TR: ["Türkiye", "Turkiye", "Ankara", "Istanbul"],
  CI: ["Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire"],
  SZ: ["Swaziland"],
  CZ: ["Czech Republic"],
  MK: ["Macedonia"],
  LY: ["Tripoli", "Benghazi"],
  EG: ["Cairo", "Sinai"],
  SA: ["Riyadh"],
  MD: ["Transnistria"],
  BY: ["Minsk"],
  RS: ["Belgrade"],
  XK: ["Pristina"],
  AZ: ["Baku", "Nagorno-Karabakh"],
  AM: ["Yerevan"],
  PH: ["Manila"],
  ID: ["Jakarta", "Papua"],
  TH: ["Bangkok"],
  BD: ["Dhaka"],
  LK: ["Colombo"],
  NP: ["Kathmandu"],
};

// Aliases that are too ambiguous to match blindly are skipped in the generic loop and handled separately.
const SKIP_GENERIC = new Set(["Georgia", "Jordan", "Chad", "Congo", "Guinea", "Niger", "Sudan", "Turkey", "Korea", "Mali", "Oman", "Peru", "Cuba", "Iran", "Israel", "Israeli", "Palestinian", "Dominican", "Guinean", "American", "Chinese", "Indian", "Mexicanos", "Republic of China", "Republic of Chad", "Nijar", "Nijeriya", "Tchad"]);

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let RULES: Rule[] | null = null;

function buildRules(): Rule[] {
  const rules: Rule[] = [];
  const seen = new Set<string>();
  const push = (alias: string, iso2: string, caseSensitive = false) => {
    const key = `${alias}|${iso2}`;
    if (seen.has(key)) return;
    seen.add(key);
    const flags = caseSensitive ? "" : "i";
    rules.push({ re: new RegExp(`(?<![\\p{L}\\p{N}])${esc(alias)}(?![\\p{L}\\p{N}])`, `${flags}u`), iso2, len: alias.length });
  };
  for (const c of COUNTRIES) {
    for (const a of c.aliases) {
      if (a === "Congo" || SKIP_GENERIC.has(a)) continue;
      if (c.iso2 === "CG" && a === "Congolese") continue;
      push(a, c.iso2);
    }
    // Safe common names for otherwise skipped aliases
    for (const a of [c.name]) {
      if (["Mali", "Oman", "Peru", "Cuba", "Iran", "Israel", "Sudan", "Niger", "Guinea", "Turkey"].includes(a)) push(a, c.iso2);
    }
  }
  for (const [iso2, list] of Object.entries(EXTRA)) {
    for (const a of list) push(a, iso2, a === "US" || a === "UK" || a === "UAE" || a === "DRC" || a === "U.S.");
  }
  // Demonyms for a few ubiquitous cases
  for (const [a, iso2] of [["Israeli", "IL"], ["Iranian", "IR"], ["Palestinian", "PS"], ["Chinese", "CN"], ["Indian", "IN"], ["American", "US"], ["Sudanese", "SD"], ["Congolese", "CD"], ["Guinean", "GN"]] as const) push(a, iso2);
  rules.sort((a, b) => b.len - a.len);
  return rules;
}

/** Cases where a plain match needs a guard against a common non-country meaning. */
const CAPITALISED_GIVEN_NAME = /[A-Z][a-z]+\s$/;

function guarded(text: string, name: "Jordan" | "Chad" | "Georgia"): boolean {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${name}(?![\\p{L}\\p{N}])`, "gu");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 20), m.index);
    const after = text.slice(m.index + name.length, m.index + name.length + 12);
    if (name === "Georgia") {
      if (/Tbilisi|Georgian|Sakartvelo|Abkhazia|Ossetia/.test(text) && !/Atlanta|Savannah|Augusta|Peach State/.test(text)) return true;
      continue;
    }
    if (CAPITALISED_GIVEN_NAME.test(before) && !/(Northern|Southern|Eastern|Western|Kingdom of|Hashemite|Lake)\s$/.test(before)) continue; // "Michael Jordan", "Chad Wolf"
    if (/^\s+(?:Peterson|River Valley|Air|Brand)/.test(after)) continue;
    return true;
  }
  return false;
}

/** Returns ISO2 codes of countries mentioned in the text, in order of first strong match. */
export function detectCountries(text: string): string[] {
  if (!text) return [];
  if (!RULES) RULES = buildRules();
  let working = text;
  const found: string[] = [];
  for (const r of RULES) {
    if (r.re.test(working)) {
      if (!found.includes(r.iso2)) found.push(r.iso2);
      // blank out matches so shorter aliases inside the span do not fire (e.g. "Guinea" inside "Papua New Guinea")
      working = working.replace(new RegExp(r.re.source, r.re.flags.includes("g") ? r.re.flags : r.re.flags + "g"), " ".repeat(r.len));
    }
  }
  for (const [name, iso2] of [["Jordan", "JO"], ["Chad", "TD"], ["Georgia", "GE"]] as const) {
    if (!found.includes(iso2) && guarded(working, name)) found.push(iso2);
  }
  return found.slice(0, 6);
}

export function regionsFor(iso2s: string[]): string[] {
  return [...new Set(iso2s.map((c) => BY_ISO2[c]?.region).filter(Boolean) as string[])];
}
