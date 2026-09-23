export const maxExportBytes = 50 * 1024 * 1024;

export function originalImageUrl(output: { url: string }): string {
    const url = new URL(output.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('INVALID_URL');
    return url.href;
}

export async function inspectImage(blob: Blob): Promise<string> {
    if (!blob.size || blob.size > maxExportBytes) throw new Error('SIZE_LIMIT');
    const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return 'image/png';
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
    const text = String.fromCharCode(...bytes);
    if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') return 'image/webp';
    throw new Error('INVALID_IMAGE');
}

export function imageFilename(mime: string): string {
    return `AIRI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png'}`;
}
