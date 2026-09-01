import { ImageUploadError, uploadHttpMessage } from './errors';
import type { ImageRole } from './types';

type UploadResponse = {
    status?: number;
    data?: string | { path?: string; mediaId?: string };
    path?: string;
    mediaId?: string;
};

const apiBase = () => (import.meta.env.VITE_AIRI_API_BASE_URL ?? '').replace(/\/$/, '');
const uploadPath = () =>
    import.meta.env.VITE_AIRI_UPLOAD_PATH ?? '/api/GenerateWorkflow/UploadMedia';

const parseUpload = (body: UploadResponse): { url: string; mediaId?: string } => {
    const data = body.data;
    const url = typeof data === 'string' ? data : (data?.path ?? body.path);
    const mediaId = typeof data === 'object' ? data.mediaId : body.mediaId;
    if (!url) throw new ImageUploadError('upload', 'The upload completed without an image URL.');
    return { url, mediaId };
};

export const uploadImage = async (file: File, role: ImageRole, signal?: AbortSignal) => {
    const form = new FormData();
    form.append('myFile', file, file.name);
    form.append('imagePart', role);
    const teamId = import.meta.env.VITE_AIRI_TEAM_ID;
    const authToken = import.meta.env.VITE_AIRI_AUTH_TOKEN;
    if (teamId) form.append('teamId', teamId);

    let lastError: unknown;
    for (let attempt = 0; attempt <= 2; attempt += 1) {
        try {
            const response = await fetch(`${apiBase()}${uploadPath()}`, {
                method: 'POST',
                body: form,
                credentials: 'omit',
                headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
                signal,
            });
            if (!response.ok)
                throw new ImageUploadError(
                    'upload',
                    uploadHttpMessage(response.status),
                    response.status,
                );
            const body = (await response.json()) as UploadResponse;
            if (body.status && body.status !== 200) {
                throw new ImageUploadError('upload', uploadHttpMessage(body.status), body.status);
            }
            return parseUpload(body);
        } catch (error) {
            lastError = error;
            const status = error instanceof ImageUploadError ? error.status : undefined;
            const retryable = status === undefined || status >= 500;
            if (!retryable || attempt === 2 || signal?.aborted) break;
            await new Promise((resolve) => window.setTimeout(resolve, 1000));
        }
    }
    if (lastError instanceof ImageUploadError) throw lastError;
    throw new ImageUploadError(
        'upload',
        'Image upload failed. Check your connection and try again.',
    );
};
