import type { Loader } from 'astro/loaders';

/**
 * Loads a Strapi 5 collection type into an Astro content collection.
 *
 * Strapi returns relations, components and media in its own shape; `normalize`
 * maps each entry onto the same fields the local JSON files use, so pages never
 * need to know where the content came from.
 */

type StrapiMedia = { url: string } | null | undefined;

// Minimal shape of Strapi's Blocks rich-text field.
type TextNode = { type: 'text'; text: string; bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean; code?: boolean };
type LinkNode = { type: 'link'; url: string; children: InlineNode[] };
type InlineNode = TextNode | LinkNode;
type Block =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'heading'; level: number; children: InlineNode[] }
  | { type: 'quote'; children: InlineNode[] }
  | { type: 'list'; format: 'ordered' | 'unordered'; children: { type: 'list-item'; children: InlineNode[] }[] }
  | { type: 'image'; image: { url: string; alternativeText?: string | null } }
  | { type: 'code'; children: InlineNode[] };

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderInline(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'link') return `<a href="${escapeHtml(node.url)}">${renderInline(node.children)}</a>`;
      let html = escapeHtml(node.text);
      if (node.code) html = `<code>${html}</code>`;
      if (node.bold) html = `<strong>${html}</strong>`;
      if (node.italic) html = `<em>${html}</em>`;
      if (node.underline) html = `<u>${html}</u>`;
      if (node.strikethrough) html = `<s>${html}</s>`;
      return html;
    })
    .join('');
}

/** Renders Strapi Blocks to the same HTML Webflow's rich text produced. */
export function blocksToHtml(blocks: Block[] | string | null | undefined, baseUrl = ''): string {
  if (!blocks) return '';
  if (typeof blocks === 'string') return blocks;
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
          // Webflow keeps empty paragraphs as zero-width-joiner spacers.
          return `<p>${renderInline(block.children) || '‍'}</p>`;
        case 'heading':
          return `<h${block.level}>${renderInline(block.children)}</h${block.level}>`;
        case 'quote':
          return `<blockquote>${renderInline(block.children)}</blockquote>`;
        case 'list': {
          const tag = block.format === 'ordered' ? 'ol' : 'ul';
          return `<${tag}>${block.children.map((item) => `<li>${renderInline(item.children)}</li>`).join('')}</${tag}>`;
        }
        case 'image':
          return `<figure class="w-richtext-align-normal w-richtext-figure-type-image"><div><img src="${escapeHtml(mediaUrl(block.image, baseUrl))}" alt="${escapeHtml(block.image.alternativeText ?? '')}" loading="lazy"></div></figure>`;
        case 'code':
          return `<pre><code>${renderInline(block.children)}</code></pre>`;
        default:
          return '';
      }
    })
    .join('');
}

function mediaUrl(media: StrapiMedia, baseUrl: string): string {
  if (!media?.url) return '';
  return media.url.startsWith('http') ? media.url : `${baseUrl}${media.url}`;
}

type Collection = 'services' | 'posts';

const POPULATE: Record<Collection, string> = {
  services: 'populate[image]=true&populate[keyPoints]=true&populate[scopeCards][populate][icon]=true',
  posts: 'populate[image]=true',
};

function normalize(collection: Collection, entry: Record<string, any>, baseUrl: string) {
  if (collection === 'services') {
    return {
      title: entry.title,
      slug: entry.slug,
      order: entry.order ?? 0,
      image: mediaUrl(entry.image, baseUrl),
      cardSummary: entry.cardSummary ?? '',
      badge: entry.badge ?? '',
      detailsSummary: entry.detailsSummary ?? '',
      keyPoints: (entry.keyPoints ?? []).map((point: { text: string }) => point.text),
      price: entry.price ?? '',
      scopeCards: (entry.scopeCards ?? []).map((card: Record<string, any>) => ({
        icon: mediaUrl(card.icon, baseUrl),
        title: card.title,
        description: card.description ?? '',
      })),
    };
  }
  return {
    title: entry.title,
    slug: entry.slug,
    order: entry.order ?? 0,
    image: mediaUrl(entry.image, baseUrl),
    summary: entry.summary ?? '',
    detailsSummary: entry.detailsSummary ?? '',
    body: blocksToHtml(entry.body, baseUrl),
    featured: Boolean(entry.featured),
    date: entry.date,
    category: entry.category ?? '',
    readTime: entry.readTime ?? '',
  };
}

export function strapiLoader(collection: Collection, options: { url: string; token?: string }): Loader {
  const baseUrl = options.url.replace(/\/$/, '');
  return {
    name: `strapi-${collection}`,
    async load({ store, parseData, logger }) {
      const headers: Record<string, string> = {};
      if (options.token) headers.Authorization = `Bearer ${options.token}`;

      const entries: Record<string, any>[] = [];
      for (let page = 1; ; page++) {
        const url = `${baseUrl}/api/${collection}?${POPULATE[collection]}&sort=order:asc&pagination[page]=${page}&pagination[pageSize]=100`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Strapi request failed (${res.status} ${res.statusText}): ${url}`);
        const json = await res.json();
        entries.push(...json.data);
        if (page >= (json.meta?.pagination?.pageCount ?? 1)) break;
      }

      store.clear();
      for (const entry of entries) {
        const data = normalize(collection, entry, baseUrl);
        store.set({ id: data.slug, data: await parseData({ id: data.slug, data }) });
      }
      logger.info(`Loaded ${entries.length} ${collection} from Strapi`);
    },
  };
}
