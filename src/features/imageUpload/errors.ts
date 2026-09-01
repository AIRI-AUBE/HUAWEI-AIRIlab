export class ImageUploadError extends Error {
    constructor(
        public readonly code:
            'format' | 'file-size' | 'dimensions' | 'aspect-ratio' | 'decode' | 'count' | 'upload',
        message: string,
        public readonly status?: number,
    ) {
        super(message);
        this.name = 'ImageUploadError';
    }
}

export const uploadHttpMessage = (status: number): string => {
    if (status === 400) return 'The image upload request is invalid.';
    if (status === 401) return 'Your session or API credentials are invalid.';
    if (status === 403) return 'You do not have permission to upload this image.';
    if (status === 404) return 'The image upload service was not found.';
    if (status === 429) return 'Too many uploads are in progress. Please try again shortly.';
    if (status === 500 || status === 502) return 'The image service is temporarily unavailable.';
    return 'Image upload failed. Please try again.';
};
