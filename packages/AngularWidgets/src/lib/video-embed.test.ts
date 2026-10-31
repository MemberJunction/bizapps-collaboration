import { describe, expect, it } from 'vitest';
import { videoEmbedUrl } from './video-embed';

describe('videoEmbedUrl', () => {
    it.each([
        ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
        ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
        ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
        ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
        ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871'],
        ['https://player.vimeo.com/video/76979871', 'https://player.vimeo.com/video/76979871'],
    ])('embeds %s as its provider player', (url, embed) => {
        expect(videoEmbedUrl(url)).toBe(embed);
    });

    it.each([
        'https://evil.example/?youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
        'https://evil.example/youtu.be/dQw4w9WgXcQ',
        'https://vimeo.com.evil.example/76979871',
        'https://www.youtube.com/watch?v=<script>',
        'https://www.youtube.com/channel/abc123',
        'javascript:alert(1)//youtube.com',
        'not a url',
        '',
        null,
    ])('never frames %s', (url) => {
        expect(videoEmbedUrl(url)).toBeNull();
    });
});
