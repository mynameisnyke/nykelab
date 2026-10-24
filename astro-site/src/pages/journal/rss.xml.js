import rss from "@astrojs/rss";
import { getPosts } from "../../lib/journal";

export async function GET(context) {
  const posts = await getPosts();
  return rss({
    title: "nykelab journal",
    description: "Writing about code, cameras and the tools in between.",
    site: context.site,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: `/journal/${p.id}/`,
      categories: p.data.tags,
    })),
  });
}
