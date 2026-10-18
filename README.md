# Lead Finder

Finds foreign businesses that need short motion-graphics ads, and tracks them from first sighting to paid client.

## Status

- Phase 1: niche plan and research report (done)
- Phase 2: lead list, hiring-post finder, Meta Ad Library scout (done; live scouts untested until keys are added)
- Phase 3: scoring and contact finding (next)
- Phase 4: message writer and approval screen
- Phase 5: pipeline tracker and follow-ups

## Run it

```
npm install
cp .env.example .env     # then fill in the keys you have
npm start                # http://localhost:3000
npm test
```

## Keys (all go in `.env`, which is never committed)

- `ANTHROPIC_API_KEY`: live niche research and the hiring-post finder
- `META_ACCESS_TOKEN`, `META_APP_ID`, `META_APP_SECRET`: Meta Ad Library scout. The free API only covers ads delivered in the UK and EU, and needs ID confirmation at facebook.com/ads/library/api

## Rules the app follows

- Nothing is ever sent for you. You approve every message.
- Leads only come from pages that really appeared in search or API results.
- Ads and drafts make no health or results claims.
