# Quanta Analytica GSOC

Global Security Operations Console. A private web app for security and geopolitical risk analysts that:

- collects open-source news from about 30 curated feeds and ReliefWeb, with GDELT retained as a supplemental discovery source;
- tags every item by country, region and theme with transparent keyword rules;
- shows coverage on a world map, in analytics views and in a searchable News Network aggregator with click-through to each source;
- generates Quanta Analytica Process (QAP) executive SitReps and 2 to 4 target comparisons with Inception Mercury 2.5, for a country, a region, a theme or the whole stream;
- offers quick AI analysis of a single article, a country or the current filtered feed;
- saves every report with a numbered reference register.

Produced under the Quanta Analytica Process | MNS Consulting workflow, in partnership with ARAC International Inc.

**Start here: [docs/SETUP.md](docs/SETUP.md)** (step by step, no command line needed for going live).

## Analytic controls built into the app

| Control | What it does |
|---|---|
| Evidence-only prompts | The model may cite only the numbered items it is given. Evidence text is treated as untrusted data. |
| Citation audit | Citation markers that point to items that do not exist are removed. Uncited statements are counted and reported. |
| Independence test | Outlets that draw on one upstream count as one stream. State-affiliated media are excluded from the count. |
| Confidence ceiling | The app caps the model's confidence when there are too few items or independent streams, and says so in the report. |
| Provisional source bands | Green, Amber and Red come from a source register and are labelled provisional. Analysts confirm or override them. |
| Baselines kept separate | World Bank governance scores and HDX HAPI humanitarian/conflict indicators are shown as contextual data, never as current-event article evidence. |
| Volume is not severity | Maps and charts carry this warning. |
| House style | Reports contain no em or en dashes. The exporter enforces this. |

## Known limits

- Evidence is headlines and short excerpts, not full article text.
- Country and theme tags are keyword rules. They are inspectable and will sometimes be wrong.
- The Mercury connection follows the common chat-completions format. Confirm it with your key (Sources tab shows status) before relying on it.
- Without Supabase the app keeps data in memory only, and it resets on each restart.

## Local development

    npm install
    cp .env.example .env.local     # then edit it
    npm run dev                    # http://localhost:3000

Test without spending AI credits:

    npm run mock:mercury           # fake Inception server on port 4010
    # in .env.local set INCEPTION_API_KEY=test and INCEPTION_BASE_URL=http://localhost:4010/v1
    npm test                       # unit tests
    npm run smoke                  # end-to-end check of a running app
