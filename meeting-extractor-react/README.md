# Smart Meeting Action Extractor

```
MeetingMind/
├── backend/    Node server + AI call (server.js, extractor.js, test/, .env)
└── frontend/   React UI (src/App.jsx, src/styles.css), builds to frontend/dist
```

## Run
1. `cd backend` → copy `.env.example` to `.env` and fill AI_BASE_URL, AI_API_KEY, AI_MODEL
2. `cd frontend` → `npm install` → `npm run build`
3. `cd backend` → `npm start` → open http://localhost:3000
Check http://localhost:3000/api/health : aiConfigured should be true.

Tests: `cd backend && npm test`
Frontend dev with hot reload: `cd frontend && npm run dev` (keep backend running).
