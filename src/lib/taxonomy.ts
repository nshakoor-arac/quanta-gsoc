import type { ThemeId } from "./types";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  /** Keyword patterns. Deterministic and inspectable: a theme tag means at least one pattern matched. */
  patterns: RegExp[];
  /** Keywords used to build GDELT queries for this theme. */
  gdelt: string;
}

const w = (s: string) => new RegExp(`\\b(?:${s})\\b`, "i");

export const THEMES: ThemeDef[] = [
  {
    id: "conflict",
    label: "Armed conflict",
    gdelt: '(airstrike OR shelling OR offensive OR ceasefire OR "armed clashes" OR militia OR "drone strike")',
    patterns: [
      w("airstrikes?|air strikes?|shelling|shelled|offensive|ceasefire|cease-fire|truce|frontline|front line|artillery|missiles?|drone strikes?|drones? attack|battle|battles|clashes|fighting|militants?|militias?|rebels?|insurgents?|troops|army|military operation|invasion|invaded|war|warfare|paramilitary|warplanes?|bombardment|bombing"),
    ],
  },
  {
    id: "terrorism",
    label: "Terrorism and extremism",
    gdelt: '(terrorist OR "suicide bomber" OR jihadist OR extremist OR "car bomb")',
    patterns: [w("terror|terrorist|terrorism|suicide bomb\\w*|jihadist|jihadists|extremists?|islamic state|isis|al-shabaab|boko haram|al-qaeda|al qaeda|jnim|hostage|hostages|kidnapp\\w+|car bomb|ied|improvised explosive")],
  },
  {
    id: "unrest",
    label: "Political unrest",
    gdelt: '(protesters OR protest OR riot OR coup OR "state of emergency" OR crackdown OR curfew)',
    patterns: [w("protests?|protesters?|demonstrators?|demonstrations?|riots?|rioting|unrest|coup|mutiny|crackdown|curfew|state of emergency|strikes? action|opposition leader|tear gas|civil disobedience|uprising|insurrection")],
  },
  {
    id: "governance",
    label: "Governance and elections",
    gdelt: '(election OR parliament OR constitution OR impeachment OR corruption)',
    patterns: [w("elections?|ballot|voters?|voting|referendum|parliament|lawmakers?|constitution\\w*|impeach\\w*|corruption|cabinet|prime minister|president|junta|transitional government|term limits?|electoral")],
  },
  {
    id: "humanitarian",
    label: "Humanitarian",
    gdelt: '(humanitarian OR famine OR cholera OR "food insecurity" OR "aid workers" OR malnutrition)',
    patterns: [w("humanitarian|famine|hunger|starvation|malnutrition|food insecurity|cholera|aid workers?|aid convoys?|aid access|unicef|wfp|world food programme|ocha|civilians? (?:trapped|killed|besieged)|siege|besieged|displacement|displaced|idps?|shelter|outbreak|epidemic")],
  },
  {
    id: "migration",
    label: "Migration and displacement",
    gdelt: '(refugees OR asylum OR migrants OR deportation OR "border crossing")',
    patterns: [w("refugees?|asylum|asylum seekers?|migrants?|migration|deport\\w*|border crossing|smuggling|unhcr|iom|stateless|resettlement")],
  },
  {
    id: "economic",
    label: "Economic and sanctions",
    gdelt: '(sanctions OR tariffs OR embargo OR inflation OR "currency crisis" OR "debt default")',
    patterns: [w("sanctions?|sanctioned|tariffs?|embargo|inflation|currency|devaluation|debt|default|imf|world bank|trade war|export controls?|oil prices?|supply chain|blockade|shortages?")],
  },
  {
    id: "cyber",
    label: "Cyber and information",
    gdelt: '(cyberattack OR ransomware OR "data breach" OR disinformation OR hackers OR malware)',
    patterns: [w("cyber\\w*|ransomware|hackers?|hacked|data breach|malware|ddos|zero-day|vulnerabilit\\w+|disinformation|misinformation|influence operation|deepfakes?|phishing|spyware|internet shutdown|censorship")],
  },
  {
    id: "hazard",
    label: "Hazards and disasters",
    gdelt: '(earthquake OR flood OR cyclone OR typhoon OR hurricane OR wildfire OR drought OR tsunami)',
    patterns: [w("earthquake|quake|flood|floods|flooding|cyclone|typhoon|hurricane|wildfire|drought|volcano|volcanic|tsunami|landslide|heatwave|storm|disaster|gdacs")],
  },
];

export const THEME_MAP: Record<ThemeId, ThemeDef> = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<ThemeId, ThemeDef>;

export function themeLabel(id: string): string {
  return THEME_MAP[id as ThemeId]?.label ?? id;
}

/** Tags an item with every theme whose patterns match the title or excerpt. */
export function tagThemes(title: string, excerpt = ""): ThemeId[] {
  const text = `${title} ${excerpt}`;
  const out: ThemeId[] = [];
  for (const t of THEMES) {
    if (t.patterns.some((p) => p.test(text))) out.push(t.id);
  }
  return out;
}
