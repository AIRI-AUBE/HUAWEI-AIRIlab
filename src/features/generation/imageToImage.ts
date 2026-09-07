import {
    isReferenceImageCategory,
    toReferenceImagePayloadCategories,
} from '../../data/referenceImageTags';
import { imageToImageConfig } from '../imageUpload/config';
import type { UploadedImage } from '../imageUpload/types';
import type { ImageToImagePayload } from './types';

export const imageToImagePromptMaxLength = 6000;

export const hasRequiredImageToImageInputs = (input: {
    baseImage?: { url: string };
    referenceImages: Array<{ url: string }>;
}) =>
    Boolean(
        input.baseImage?.url &&
        input.referenceImages.length &&
        input.referenceImages.every(({ url }) => url),
    );

export type ImageToImageDisabledReason =
    | 'missingBaseAndReference'
    | 'missingBase'
    | 'missingReference'
    | 'uploading'
    | 'templateLoading'
    | 'generating';

export const getImageToImageDisabledReason = ({
    hasBaseImage,
    hasReferenceImages,
    templateLoading,
    uploadInProgress,
    generating,
}: {
    hasBaseImage: boolean;
    hasReferenceImages: boolean;
    templateLoading: boolean;
    uploadInProgress: boolean;
    generating: boolean;
}): ImageToImageDisabledReason | undefined => {
    if (generating) return 'generating';
    if (templateLoading) return 'templateLoading';
    if (uploadInProgress) return 'uploading';
    if (!hasBaseImage && !hasReferenceImages) return 'missingBaseAndReference';
    if (!hasBaseImage) return 'missingBase';
    if (!hasReferenceImages) return 'missingReference';
    return undefined;
};

export const mapImageToImagePayload = (input: {
    baseImage?: UploadedImage;
    imageType?: string;
    referenceImages: UploadedImage[];
    prompt?: string;
    projectId?: string | number;
    projectName?: string;
    teamId?: string | number;
    language?: 'en' | 'chs';
}): ImageToImagePayload => {
    const projectId = Number(input.projectId ?? import.meta.env.VITE_AIRI_PROJECT_ID);
    const teamId = Number(input.teamId ?? import.meta.env.VITE_AIRI_TEAM_ID);
    const prompt = input.prompt ?? '';
    const imageType = input.imageType ?? 'architecture';
    if (!Number.isInteger(projectId) || projectId < 1 || !Number.isInteger(teamId) || teamId < 0) {
        throw new Error('Valid numeric project and team configuration is required.');
    }
    if (!isReferenceImageCategory(imageType)) {
        throw new Error('Workflow 39 received an unsupported image category.');
    }
    if (!input.baseImage?.url) {
        throw new Error('Workflow 39 requires a base image.');
    }
    if (!input.referenceImages.length) {
        throw new Error('Workflow 39 requires at least one reference image.');
    }
    if (input.referenceImages.some(({ url }) => !url)) {
        throw new Error(
            'Workflow 39 requires a persisted reference image URL for every reference.',
        );
    }
    if (input.referenceImages.length > imageToImageConfig.maxReferenceImages) {
        throw new Error('Workflow 39 accepts at most three reference images.');
    }
    if (prompt.length > imageToImagePromptMaxLength) {
        throw new Error('Workflow 39 accepts prompts up to 6,000 characters.');
    }
    return {
        toolsetEntry: 1,
        toolsetLv2: 'explore',
        model: 39,
        'referenceUploadGroup-container': true,
        'prompt-container': true,
        __generationSettings: { exploreV3: {} },
        megapixels: 1,
        baseImage: input.baseImage?.url ?? '',
        referenceImage: input.referenceImages.map(({ url, tags }) => ({
            url,
            weight: 0,
            categories: toReferenceImagePayloadCategories(imageType, tags ?? []),
        })),
        imageType,
        workflowId: imageToImageConfig.workflowId,
        workflowVersion: imageToImageConfig.workflowVersion,
        enteredText: prompt,
        additionalPrompt: prompt,
        designLibraryName: '',
        designLibraryId: 99,
        firstTierName: 'No Style',
        firstTierId: 9999,
        secondTierName: 'No Style',
        secondTierId: 9999,
        styleId: 9999,
        cameraViewName: 'No Camera',
        cameraViewId: 9999,
        graphicStyleId: 9999,
        atmosphereId: 99,
        atmosphereType: '',
        orientation: -2,
        imageRatio: -2,
        additionalNegativePrompt: '',
        inputFidelityLevel: 0,
        controlLevel: 0,
        maskImage: '',
        originalImage: '',
        horizontalPercentage: 0,
        verticalPercentage: 0,
        firstFrame: '',
        imageTail: '',
        videoPrompt: 0,
        timeLapse: 0,
        cameraSpeed: 0,
        projectId,
        projectName:
            input.projectName ?? import.meta.env.VITE_AIRI_PROJECT_NAME ?? 'My Team Project 1',
        teamId,
        prompt,
        privateModel: '',
        height: 816,
        width: 1456,
        quality: 'medium',
        angleIndex: 0,
        imageCount: 1,
        language: input.language ?? 'en',
    };
};
