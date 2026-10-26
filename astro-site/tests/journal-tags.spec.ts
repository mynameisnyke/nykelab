import { expect, test } from "@playwright/test";

// A post's page links every one of its tags; each of those pages has to exist.
test("every tag link on every journal post resolves", async ({ request }) => {
  const list = await (await request.get("/journal")).text();
  const posts = [...new Set([...list.matchAll(/href="(\/journal\/[a-z0-9-]+)"/g)].map((m) => m[1]))].filter((h) => !/\/(tag|rss)/.test(h));
  expect(posts.length).toBeGreaterThan(0);
  const broken: string[] = [];
  for (const post of posts) {
    const html = await (await request.get(post)).text();
    for (const m of html.matchAll(/href="(\/journal\/tag\/[a-z0-9-]+)"/g)) {
      const r = await request.get(m[1]);
      if (r.status() !== 200) broken.push(`${post} -> ${m[1]} ${r.status()}`);
    }
  }
  expect(broken).toEqual([]);
});
