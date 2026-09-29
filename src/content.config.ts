import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import { strapiLoader } from './lib/strapi';

// Set STRAPI_URL (and STRAPI_TOKEN if the API isn't public) to pull content
// from Strapi. Without it, the theme uses the bundled JSON in src/data.
const STRAPI_URL = import.meta.env.STRAPI_URL;
const STRAPI_TOKEN = import.meta.env.STRAPI_TOKEN;

const services = defineCollection({
  loader: STRAPI_URL
    ? strapiLoader('services', { url: STRAPI_URL, token: STRAPI_TOKEN })
    : file('src/data/services.json'),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    order: z.number().default(0),
    image: z.string(),
    cardSummary: z.string(),
    badge: z.string(),
    detailsSummary: z.string(),
    keyPoints: z.array(z.string()),
    price: z.string(),
    scopeCards: z.array(
      z.object({
        icon: z.string(),
        title: z.string(),
        description: z.string(),
      }),
    ),
  }),
});

const posts = defineCollection({
  loader: STRAPI_URL
    ? strapiLoader('posts', { url: STRAPI_URL, token: STRAPI_TOKEN })
    : file('src/data/posts.json'),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    order: z.number().default(0),
    image: z.string(),
    summary: z.string(),
    detailsSummary: z.string(),
    body: z.string(),
    featured: z.boolean().default(false),
    date: z.coerce.date(),
    category: z.string(),
    readTime: z.string(),
  }),
});

export const collections = { services, posts };
