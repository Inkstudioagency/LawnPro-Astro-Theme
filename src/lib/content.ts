import { getCollection } from 'astro:content';

const byOrder = <T extends { data: { order: number } }>(a: T, b: T) => a.data.order - b.data.order;

export async function getServices() {
  return (await getCollection('services')).sort(byOrder).map((entry) => entry.data);
}

export async function getPosts() {
  return (await getCollection('posts')).sort(byOrder).map((entry) => entry.data);
}

export type Service = Awaited<ReturnType<typeof getServices>>[number];
export type Post = Awaited<ReturnType<typeof getPosts>>[number];

/** Matches Webflow's date format, e.g. "June 16, 2026". */
export const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export const serviceUrl = (slug: string) => `/service/${slug}`;
export const postUrl = (slug: string) => `/post/${slug}`;
