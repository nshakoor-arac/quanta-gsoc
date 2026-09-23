// Local stand-in for the Inception chat completions API. Lets you test the whole app without a key or credits.
// Run:  npm run mock:mercury   then set INCEPTION_BASE_URL=http://localhost:4010/v1 and INCEPTION_API_KEY=test
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 4010);
const cite = (n) => `[${n}]`;

function conf() {
  return { band: "high", reasons: ["Several items agree " + cite(1), "Mixed source types " + cite(2), "Recent items " + cite(3)], flip_risks: ["A retraction of the lead report", "A single upstream behind most items", "New official statements"] };
}
const actions = [
  { horizon: "0-72H", action: "Review the lead items " + cite(1) },
  { horizon: "3-30D", action: "Collect one more independent source " + cite(2) },
  { horizon: "30-180D", action: "Refresh baselines after the next annual release" },
];
const indicators = [{ indicator: "Publication tempo", direction: "rising", threshold: "Doubling versus prior window", cadence: "Daily" }];

function sitrep() {
  return {
    title: "MOCK SITREP: EVIDENCE PIPELINE TEST OUTPUT",
    key_judgment: "This is a mock report used to test the console " + cite(1) + cite(2) + ".",
    threat_level: "elevated",
    threat_rationale: "Mock rationale " + cite(1) + ".",
    snapshot: [{ figure: "HIGH", label: "Coverage" }, { figure: "RISING", label: "Tempo" }, { figure: "LOW", label: "Diversity" }, { figure: "72 HRS", label: "Window" }],
    situation_overview: "Mock overview " + cite(1) + cite(2) + ".",
    key_developments: ["Development one " + cite(1), "Development two " + cite(2), "Development three " + cite(99)],
    assessment: "Mock assessment " + cite(3) + ".",
    strategic_implications: "Mock implications " + cite(1) + ".",
    priority_points: ["Point one " + cite(1), "Point two " + cite(2), "Point three " + cite(3)],
    actor_dynamics: ["Actor dynamic one " + cite(1), "Actor dynamic two " + cite(2)],
    risks: [{ risk: "Escalation " + cite(1), likelihood: 3, impact: 4, mitigant: "Monitor" }, { risk: "Disruption " + cite(2), likelihood: 2, impact: 3, mitigant: "Plan alternatives" }, { risk: "Misinformation", likelihood: 4, impact: 2, mitigant: "Verify" }],
    action_items: actions,
    collection_gaps: ["Gap one", "Gap two", "Gap three"],
    near_term_outlook: [
      { scenario: "best", probability_band: "Unlikely (20-45%)", description: "Calm " + cite(1), trigger: "Talks" },
      { scenario: "base", probability_band: "Likely (55-80%)", description: "Continuity " + cite(2), trigger: "None" },
      { scenario: "worst", probability_band: "Very unlikely (5-20%)", description: "Escalation " + cite(3), trigger: "Incident" },
    ],
    know: ["Fact one " + cite(1), "Fact two " + cite(2), "Fact three " + cite(3), "Fact four " + cite(1)],
    assess: ["Inference one " + cite(1), "Inference two " + cite(2), "Inference three " + cite(3)],
    unknown: ["Unknown one", "Unknown two", "Unknown three"],
    assumptions: [{ id: "A1", assumption: "Feeds stay available", why_it_matters: "Evidence base", risk_if_wrong: "Thin coverage" }],
    indicators,
    confidence: conf(),
  };
}

function compare(user) {
  const m = /TARGETS: (.+)/.exec(user);
  const names = m ? m[1].split(" | ").map((s) => s.trim()) : ["A", "B"];
  return {
    title: "MOCK COMPARISON: TARGETS DIFFER IN COVERAGE",
    key_judgment: "Mock comparative finding " + cite(1) + cite(2) + ".",
    threat_level: "moderate",
    targets: names.map((n, i) => ({ name: n, threat_level: i ? "low" : "moderate", rationale: "Rationale " + cite(i + 1) })),
    matrix: ["Armed violence", "Political unrest", "Humanitarian pressure", "Governance stress", "Economic stress"].map((d) => ({ dimension: d, cells: names.map((n, i) => ({ target: n, rating: i ? "low" : "moderate", note: "Note " + cite(i + 1) })) })),
    convergences: ["Shared pattern " + cite(1), "Shared pattern two " + cite(2)],
    divergences: ["Different pattern " + cite(1), "Different pattern two " + cite(2)],
    ranking: names.map((n, i) => ({ rank: i + 1, target: n, rationale: "Ranked " + cite(i + 1) })),
    implications: "Mock implications " + cite(1) + ".",
    action_items: actions,
    collection_gaps: ["Gap one", "Gap two", "Gap three"],
    know: ["Fact " + cite(1), "Fact two " + cite(2)],
    assess: ["Inference " + cite(1), "Inference two " + cite(2), "Inference three " + cite(1)],
    unknown: ["Unknown one", "Unknown two", "Unknown three"],
    indicators,
    confidence: conf(),
  };
}

function quick() {
  return {
    headline: "Mock quick analysis of the selected material " + cite(1) + ".",
    points: ["Point one " + cite(1), "Point two " + cite(1), "Point three " + cite(1)],
    five_w: { who: "Not stated", what: "Mock " + cite(1), where: "Not stated", when: "Not stated", why: "Not stated", how: "Not stated" },
    so_what: "Mock so what " + cite(1) + ".",
    watch: ["Watch one", "Watch two"],
    confidence: "high",
    caveats: ["Headline only", "Single stream", "Mock data"],
  };
}

function pick(body) {
  const sys = body.messages?.[0]?.content ?? "";
  const user = body.messages?.[1]?.content ?? "";
  const name = body.response_format?.json_schema?.name ?? "";
  if (name === "qap_compare" || /comparative assessment/i.test(user.slice(0, 200))) return compare(user);
  if (name === "qap_sitrep" || /executive SitRep as one/i.test(user.slice(0, 200))) return sitrep();
  return quick(sys);
}

http
  .createServer((req, res) => {
    if (req.url === "/health") return res.end("ok");
    if (req.method !== "POST" || !req.url.endsWith("/chat/completions")) {
      res.statusCode = 404;
      return res.end("not found");
    }
    if (!/^Bearer .+/.test(req.headers.authorization || "")) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: "no key" }));
    }
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      if (process.env.MOCK_REJECT_SCHEMA && body.response_format) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "response_format not supported" }));
      }
      const text = JSON.stringify(pick(body));
      const usage = { prompt_tokens: 1200, completion_tokens: Math.ceil(text.length / 4) };
      if (!body.stream) {
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }], usage }));
      }
      res.setHeader("Content-Type", "text/event-stream");
      const size = 90;
      for (let i = 0; i < text.length; i += size) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + size) } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ choices: [], usage })}\n\n`);
      res.end("data: [DONE]\n\n");
    });
  })
  .listen(PORT, () => console.log(`Mock Mercury listening on http://localhost:${PORT}/v1`));
