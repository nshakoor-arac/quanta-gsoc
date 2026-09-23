import { createHash } from "node:crypto";
import type { Aggregator, Article, Band, SourceType } from "../types";
import { detectCountries, regionsFor } from "../geo/countries";
import { tagThemes } from "../taxonomy";
import { profileForDomain } from "./registry";

const TRACKING = /^(utm_|fbclid|gclid|mc_|ocid|cmpid|ref$|ref_src|spm|share|at_medium|at_campaign|xtor|cid$|ito$|smid)/i;

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.hostname = u.hostname.toLowerCase();
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export function articleId(url: string): string {
  return createHash("sha1").update(canonicalUrl(url)).digest("hex").slice(0, 20);
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: "...", ndash: "-", mdash: "-", eacute: "e", uuml: "u",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return " ";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      try {
        return String.fromCodePoint(parseInt(n, 16));
      } catch {
        return " ";
      }
    })
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function stripHtml(s: string): string {
  return decodeEntities(
    s
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanTitle(s: string): string {
  return stripHtml(s).replace(/\s+/g, " ").slice(0, 300);
}

export function cleanExcerpt(s: string, max = 320): string {
  const t = stripHtml(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + "...";
}

/** Dates in the future (beyond one day) are clamped to fetch time so bad feeds cannot pin themselves to the top. */
export function safeDate(input: string | undefined, now = new Date()): string {
  const d = input ? new Date(input) : null;
  if (!d || Number.isNaN(d.getTime())) return now.toISOString();
  if (d.getTime() > now.getTime() + 24 * 3600 * 1000) return now.toISOString();
  if (d.getTime() < Date.UTC(2000, 0, 1)) return now.toISOString();
  return d.toISOString();
}

/** Returns an ISO date only when the source supplied a usable one within the retention window. Never invents a date. */
export function validDate(input: string | undefined, now = new Date(), maxAgeDays = 45): string | null {
  if (!input) return null;
  let d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    // Some feeds use "Monday, September 21, 2026 - 15:56" (treated as UTC).
    const m = /([A-Za-z]{3,9}) (\d{1,2}), (\d{4})(?:\s*-\s*(\d{1,2}:\d{2}))?/.exec(input);
    if (!m) return null;
    d = new Date(`${m[1]} ${m[2]}, ${m[3]} ${m[4] ?? "00:00"} UTC`);
    if (Number.isNaN(d.getTime())) return null;
  }
  if (d.getTime() < now.getTime() - maxAgeDays * 86400000) return null;
  if (d.getTime() > now.getTime() + 24 * 3600 * 1000) return now.toISOString();
  return d.toISOString();
}

export interface RawItem {
  url: string;
  title: string;
  excerpt?: string;
  published?: string;
  lang?: string;
  aggregator: Aggregator;
  feedId: string;
  /** Overrides used when the aggregator knows the outlet (RSS registry, ReliefWeb). */
  source?: { name: string; domain: string; type: SourceType; band: Band; family: string };
  /** Country ISO2 codes supplied by the aggregator itself (for example ReliefWeb). */
  knownCountries?: string[];
  extraThemes?: string[];
}

export function toArticle(raw: RawItem, now = new Date()): Article | null {
  const url = canonicalUrl(raw.url || "");
  if (!/^https?:\/\//i.test(url)) return null;
  const title = cleanTitle(raw.title || "");
  if (title.length < 8) return null;
  const published = validDate(raw.published, now);
  if (!published) return null;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  const prof = raw.source
    ? { ...raw.source }
    : (() => {
        const p = profileForDomain(host);
        return { name: p.name, domain: p.domain, type: p.type, band: p.band, family: p.family };
      })();
  const excerpt = cleanExcerpt(raw.excerpt || "");
  const text = `${title}. ${excerpt}`;
  const detected = detectCountries(text);
  const countries = [...new Set([...(raw.knownCountries ?? []), ...detected])].slice(0, 8);
  const themes = tagThemes(title, excerpt);
  return {
    id: articleId(url),
    url,
    title,
    excerpt: excerpt === title ? "" : excerpt,
    sourceName: prof.name,
    domain: prof.domain,
    sourceType: prof.type,
    family: prof.family,
    band: prof.band,
    aggregator: raw.aggregator,
    feedId: raw.feedId,
    publishedAt: published,
    fetchedAt: now.toISOString(),
    lang: raw.lang || "en",
    countries,
    regions: regionsFor(countries),
    themes,
  };
}
