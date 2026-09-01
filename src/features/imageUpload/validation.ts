import type { ImageValidationRules } from './config';
import { ImageUploadError } from './errors';

export type ImageDimensions = { width: number; height: number };

const extensionOf = (name: string) => name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';

export const readImageDimensions = (file: File): Promise<ImageDimensions> =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        const finish = () => URL.revokeObjectURL(url);
        image.onload = () => {
            const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
            finish();
            if (!dimensions.width || !dimensions.height) {
                reject(
                    new ImageUploadError('decode', 'The image is corrupted or cannot be decoded.'),
                );
                return;
            }
            resolve(dimensions);
        };
        image.onerror = () => {
            finish();
            reject(new ImageUploadError('decode', 'The image is corrupted or cannot be decoded.'));
        };
        image.src = url;
    });

export const validateImage = async (file: File, rules: ImageValidationRules) => {
    const extension = extensionOf(file.name);
    if (!rules.extensions.includes(extension) || !rules.mimeTypes.includes(file.type)) {
        throw new ImageUploadError('format', 'Use a JPG, PNG, or WEBP image.');
    }
    if (rules.maxProcessedBytes && file.size > rules.maxProcessedBytes) {
        throw new ImageUploadError(
            'file-size',
            `The image must be smaller than ${Math.round(rules.maxProcessedBytes / 1024 / 1024)} MB.`,
        );
    }
    const dimensions = await readImageDimensions(file);
    const shortest = Math.min(dimensions.width, dimensions.height);
    if (shortest < rules.minSide) {
        throw new ImageUploadError(
            'dimensions',
            `The shortest image side must be at least ${rules.minSide}px.`,
        );
    }
    const ratio = dimensions.width / dimensions.height;
    if (rules.aspectRatio && (ratio < rules.aspectRatio.min || ratio > rules.aspectRatio.max)) {
        throw new ImageUploadError(
            'aspect-ratio',
            `The image aspect ratio must be between ${rules.aspectRatio.min} and ${rules.aspectRatio.max}.`,
        );
    }
    return dimensions;
};

export const normalizeImage = async (
    file: File,
    dimensions: ImageDimensions,
    maxPixels?: number,
): Promise<File> => {
    if (!maxPixels || dimensions.width * dimensions.height <= maxPixels) return file;
    const scale = Math.sqrt(maxPixels / (dimensions.width * dimensions.height));
    const width = Math.max(1, Math.floor(dimensions.width * scale));
    const height = Math.max(1, Math.floor(dimensions.height * scale));
    const source = URL.createObjectURL(file);
    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = () =>
                reject(new ImageUploadError('decode', 'The image cannot be processed.'));
            element.src = source;
        });
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new ImageUploadError('decode', 'The image cannot be processed.');
        context.drawImage(image, 0, 0, width, height);
        const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
                (value) =>
                    value
                        ? resolve(value)
                        : reject(new ImageUploadError('decode', 'The image cannot be processed.')),
                'image/jpeg',
                0.92,
            ),
        );
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
    } finally {
        URL.revokeObjectURL(source);
    }
};
