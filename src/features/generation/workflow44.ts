import { referenceImageTagPayloadValues } from '../../data/referenceImageTags';
import { workflow44Config } from '../imageUpload/config';
import type { UploadedImage } from '../imageUpload/types';
import type { Workflow44Payload } from './types';

export const mapWorkflow44Payload = (input: {
    baseImage?: UploadedImage;
    imageType?: string;
    referenceImages: UploadedImage[];
    prompt: string;
    projectId?: string | number;
    projectName?: string;
    teamId?: string | number;
    language?: 'en' | 'chs';
}): Workflow44Payload => {
    const projectId = Number(input.projectId ?? import.meta.env.VITE_AIRI_PROJECT_ID);
    const teamId = Number(input.teamId ?? import.meta.env.VITE_AIRI_TEAM_ID);
    if (!Number.isInteger(projectId) || projectId < 1 || !Number.isInteger(teamId) || teamId < 0) {
        throw new Error('Valid numeric project and team configuration is required.');
    }
    if (input.referenceImages.length > workflow44Config.maxReferenceImages) {
        throw new Error('Workflow 39 accepts at most three reference images.');
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
            categories: (tags ?? [])
                .map((tag) => referenceImageTagPayloadValues[tag])
                .filter((category): category is string => Boolean(category)),
        })),
        imageType: input.imageType ?? 'architecture',
        workflowId: 39,
        workflowVersion: workflow44Config.workflowVersion,
        enteredText: input.prompt,
        additionalPrompt: '',
        designLibraryName: 'No Style',
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
        prompt: input.prompt,
        privateModel: '',
        height: 816,
        width: 1456,
        quality: 'medium',
        angleIndex: 0,
        imageCount: 1,
        language: input.language ?? 'en',
    };
};
