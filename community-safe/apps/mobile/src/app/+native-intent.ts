// Liens universels : https://communitysafe.com/@julien?s=instagram → écran du créateur.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'https://communitysafe.com');
    const match = /^\/@([a-zA-Z0-9_.]{3,30})\/?$/.exec(url.pathname);
    if (match) {
      const source = url.searchParams.get('s');
      return `/creator/${match[1].toLowerCase()}${source ? `?s=${encodeURIComponent(source)}` : ''}`;
    }
    return path;
  } catch {
    return '/';
  }
}
