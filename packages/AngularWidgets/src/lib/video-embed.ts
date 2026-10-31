/**
 * The player URL a page's video block may embed, or null. Only a YouTube or Vimeo video, recognised by the parsed host
 * and a well-formed video id, is rewritten to that provider's own player URL; anything else (another site, a lookalike
 * host, a URL that merely mentions "youtube") is never framed.
 */
export function videoEmbedUrl(raw: string | null | undefined): string | null {
    let url: URL;
    try {
        url = new URL((raw ?? '').trim());
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
    const youTubeId = (id: string | null | undefined): string | null =>
        id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        if (url.pathname === '/watch') return youTubeId(url.searchParams.get('v'));
        return youTubeId(url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)\/?$/)?.[1]);
    }
    if (host === 'youtu.be') return youTubeId(url.pathname.match(/^\/([^/]+)\/?$/)?.[1]);
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        const id = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/)?.[1];
        return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
}
