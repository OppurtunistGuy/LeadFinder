# Lead Finder

Finds foreign businesses that need short motion-graphics ads, and tracks them from first sighting to paid client.

## Status

- Phase 1: niche plan and research report (done)
- Phase 2: lead list with statuses (done)
- Phase 3: brand check, 8-point score with reasons, public contact (this branch)
- Phase 4: message writer and approval screen
- Phase 5: pipeline tracker and follow-ups

## How it works (free, no keys)

1. `brands/*.json` holds brands per niche and country. Each entry links to the public list it came from. Claude researches and updates these files.
2. The app opens each brand's own public website once (robots.txt respected), looks for ad tracking, homepage video, promotions, and a public email, then scores it out of 8.
3. The score is a set of signals from the website, not proof that ads are running. The "Why this score" panel says exactly what was seen.

Meta and the paid Claude API were removed on purpose. Nothing here costs money.

## Run it

```
npm install
npm start     # http://localhost:3000
npm test
```

## Rules the app follows

- Nothing is ever sent for you. You approve every message.
- Leads only come from brands listed in `brands/` and a website that really loaded.
- Ads and drafts make no health or results claims.
