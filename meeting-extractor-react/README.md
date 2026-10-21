# Smart Meeting Action Extractor

**EP-01 · Team Xploits · Engagement Platforms Student Innovation Challenge**

Paste messy meeting notes and get a structured report: summary, decisions, action items (owner, due date, priority, status), risks, open questions and dependencies.

> **Core rule:** the app never invents missing owners, dates, decisions or facts. Anything missing is highlighted so a person can fill it in.

## Features

- **Notes input:** paste notes, load sample notes, or clear. Checks length (20 to 50,000 characters).
- **Extraction:** summary, confirmed decisions, action items with owner and due date, risks with evidence quotes, open questions, dependencies.
- **Editable action table:** change task, owner, due date, priority and status (Not Started / In Progress / Done).
- **Smart flags:** "No owner", "No deadline", and "OVERDUE" (only for explicit `YYYY-MM-DD` dates that have passed).
- **Export:** CSV (tasks), JSON (full report), printable report.
- **Usability:** responsive layout, loading state, clear error messages, empty states.

The header badge shows **Demo Mode**: extraction currently uses a built-in **rule-based** extractor, labelled "Rule-based (not AI)" in the results. It is never presented as AI output.

## Tech stack

- **Frontend:** React 18 + Vite
- **Backend:** Node.js 18+ (no backend dependencies)
- **Tests:** Node built-in test runner

## How it works

```
Browser (React UI) --POST /api/extract--> server.js (validates input) --> extractor.js (extraction + validation)
```

## Project structure

```
meeting-extractor-react/
├── client/          React source (src/App.jsx, src/styles.css)
├── dist/            Built frontend (served by server.js)
├── test/            Automated tests
├── extractor.js     Extraction logic and output validation
├── server.js        HTTP server and API
├── vite.config.js
├── .env.example     Optional AI configuration (not required)
└── package.json
```

## Run it

**Requirement:** [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm start
```

Open **http://localhost:3000**, click **Use sample notes**, then **Extract**.

(`dist/` is already built. If you change files in `client/`, run `npm run build` first.)

### Run the tests

```bash
npm test
```

8 backend tests: extraction rules, output validation, input validation, error handling.

### Development mode (hot reload)

Use two terminals:

```bash
npm start      # terminal 1: backend on :3000
npm run dev    # terminal 2: frontend on :5173
```

Open http://localhost:5173. Running only `npm run dev` gives `ECONNREFUSED`, because the backend must also be running.

## API

- `GET /api/health` → `{ "ok": true, "aiConfigured": false }`
- `POST /api/extract` with `{ "notes": "..." }` returns `source`, `summary`, `decisions`, `actions`, `risks`, `questions`, `dependencies`. Errors return `{ "error": "message" }`.

## Optional: plug in an AI model

The extraction layer is provider-independent. Any OpenAI-compatible chat API can be used by copying `.env.example` to `.env` and setting `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL`. The badge then shows **AI Connected**. This has not been tested with a real AI service yet.

## Safety

- Notes are not logged; API keys (if used) stay on the server.
- Output is validated; invalid dates and priorities are dropped.
- CSV export is protected against spreadsheet formula injection.
- 50,000-character input limit.

## Known limitations

- The rule-based extractor only understands simple lines like "Name will / to / needs to ...", and its summary is just a count.
- Relative dates ("Friday", "end of week") are shown as written, not converted or marked overdue.
- Edits are kept in the browser only; refreshing loses them. No database or login.

## Future improvements

Real AI extraction, relative-date resolution, saved meetings (SQLite), login, Jira/calendar export.

## 3-minute demo

1. Click **Use sample notes**, then **Extract**.
2. Show the summary counts and the "Demo Mode / Rule-based" label.
3. Show highlighted missing owner and deadline; fix one inline.
4. Change a task status; point out the OVERDUE flag on an explicit past date.
5. Show decisions and risks with evidence quotes.
6. Export **CSV**, **JSON**, and **Print**.
7. Run `npm test`.
