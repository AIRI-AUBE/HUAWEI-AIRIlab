import type { ImageRole } from './types';

export type ImageValidationRules = {
    extensions: readonly string[];
    mimeTypes: readonly string[];
    minSide: number;
    maxProcessedBytes?: number;
    maxPixels?: number;
    aspectRatio?: { min: number; max: number };
};

const shared = {
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    minSide: 240,
} as const;

export const workflow44Config = {
    workflowId: '44',
    workflowVersion: 'V3',
    maxReferenceImages: 3,
    rules: {
        'base-image': {
            ...shared,
            aspectRatio: { min: 0.428, max: 2.333 },
        },
        'reference-image': {
            ...shared,
            maxPixels: 2048 * 2048,
        },
    } as Record<ImageRole, ImageValidationRules>,
} as const;
