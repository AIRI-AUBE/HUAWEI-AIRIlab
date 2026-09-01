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
        previewUrl: uploaded.url,
        tags: [],
        uploadStatus: 'success',
        file,
        sourceType: 'user-upload',
    };
};

export const runTemplateImageUploadPipeline = async (
    assetUrl: string,
    role: ImageRole,
    onProgress?: UploadProgress,
    signal?: AbortSignal,
): Promise<UploadedImage> => {
    const response = await fetch(assetUrl, { signal });
    if (!response.ok) throw new Error(`Unable to load template asset (${response.status}).`);
    const blob = await response.blob();
    const extension =
        blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
    const file = new File([blob], `template-${role}.${extension}`, {
        type: blob.type || 'image/webp',
    });
    const uploaded = await runImageUploadPipeline(file, role, onProgress, signal);
    return { ...uploaded, sourceType: 'template' };
};

export const errorMessage = (error: unknown) =>
    error instanceof ImageUploadError ? error.message : 'Image upload failed. Please try again.';

export const disposeUploadedImage = (image?: UploadedImage) => {
    if (image?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(image.previewUrl);
};
