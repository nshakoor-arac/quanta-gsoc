import { describe, expect, it } from "vitest";
import { noDashes, normCites, extractJson, auditCitations, deepSanitize } from "@/lib/ai/sanitize";
import { applyCeiling, confidenceCeiling } from "@/lib/ai/evidence";
import { validDate, canonicalUrl, toArticle } from "@/lib/sources/normalize";
import { parseFeed } from "@/lib/sources/rss";
import { detectCountries } from "@/lib/geo/countries";
import { createSession, verifySession, safeEqual } from "@/lib/auth";
import { tagThemes } from "@/lib/taxonomy";

const NOW = new Date("2026-09-23T12:00:00Z");

describe("house style sanitiser", () => {
  it("removes em and en dashes everywhere", () => {
    const out = deepSanitize({ a: "one \u2014 two", b: ["10\u201320", "x \u2013 y"], c: { d: "no dash" } });
    expect(JSON.stringify(out)).not.toMatch(/[\u2013\u2014]/);
    expect(noDashes("range 5\u201310")).toBe("range 5 to 10");
  });
  it("splits grouped citations into one per bracket", () => {
    expect(normCites("claim [1, 2] and [3,4]")).toBe("claim [1][2] and [3][4]");
  });
  it("extracts JSON from fenced or chatty model output", () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('{"a":{"b":[1,2]}} trailing')).toEqual({ a: { b: [1, 2] } });
  });
  it("removes citations that point to items that do not exist", () => {
    const r = { key_judgment: "Fact [1][9][B1][B4].", know: ["Another [2]", "Uncited statement"] };
    const { report, stats } = auditCitations(r, 3, 1, ["key_judgment", "know"]);
    expect(report.key_judgment).toBe("Fact [1][B1].");
    expect(stats.invalidRemoved).toBe(2);
    expect(stats.uncited.length).toBe(1);
  });
});

describe("confidence ceiling", () => {
  const base = { items: 20, independentStreams: 8, sourceTypes: 4, greenShare: 0.6, stateMediaItems: 0, pinned: 0, oldest: "", newest: "", byAggregator: {} } as never;
  it("allows high when evidence is broad", () => expect(confidenceCeiling(base).band).toBe("high"));
  it("caps at low with one stream", () => expect(confidenceCeiling({ ...(base as object), independentStreams: 1 } as never).band).toBe("low"));
  it("caps at moderate with thin streams", () => expect(confidenceCeiling({ ...(base as object), independentStreams: 3 } as never).band).toBe("moderate"));
  it("lowers a model claim that exceeds the ceiling", () => {
    const r = applyCeiling("high", { ...(base as object), items: 5 } as never);
    expect(r.capped).toBe(true);
    expect(r.band).toBe("moderate");
  });
});

describe("date handling never invents dates", () => {
  it("parses standard and Crisis Group style dates", () => {
    expect(validDate("Mon, 21 Sep 2026 15:56:00 GMT", NOW)).toBe("2026-09-21T15:56:00.000Z");
    expect(validDate("Monday, September 21, 2026 - 15:56", NOW)).toBe("2026-09-21T15:56:00.000Z");
  });
  it("rejects missing, garbage and stale dates", () => {
    expect(validDate(undefined, NOW)).toBeNull();
    expect(validDate("not a date", NOW)).toBeNull();
    expect(validDate("Fri, 14 Apr 2023 20:00:28 GMT", NOW)).toBeNull();
  });
  it("clamps far-future dates to now", () => {
    expect(validDate("2027-05-01T00:00:00Z", NOW)).toBe(NOW.toISOString());
  });
  it("drops items with no usable date", () => {
    expect(toArticle({ url: "https://example.com/a", title: "A headline long enough", aggregator: "rss", feedId: "x" }, NOW)).toBeNull();
  });
});

describe("feed parsing", () => {
  it("reads RSS 2.0", () => {
    const xml = `<rss><channel><item><title>Ceasefire talks resume in Sudan</title><link>https://ex.com/1</link><pubDate>Tue, 22 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
    const p = parseFeed(xml);
    expect(p[0].title).toContain("Sudan");
    expect(p[0].published).toContain("2026");
  });
  it("reads the date embedded in Drupal descriptions", () => {
    const xml = `<rss><channel><item><title>Report on rights</title><link>https://ex.org/2</link><description>&lt;span&gt;Report&lt;/span&gt;&lt;time datetime="2026-09-20T08:00:00+02:00"&gt;x&lt;/time&gt;&lt;p&gt;Body text here&lt;/p&gt;</description></item></channel></rss>`;
    const p = parseFeed(xml)[0];
    expect(p.published).toBe("2026-09-20T08:00:00+02:00");
    expect(p.excerpt).not.toContain("Report<");
  });
  it("reads Atom", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom item headline</title><link href="https://ex.com/3"/><updated>2026-09-22T09:00:00Z</updated></entry></feed>`;
    expect(parseFeed(xml)[0].url).toBe("https://ex.com/3");
  });
});

describe("url and geography", () => {
  it("strips tracking parameters", () => {
    expect(canonicalUrl("https://ex.com/a?utm_source=x&id=5&fbclid=z")).toBe("https://ex.com/a?id=5");
  });
  it("detects countries and avoids common false positives", () => {
    expect(detectCountries("Fighting spreads in Sudan and South Sudan")).toEqual(expect.arrayContaining(["SD", "SS"]));
    expect(detectCountries("Michael Jordan retires")).not.toContain("JO");
    expect(detectCountries("Talks in Tbilisi, Georgia over the vote")).toContain("GE");
    expect(detectCountries("Gaza ceasefire")).toContain("PS");
  });
  it("tags themes with inspectable rules", () => {
    expect(tagThemes("Airstrike kills civilians as offensive continues")).toContain("conflict");
    expect(tagThemes("Ransomware attack hits hospital network")).toContain("cyber");
  });
});

describe("session cookies", () => {
  const secret = "0123456789abcdef0123456789abcdef0123";
  it("round trips and rejects tampering", async () => {
    const { token } = await createSession(secret, "Nuri");
    expect((await verifySession(secret, token))?.analyst).toBe("Nuri");
    expect(await verifySession(secret, token.slice(0, -2) + "xx")).toBeNull();
    expect(await verifySession("another-secret-another-secret-123456", token)).toBeNull();
    expect(await verifySession(secret, undefined)).toBeNull();
  });
  it("compares codes safely", async () => {
    expect(await safeEqual("abc12345", "abc12345")).toBe(true);
    expect(await safeEqual("abc12345", "abc12346")).toBe(false);
  });
});
