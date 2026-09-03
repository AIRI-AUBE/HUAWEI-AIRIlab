import { workflow44Config } from '../imageUpload/config';
import type { UploadedImage } from '../imageUpload/types';
import type { Workflow44Payload } from './types';

export const mapWorkflow44Payload = (input: {
    referenceImages: UploadedImage[];
    prompt: string;
    projectId?: string | number;
    teamId?: string | number;
}): Workflow44Payload => {
    const projectId = Number(input.projectId ?? import.meta.env.VITE_AIRI_PROJECT_ID);
    const teamId = Number(input.teamId ?? import.meta.env.VITE_AIRI_TEAM_ID);
    if (!Number.isInteger(projectId) || projectId < 1 || !Number.isInteger(teamId) || teamId < 0) {
        throw new Error('Valid numeric project and team configuration is required.');
    }
    if (input.referenceImages.length > workflow44Config.maxReferenceImages) {
        throw new Error('Workflow 44 accepts at most three reference images.');
    }
    return {
        workflowId: workflow44Config.workflowId,
        workflowVersion: workflow44Config.workflowVersion,
        projectId,
        teamId,
        prompt: input.prompt,
        aspectRatio: '16:9',
        orientation: 0,
        imageRatio: 3,
        referenceImage: input.referenceImages.map(({ url }) => ({ url })),
        language: 'chs',
    };
};
