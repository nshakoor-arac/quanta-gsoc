import { XMLParser } from "fast-xml-parser";
import type { Article } from "../types";
import type { FeedDef } from "./registry";
import { fetchText } from "./http";
import { toArticle, type RawItem } from "./normalize";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  trimValues: true,
});

function txt(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return txt(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("#text" in o) return txt(o["#text"]);
    if ("@_href" in o) return txt(o["@_href"]);
  }
  return "";
}

function linkOf(item: Record<string, unknown>): string {
  const l = item.link;
  if (Array.isArray(l)) {
    const alt = l.find((x) => typeof x === "object" && x && ((x as Record<string, unknown>)["@_rel"] === "alternate" || !(x as Record<string, unknown>)["@_rel"]));
    return txt(alt ?? l[0]);
  }
  const s = txt(l);
  if (s) return s;
  const g = item.guid;
  const gs = txt(g);
  return /^https?:/i.test(gs) ? gs : "";
}

export interface ParsedFeedItem {
  url: string;
  title: string;
  excerpt: string;
  published: string;
}

export function parseFeed(xml: string): ParsedFeedItem[] {
  const doc = parser.parse(xml);
  let items: Record<string, unknown>[] = [];
  if (doc?.rss?.channel) {
    const ch = Array.isArray(doc.rss.channel) ? doc.rss.channel[0] : doc.rss.channel;
    items = [].concat(ch.item ?? []);
  } else if (doc?.feed) {
    items = [].concat(doc.feed.entry ?? []);
  } else if (doc?.["rdf:RDF"]) {
    items = [].concat(doc["rdf:RDF"].item ?? []);
  }
  return items
    .map((it) => {
      let excerpt = txt(it.description) || txt(it.summary) || txt(it["content:encoded"]) || txt(it.content);
      // Drupal feeds (OHCHR, The New Humanitarian) carry the date inside the description as <time datetime="...">.
      const embedded = /datetime="([^"]+)"/.exec(excerpt)?.[1] ?? "";
      if (embedded && /<\/time>/i.test(excerpt)) excerpt = excerpt.split(/<\/time>/i).slice(1).join(" "); // drop title, author and date preamble
      return {
        url: linkOf(it),
        title: txt(it.title),
        excerpt,
        published: txt(it.pubDate) || txt(it["dc:date"]) || txt(it.published) || txt(it.updated) || txt(it["gdacs:dateadded"]) || embedded,
      };
    })
    .filter((i) => i.url && i.title);
}

export interface FeedResult {
  feedId: string;
  name: string;
  ok: boolean;
  count: number;
  error?: string;
  ms: number;
  articles: Article[];
}

export async function pullFeed(feed: FeedDef, now = new Date()): Promise<FeedResult> {
  const t0 = Date.now();
  try {
    const xml = await fetchText(feed.url, { timeoutMs: 12000 });
    const parsed = parseFeed(xml);
    const out: Article[] = [];
    for (const p of parsed) {
      if (feed.exclude && feed.exclude.test(p.title)) continue;
      const raw: RawItem = {
        url: p.url,
        title: p.title,
        excerpt: p.excerpt,
        published: p.published,
        aggregator: "rss",
        feedId: feed.id,
        source: { name: feed.name.replace(/:.*$/, ""), domain: feed.domain, type: feed.type, band: feed.band, family: feed.family },
      };
      const a = toArticle(raw, now);
      if (a) out.push(a);
      if (out.length >= (feed.max ?? 30)) break;
    }
    if (out.length === 0) return { feedId: feed.id, name: feed.name, ok: false, count: 0, error: "No dated items from the last 45 days (feed may be stale)", ms: Date.now() - t0, articles: [] };
    return { feedId: feed.id, name: feed.name, ok: true, count: out.length, ms: Date.now() - t0, articles: out };
  } catch (e) {
    return { feedId: feed.id, name: feed.name, ok: false, count: 0, error: (e as Error).message, ms: Date.now() - t0, articles: [] };
  }
}
