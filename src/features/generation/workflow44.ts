import { workflow44Config } from '../imageUpload/config';
import type { UploadedImage } from '../imageUpload/types';
import { referenceImageTagPayloadValues } from '../../data/referenceImageTags';
import type { Workflow44Payload } from './types';

export const mapWorkflow44Payload = (input: {
    baseImage: UploadedImage;
    referenceImages: UploadedImage[];
    imageType: string;
    prompt: string;
    projectId?: string;
    teamId?: string;
}): Workflow44Payload => {
    const projectId = input.projectId ?? import.meta.env.VITE_AIRI_PROJECT_ID;
    const teamId = input.teamId ?? import.meta.env.VITE_AIRI_TEAM_ID;
    if (!projectId || !teamId) throw new Error('Project and team configuration is required.');
    if (input.referenceImages.length > workflow44Config.maxReferenceImages) {
        throw new Error('Workflow 44 accepts at most three reference images.');
    }
    return {
        workflowId: workflow44Config.workflowId,
        workflowVersion: workflow44Config.workflowVersion,
        projectId,
        teamId,
        baseImage: input.baseImage.url,
        imageType: input.imageType,
        prompt: input.prompt,
        referenceImage: input.referenceImages.map(({ url, tags }) => ({
            url,
            ...(tags.length
                ? { tags: tags.map((tag) => referenceImageTagPayloadValues[tag] ?? tag) }
                : {}),
        })),
    };
};
