export type Workflow44Reference = { url: string };

export type Workflow44Payload = {
    workflowId: '44';
    workflowVersion: 'V3';
    projectId: number;
    teamId: number;
    prompt: string;
    aspectRatio: '16:9';
    orientation: 0;
    imageRatio: 3;
    referenceImage: Workflow44Reference[];
    language: 'chs';
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
