---
title: First-party analytics, no cookie banner
description: A tiny Worker, one D1 table and nothing that needs consent.
date: 2026-10-02
tags: [Code, Analytics]
---

I wanted to know which photos people actually look at, without handing visitors to an ad network or putting a consent banner in front of the work.

## What gets sent

Four events: a page view, a photo that stayed on screen for a second, a video play and video progress at 25, 50, 75 and 100 percent. No cookies, no fingerprinting, and bots are dropped at the door.

```ts title="worker/event.ts"
app.post("/api/event", async (c) => {
  const e = await c.req.json();
  c.env.EVENTS.writeDataPoint({ blobs: [e.type, e.path], doubles: [1] });
  return c.body(null, 204);
});
```

Everything lands in Cloudflare's Analytics Engine and I read it back with plain SQL. That is the whole system.
