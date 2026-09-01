import { workflow44Config } from './config';
import { ImageUploadError } from './errors';
import type { ImageRole, UploadedImage, UploadProgress } from './types';
import { uploadImage } from './uploadService';
import { normalizeImage, validateImage } from './validation';

const createId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export const runImageUploadPipeline = async (
    file: File,
    role: ImageRole,
    onProgress?: UploadProgress,
    signal?: AbortSignal,
): Promise<UploadedImage> => {
    onProgress?.('validating');
    const rules = workflow44Config.rules[role];
    const dimensions = await validateImage(file, rules);
    const normalized = await normalizeImage(file, dimensions, rules.maxPixels);
    onProgress?.('uploading');
    const uploaded = await uploadImage(normalized, role, signal);
    onProgress?.('success');
    return {
        id: createId(),
        url: uploaded.url,
        mediaId: uploaded.mediaId,
        previewUrl: URL.createObjectURL(file),
        tags: [],
        uploadStatus: 'success',
        file,
    };
};

export const errorMessage = (error: unknown) =>
    error instanceof ImageUploadError ? error.message : 'Image upload failed. Please try again.';

export const disposeUploadedImage = (image?: UploadedImage) => {
    if (image?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(image.previewUrl);
};
