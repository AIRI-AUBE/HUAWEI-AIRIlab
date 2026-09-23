import { Capacitor, registerPlugin } from '@capacitor/core';
import { imageFilename, inspectImage, maxExportBytes, originalImageUrl } from './imageFile';

type ExportResult = {
    status: 'saved' | 'downloadStarted' | 'shareOpened' | 'cancelled';
    filename?: string;
};
const native = registerPlugin<{
    exportImage(options: { url: string; action: string }): Promise<ExportResult>;
}>('ImageExport');

export async function exportImage(
    output: { url: string },
    action: 'save' | 'share',
): Promise<ExportResult> {
    const url = originalImageUrl(output);
    if (Capacitor.getPlatform() === 'android') return native.exportImage({ url, action });
    if (action === 'share') {
        if (!navigator.share) throw new Error('SHARE_UNAVAILABLE');
        try {
            await navigator.share({ title: 'AIRI', url });
            return { status: 'shareOpened' };
        } catch (error) {
            if ((error as Error).name === 'AbortError') return { status: 'cancelled' };
            throw error;
        }
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    try {
        // Image URLs carry their own access policy; never forward the AIRI API token.
        const response = await fetch(url, {
            signal: controller.signal,
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
        });
        if (!response.ok || !response.body) throw new Error('DOWNLOAD_FAILED');
        if (Number(response.headers.get('content-length')) > maxExportBytes)
            throw new Error('SIZE_LIMIT');
        const reader = response.body.getReader();
        const parts: Uint8Array<ArrayBuffer>[] = [];
        let total = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                total += value.byteLength;
                if (total > maxExportBytes) throw new Error('SIZE_LIMIT');
                parts.push(new Uint8Array(value));
            }
        } finally {
            await reader.cancel();
        }
        const data = new Blob(parts);
        const mime = await inspectImage(data);
        const filename = imageFilename(mime);
        const local = URL.createObjectURL(new Blob([data], { type: mime }));
        const link = document.createElement('a');
        link.href = local;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(local), 60000);
        return { status: 'downloadStarted', filename };
    } finally {
        controller.abort();
        window.clearTimeout(timeout);
    }
}
