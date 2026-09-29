const normalize = (path: string) => path.replace(/\/+$/, '') || '/';

/** Webflow marks links to the current page with aria-current and .w--current. */
export const isCurrentPath = (href: string, pathname: string) => normalize(href) === normalize(pathname);
