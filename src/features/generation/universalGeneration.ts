import type { GenerationResult, JobState, Workflow44Payload } from './types';

const successStates = new Set([
    'completed',
    'complete',
    'success',
    'succeeded',
    'video_generation_complete',
    'video_generation_completed',
    'api complete',
    'api_complete',
]);
const failureStates = new Set([
    'failed',
    'failed-content',
    'video_generation_failed',
    'error',
    'interrupted',
    'file_download_aborted',
]);
const baseUrl = () => (import.meta.env.VITE_AIRI_API_BASE_URL ?? '').replace(/\/$/, '');
const delay = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const id = window.setTimeout(resolve, ms);
        signal?.addEventListener(
            'abort',
            () => {
                window.clearTimeout(id);
                reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
        );
    });

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const apiKey = import.meta.env.VITE_AIRI_API_KEY;
    const authToken = import.meta.env.VITE_AIRI_AUTH_TOKEN;
    const response = await fetch(`${baseUrl()}${path}`, {
        credentials: 'include',
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'X-AIRI-API-Key': apiKey } : {}),
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            ...init?.headers,
        },
    });
    if (!response.ok) {
        const error = new Error(`Generation request failed (${response.status}).`);
        Object.assign(error, { status: response.status });
        throw error;
    }
    return response.json() as Promise<T>;
};

export const generate = async (payload: Workflow44Payload, signal?: AbortSignal) => {
    const response = await request<{ jobId: string }>('/api/Universal/Generate', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal,
    });
    if (!response.jobId) throw new Error('The generation API did not return a job ID.');
    return response.jobId;
};

export const waitForResult = async (
    jobId: string,
    options: { signal?: AbortSignal; intervalMs?: number; timeoutMs?: number } = {},
): Promise<GenerationResult> => {
    const interval = options.intervalMs ?? 5000;
    const deadline = Date.now() + (options.timeoutMs ?? 10 * 60 * 1000);
    while (Date.now() < deadline) {
        const job = await request<JobState>(`/api/Universal/Job/${encodeURIComponent(jobId)}`, {
            signal: options.signal,
        });
        const status = job.status.trim().toLowerCase();
        if (failureStates.has(status)) throw new Error(job.message || 'Generation failed.');
        if (successStates.has(status)) {
            for (let attempt = 0; attempt < 4; attempt += 1) {
                try {
                    return await request<GenerationResult>(
                        `/api/Universal/Job/${encodeURIComponent(jobId)}/result`,
                        { signal: options.signal },
                    );
                } catch (error) {
                    if ((error as { status?: number }).status !== 404 || attempt === 3) throw error;
                    await delay(2000, options.signal);
                }
            }
        }
        await delay(interval, options.signal);
    }
    throw new Error('Generation timed out. Please check the job again later.');
};
