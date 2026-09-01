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
export type GenerationOutput = {
    mediaId?: number | string;
    url: string;
    thumbnail?: string;
    width?: number;
    height?: number;
    createdAt?: string;
    [key: string]: unknown;
};
export type GenerationResult = { outputs: GenerationOutput[] };
