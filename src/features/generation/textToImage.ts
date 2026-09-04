import type { TextToImagePayload } from './types';

export const mapTextToImagePayload = (input: {
    prompt: string;
    projectId?: string | number;
    teamId?: string | number;
}): TextToImagePayload => {
    const projectId = Number(input.projectId ?? import.meta.env.VITE_AIRI_PROJECT_ID);
    const teamId = Number(input.teamId ?? import.meta.env.VITE_AIRI_TEAM_ID);

    if (!Number.isInteger(projectId) || projectId < 1 || !Number.isInteger(teamId) || teamId < 0) {
        throw new Error('Valid numeric project and team configuration is required.');
    }

    return {
        workflowId: '44',
        workflowVersion: 'V3',
        projectId,
        teamId,
        prompt: input.prompt,
        aspectRatio: '16:9',
        orientation: 0,
        imageRatio: 3,
        referenceImage: [],
        language: 'chs',
    };
};
