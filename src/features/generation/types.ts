export type Workflow44Reference = { url: string; tags?: string[] };

export type Workflow44Payload = {
    workflowId: '44';
    workflowVersion: 'V3';
    projectId: string;
    teamId: string;
    baseImage: string;
    imageType: string;
    prompt: string;
    referenceImage: Workflow44Reference[];
};

export type JobState = { status: string; message?: string };
export type GenerationResult = { outputs: Array<{ url: string; [key: string]: unknown }> };
