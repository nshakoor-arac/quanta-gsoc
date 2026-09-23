import type { Band, SourceType } from "../types";

export interface FeedDef {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  band: Band;
  family: string;
  domain: string;
  /** Optional regex: items whose title matches are dropped (used for low-signal alert classes). */
  exclude?: RegExp;
  /** Maximum items to keep from one pull. */
  max?: number;
}

/**
 * Curated RSS registry. Bands here are PROVISIONAL triage values for the app.
 * They are a starting point for analyst RAPITIS scoring, not a substitute for it.
 */
export const FEEDS: FeedDef[] = [
  { id: "bbc-world", name: "BBC News: World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", type: "broadcaster", band: "green", family: "bbc", domain: "bbc.com", max: 40 },
  { id: "bbc-africa", name: "BBC News: Africa", url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", type: "broadcaster", band: "green", family: "bbc", domain: "bbc.com", max: 40 },
  { id: "bbc-mideast", name: "BBC News: Middle East", url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", type: "broadcaster", band: "green", family: "bbc", domain: "bbc.com", max: 40 },
  { id: "bbc-asia", name: "BBC News: Asia", url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml", type: "broadcaster", band: "green", family: "bbc", domain: "bbc.com", max: 30 },
  { id: "bbc-europe", name: "BBC News: Europe", url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml", type: "broadcaster", band: "green", family: "bbc", domain: "bbc.com", max: 30 },
  { id: "bbc-latam", name: "BBC News: Latin America", url: "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml", type: "broadcaster", band: "green", family: "bbc", domain: "bbc.com", max: 30 },
  { id: "aljazeera", name: "Al Jazeera English", url: "https://www.aljazeera.com/xml/rss/all.xml", type: "broadcaster", band: "amber", family: "aljazeera", domain: "aljazeera.com", max: 40 },
  { id: "un-news", name: "UN News: Global", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", type: "igo", band: "green", family: "un", domain: "news.un.org", max: 40 },
  { id: "un-peace", name: "UN News: Peace and Security", url: "https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/feed/rss.xml", type: "igo", band: "green", family: "un", domain: "news.un.org", max: 30 },
  { id: "un-humanitarian", name: "UN News: Humanitarian Aid", url: "https://news.un.org/feed/subscribe/en/news/topic/humanitarian-aid/feed/rss.xml", type: "igo", band: "green", family: "un", domain: "news.un.org", max: 30 },
  { id: "un-migrants", name: "UN News: Migrants and Refugees", url: "https://news.un.org/feed/subscribe/en/news/topic/migrants-and-refugees/feed/rss.xml", type: "igo", band: "green", family: "un", domain: "news.un.org", max: 30 },
  { id: "ocha", name: "UN OCHA", url: "https://www.unocha.org/rss.xml", type: "igo", band: "green", family: "un", domain: "unocha.org", max: 20 },
  { id: "ohchr", name: "UN OHCHR", url: "https://www.ohchr.org/en/rss.xml", type: "igo", band: "green", family: "un", domain: "ohchr.org", max: 20 },
  { id: "tnh", name: "The New Humanitarian", url: "https://www.thenewhumanitarian.org/rss.xml", type: "ngo", band: "green", family: "thenewhumanitarian", domain: "thenewhumanitarian.org", max: 20 },
  { id: "crisisgroup", name: "International Crisis Group", url: "https://www.crisisgroup.org/rss", type: "thinktank", band: "green", family: "crisisgroup", domain: "crisisgroup.org", max: 20 },
  { id: "france24", name: "France 24", url: "https://www.france24.com/en/rss", type: "broadcaster", band: "green", family: "france24", domain: "france24.com", max: 40 },
  { id: "cbc-world", name: "CBC News: World", url: "https://www.cbc.ca/webfeed/rss/rss-world", type: "broadcaster", band: "green", family: "cbc", domain: "cbc.ca", max: 30 },
  { id: "abc-au", name: "ABC News (Australia): World", url: "https://www.abc.net.au/news/feed/2942460/rss.xml", type: "broadcaster", band: "green", family: "abc-au", domain: "abc.net.au", max: 30 },
  { id: "euronews", name: "Euronews", url: "https://www.euronews.com/rss?level=theme&name=news", type: "broadcaster", band: "amber", family: "euronews", domain: "euronews.com", max: 30 },
  { id: "africanews", name: "Africanews", url: "https://www.africanews.com/feed/rss", type: "broadcaster", band: "amber", family: "africanews", domain: "africanews.com", max: 30 },
  { id: "scmp", name: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed", type: "newspaper", band: "amber", family: "scmp", domain: "scmp.com", max: 30 },
  { id: "japantimes", name: "The Japan Times", url: "https://www.japantimes.co.jp/feed/", type: "newspaper", band: "amber", family: "japantimes", domain: "japantimes.co.jp", max: 20 },
  { id: "dawn", name: "Dawn (Pakistan)", url: "https://www.dawn.com/feeds/home", type: "newspaper", band: "amber", family: "dawn", domain: "dawn.com", max: 20 },
  { id: "premiumtimes", name: "Premium Times (Nigeria)", url: "https://www.premiumtimesng.com/feed", type: "newspaper", band: "amber", family: "premiumtimes", domain: "premiumtimesng.com", max: 20 },
  { id: "mee", name: "Middle East Eye", url: "https://www.middleeasteye.net/rss", type: "newspaper", band: "amber", family: "mee", domain: "middleeasteye.net", max: 25 },
  { id: "diplomat", name: "The Diplomat", url: "https://thediplomat.com/feed/", type: "specialist", band: "amber", family: "diplomat", domain: "thediplomat.com", max: 25 },
  { id: "wotr", name: "War on the Rocks", url: "https://warontherocks.com/feed/", type: "specialist", band: "amber", family: "wotr", domain: "warontherocks.com", max: 15 },
  { id: "foreignpolicy", name: "Foreign Policy", url: "https://foreignpolicy.com/feed/", type: "specialist", band: "amber", family: "foreignpolicy", domain: "foreignpolicy.com", max: 20 },
  { id: "globalobs", name: "The Global Observatory (IPI)", url: "https://theglobalobservatory.org/feed/", type: "thinktank", band: "green", family: "ipi", domain: "theglobalobservatory.org", max: 10 },
  { id: "gdacs", name: "GDACS Disaster Alerts", url: "https://www.gdacs.org/xml/rss.xml", type: "igo", band: "green", family: "gdacs", domain: "gdacs.org", exclude: /^Green /i, max: 30 },
  { id: "cisa", name: "CISA Advisories", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", type: "government", band: "green", family: "cisa", domain: "cisa.gov", max: 20 },
  { id: "thehackernews", name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", type: "specialist", band: "amber", family: "thehackernews", domain: "thehackernews.com", max: 20 },
  { id: "bleeping", name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", type: "specialist", band: "amber", family: "bleepingcomputer", domain: "bleepingcomputer.com", max: 15 },
  { id: "krebs", name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", type: "specialist", band: "amber", family: "krebs", domain: "krebsonsecurity.com", max: 10 },
];

/* ------------------------------------------------------------------
   Domain profiles for GDELT and other domain-only aggregators.
   Format: domain | display name | type | band | family (optional)
   ------------------------------------------------------------------ */
const DOMAIN_TABLE = `
reuters.com|Reuters|wire|green|reuters
apnews.com|Associated Press|wire|green|ap
afp.com|Agence France-Presse|wire|green|afp
bbc.com|BBC News|broadcaster|green|bbc
bbc.co.uk|BBC News|broadcaster|green|bbc
aljazeera.com|Al Jazeera|broadcaster|amber|aljazeera
aljazeera.net|Al Jazeera (Arabic)|broadcaster|amber|aljazeera
theguardian.com|The Guardian|newspaper|green|guardian
nytimes.com|The New York Times|newspaper|green|nytimes
washingtonpost.com|The Washington Post|newspaper|green|washingtonpost
wsj.com|The Wall Street Journal|newspaper|green|wsj
ft.com|Financial Times|newspaper|green|ft
economist.com|The Economist|newspaper|green|economist
bloomberg.com|Bloomberg|wire|green|bloomberg
cnn.com|CNN|broadcaster|amber|cnn
nbcnews.com|NBC News|broadcaster|amber|nbc
cbsnews.com|CBS News|broadcaster|amber|cbs
abcnews.go.com|ABC News (US)|broadcaster|amber|abc-us
npr.org|NPR|broadcaster|green|npr
pbs.org|PBS|broadcaster|green|pbs
voanews.com|Voice of America|broadcaster|amber|voa
france24.com|France 24|broadcaster|green|france24
rfi.fr|RFI|broadcaster|green|france24
dw.com|Deutsche Welle|broadcaster|green|dw
euronews.com|Euronews|broadcaster|amber|euronews
skynews.com|Sky News|broadcaster|amber|skynews
news.sky.com|Sky News|broadcaster|amber|skynews
cbc.ca|CBC News|broadcaster|green|cbc
abc.net.au|ABC News (Australia)|broadcaster|green|abc-au
scmp.com|South China Morning Post|newspaper|amber|scmp
straitstimes.com|The Straits Times|newspaper|amber|straitstimes
channelnewsasia.com|CNA|broadcaster|amber|cna
japantimes.co.jp|The Japan Times|newspaper|amber|japantimes
nhk.or.jp|NHK World|broadcaster|green|nhk
koreaherald.com|The Korea Herald|newspaper|amber|koreaherald
thehindu.com|The Hindu|newspaper|amber|thehindu
timesofindia.indiatimes.com|The Times of India|newspaper|amber|toi
hindustantimes.com|Hindustan Times|newspaper|amber|hindustantimes
dawn.com|Dawn|newspaper|amber|dawn
tribune.com.pk|The Express Tribune|newspaper|amber|tribune-pk
thedailystar.net|The Daily Star (Bangladesh)|newspaper|amber|dailystar
africanews.com|Africanews|broadcaster|amber|africanews
allafrica.com|AllAfrica|aggregator|amber|allafrica
premiumtimesng.com|Premium Times|newspaper|amber|premiumtimes
punchng.com|Punch Nigeria|newspaper|amber|punchng
dailymaverick.co.za|Daily Maverick|newspaper|amber|dailymaverick
mg.co.za|Mail and Guardian|newspaper|amber|mg
theeastafrican.co.ke|The EastAfrican|newspaper|amber|eastafrican
nation.africa|Nation Africa|newspaper|amber|nation
sudantribune.com|Sudan Tribune|newspaper|amber|sudantribune
dabangasudan.org|Radio Dabanga|newspaper|amber|dabanga
kyivindependent.com|The Kyiv Independent|newspaper|amber|kyivindependent
pravda.com.ua|Ukrainska Pravda|newspaper|amber|pravda-ua
ukrinform.net|Ukrinform|state-media|amber|ukrinform
timesofisrael.com|The Times of Israel|newspaper|amber|toi-il
haaretz.com|Haaretz|newspaper|amber|haaretz
jpost.com|The Jerusalem Post|newspaper|amber|jpost
middleeasteye.net|Middle East Eye|newspaper|amber|mee
arabnews.com|Arab News|newspaper|amber|arabnews
thenationalnews.com|The National (UAE)|newspaper|amber|thenational
trtworld.com|TRT World|state-media|amber|trt
aa.com.tr|Anadolu Agency|state-media|amber|anadolu
tass.com|TASS|state-media|amber|tass
rt.com|RT|state-media|amber|rt
sputnikglobe.com|Sputnik|state-media|amber|sputnik
xinhuanet.com|Xinhua|state-media|amber|xinhua
english.news.cn|Xinhua|state-media|amber|xinhua
cgtn.com|CGTN|state-media|amber|cgtn
globaltimes.cn|Global Times|state-media|amber|globaltimes
chinadaily.com.cn|China Daily|state-media|amber|chinadaily
presstv.ir|Press TV|state-media|amber|presstv
tehrantimes.com|Tehran Times|state-media|amber|tehrantimes
irna.ir|IRNA|state-media|amber|irna
aa.com|Anadolu Agency|state-media|amber|anadolu
news.un.org|UN News|igo|green|un
un.org|United Nations|igo|green|un
unocha.org|UN OCHA|igo|green|un
ohchr.org|UN OHCHR|igo|green|un
unhcr.org|UNHCR|igo|green|un
unicef.org|UNICEF|igo|green|un
wfp.org|World Food Programme|igo|green|un
who.int|World Health Organization|igo|green|un
iom.int|IOM|igo|green|un
reliefweb.int|ReliefWeb|aggregator|green|reliefweb
worldbank.org|World Bank|igo|green|worldbank
imf.org|IMF|igo|green|imf
icrc.org|ICRC|ngo|green|icrc
msf.org|Médecins Sans Frontières|ngo|green|msf
hrw.org|Human Rights Watch|ngo|green|hrw
amnesty.org|Amnesty International|ngo|green|amnesty
thenewhumanitarian.org|The New Humanitarian|ngo|green|thenewhumanitarian
crisisgroup.org|International Crisis Group|thinktank|green|crisisgroup
acleddata.com|ACLED|thinktank|green|acled
chathamhouse.org|Chatham House|thinktank|green|chathamhouse
csis.org|CSIS|thinktank|green|csis
rand.org|RAND|thinktank|green|rand
brookings.edu|Brookings|thinktank|green|brookings
carnegieendowment.org|Carnegie Endowment|thinktank|green|carnegie
understandingwar.org|Institute for the Study of War|thinktank|green|isw
issafrica.org|ISS Africa|thinktank|green|iss
foreignpolicy.com|Foreign Policy|specialist|amber|foreignpolicy
foreignaffairs.com|Foreign Affairs|specialist|green|foreignaffairs
thediplomat.com|The Diplomat|specialist|amber|diplomat
warontherocks.com|War on the Rocks|specialist|amber|wotr
politico.com|Politico|newspaper|amber|politico
politico.eu|Politico Europe|newspaper|amber|politico
axios.com|Axios|newspaper|amber|axios
thehill.com|The Hill|newspaper|amber|thehill
defensenews.com|Defense News|specialist|amber|defensenews
janes.com|Janes|specialist|green|janes
thehackernews.com|The Hacker News|specialist|amber|thehackernews
bleepingcomputer.com|BleepingComputer|specialist|amber|bleepingcomputer
krebsonsecurity.com|Krebs on Security|specialist|amber|krebs
therecord.media|The Record|specialist|amber|therecord
cisa.gov|CISA|government|green|cisa
state.gov|US Department of State|government|amber|us-govt
gdacs.org|GDACS|igo|green|gdacs
usgs.gov|USGS|government|green|usgs
`;

export interface DomainProfile {
  name: string;
  type: SourceType;
  band: Band;
  family: string;
}

const DOMAINS: Record<string, DomainProfile> = {};
for (const line of DOMAIN_TABLE.trim().split("\n")) {
  const [d, name, type, band, family] = line.split("|");
  DOMAINS[d] = { name, type: type as SourceType, band: band as Band, family: family || d };
}

const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "edu", "or", "ne", "go"]);

export function normalizeDomain(hostOrUrl: string): string {
  let host = hostOrUrl.trim().toLowerCase();
  try {
    if (host.includes("://")) host = new URL(host).hostname;
  } catch {
    /* keep as is */
  }
  return host.replace(/^www\./, "").replace(/^m\./, "").replace(/^amp\./, "");
}

/** Registrable domain, with light handling of two-part public suffixes like co.uk and com.au. */
export function registrableDomain(host: string): string {
  const h = normalizeDomain(host);
  const parts = h.split(".");
  if (parts.length <= 2) return h;
  const last = parts[parts.length - 1];
  const second = parts[parts.length - 2];
  if (last.length === 2 && SECOND_LEVEL.has(second)) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

export function profileForDomain(host: string): DomainProfile & { domain: string } {
  const h = normalizeDomain(host);
  if (DOMAINS[h]) return { ...DOMAINS[h], domain: h };
  const reg = registrableDomain(h);
  if (DOMAINS[reg]) return { ...DOMAINS[reg], domain: h };
  return { name: reg, type: "unclassified", band: "unrated", family: reg, domain: h };
}

export const BAND_LABEL: Record<Band, string> = {
  green: "Green (provisional)",
  amber: "Amber (provisional)",
  red: "Red",
  unrated: "Unrated",
};
export const TYPE_LABEL: Record<SourceType, string> = {
  wire: "News wire",
  broadcaster: "Broadcaster",
  newspaper: "Newspaper",
  igo: "Intergovernmental",
  ngo: "NGO",
  thinktank: "Think tank",
  specialist: "Specialist outlet",
  government: "Government",
  "state-media": "State-affiliated media",
  aggregator: "Aggregator",
  unclassified: "Unclassified",
};
