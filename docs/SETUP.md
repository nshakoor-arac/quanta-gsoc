# Setup guide: from download to a live console

You will use four websites and no command line. Budget about 45 minutes the first time.

You need accounts at: GitHub, Vercel, Supabase, and Inception Labs. GitHub Desktop is the free app you will use to upload the code.

Keep a text file open while you work. You will collect a few values in it (marked **SAVE THIS**).

---

## Part 1. Put the code on GitHub (GitHub Desktop)

1. Unzip `quanta-gsoc.zip`. You get a folder named `quanta-gsoc`.
2. Open **GitHub Desktop** and sign in.
3. Choose **File > Add local repository**. Click **Choose...** and select the `quanta-gsoc` folder.
4. GitHub Desktop says the folder is not a repository. Click **create a repository**. Leave the defaults and click **Create repository**.
5. Click **Commit to main** (bottom left). If it asks for a summary, type `Initial commit`.
6. Click **Publish repository** (top bar). Keep **Keep this code private** ticked. Name it `quanta-gsoc`. Click **Publish repository**.

Check: open github.com, find `quanta-gsoc` in your repositories, and confirm you can see folders named `src`, `docs` and `supabase`.

Web browser alternative: on github.com choose **New repository**, name it, then **uploading an existing file** and drag the contents of the folder in. GitHub Desktop is more reliable for this many files.

---

## Part 2. Create the database (Supabase)

1. Go to supabase.com and choose **New project**. Pick a name, a strong database password, and the region closest to you. Wait until the project finishes setting up.
2. In the left menu open **SQL Editor** and choose **New query**.
3. On GitHub, open `supabase/migrations/001_init.sql`, click the **Copy raw file** icon, and paste it into the query box. Click **Run**. You should see "Success".
4. In the left menu open **Project Settings > API** (on some layouts, **Data API** and **API Keys**).
   - Copy the **Project URL**. **SAVE THIS** as `SUPABASE_URL`.
   - Copy the **service_role** key (the secret one, not the anon key). **SAVE THIS** as `SUPABASE_SERVICE_ROLE_KEY`.

The service_role key is a master key. Never paste it into a chat, a public file or a web page. The app uses it only on the server.

---

## Part 3. Get the AI key (Inception Labs)

1. Sign in to the Inception Labs platform and create an API key. **SAVE THIS** as `INCEPTION_API_KEY`.
2. Check their documentation for the exact model name of Mercury 2.5. The app assumes `mercury-2.5`. If their name differs, you will put the correct name in `INCEPTION_MODEL` in Part 4.
3. Set a spending limit in their dashboard if one is offered.

---

## Part 4. Deploy on Vercel

1. Go to vercel.com and sign in with GitHub.
2. Choose **Add New > Project**. Find `quanta-gsoc` and click **Import**.
3. Leave the framework as **Next.js**. Open **Environment Variables** and add each row below (name on the left, value on the right).

| Name | Value |
|---|---|
| `APP_ACCESS_CODE` | A passphrase your team will type to sign in. 12 or more characters. |
| `SESSION_SECRET` | 40 or more random characters. Use your password manager's generator. |
| `INCEPTION_API_KEY` | From Part 3 |
| `INCEPTION_MODEL` | `mercury-2.5` (or the name from their docs) |
| `SUPABASE_URL` | From Part 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | From Part 2 |
| `AI_DAILY_LIMIT` | `80` (maximum AI calls per rolling 24 hours, all analysts combined) |
| `CRON_SECRET` | Any 30 or more random characters. Enables the daily refresh. |
| `RELIEFWEB_APPNAME` | Optional. See Part 6. |

4. Click **Deploy**. Wait for the confetti screen, then click **Continue to Dashboard** and open the site address.
5. Sign in with your access code.

If you see "Server is not configured", `APP_ACCESS_CODE` or `SESSION_SECRET` is missing or too short. Add or fix it under **Settings > Environment Variables**, then **Deployments > the three dots > Redeploy**.

---

## Part 5. Check that everything works

Open the **Sources** tab.

- Every configuration row should show a green tick except the optional ones. "Database" must say Supabase.
- Click **Refresh RSS feeds**. Feed health shows which feeds loaded. A few red rows are normal because some outlets block automated readers or publish rarely.
- Open **Reports**, choose Single SitRep, Country, pick a country that appears often on the Dashboard, and click **Generate report**. A report should stream in and appear in Saved reports.

If the report step fails with a message about the AI service, the message names the cause (bad key, rate limit, billing). If it says the request failed with status 400 or 422 and mentions a parameter, send me that text so I can adjust the request format to Inception's exact requirements.

---

## Part 6. Optional extras

**ReliefWeb.** Request an app name at apidoc.reliefweb.int, wait for approval, then add it as `RELIEFWEB_APPNAME` in Vercel and redeploy. Without it the app skips ReliefWeb.

**Daily refresh.** With `CRON_SECRET` set, Vercel refreshes the feeds every day at 06:00 UTC. The app also refreshes itself when someone opens it and the data is more than 12 minutes old. Vercel's free plan allows only daily schedules, which is what this uses.

**Custom domain.** In Vercel, **Settings > Domains**.

**Long reports time out.** On Vercel's free plan, function time is limited. In the report generator choose **Reasoning: fast** to shorten generation.

---

## Updating the app later

Edit files in the folder, open GitHub Desktop, write a short summary, click **Commit to main**, then **Push origin**. Vercel redeploys automatically.

---

## How to read a report

1. The bottom line up front is one cited sentence.
2. Numbers in gold, such as 3 or B1, jump to the reference register at the bottom. Each entry links to the original source.
3. Know is what sources state. Assess is analyst-style inference. Unknown is what is missing.
4. If the confidence line says the model was capped, the evidence base was thinner than the model believed.
5. Bands in the register are provisional. Confirm or override them before sending a report outside your team. Reports need analyst review before release.

## Cost control

Each report, comparison or quick analysis counts as one AI call. The daily limit stops runs beyond `AI_DAILY_LIMIT`. The Sources tab shows current use.

## Security notes

- Everyone shares one access code. Change it in Vercel when a person leaves.
- Only the server holds the AI and database keys. Nothing secret is sent to the browser.
- Database tables have row level security switched on with no public policies, so only the server key can read them.
- Failed sign-ins are rate limited.
