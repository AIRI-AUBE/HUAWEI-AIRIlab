export const appendUploadedImagesWithinLimit = <T>(
    existing: T[],
    incoming: T[],
    maxImages: number,
) => [...existing, ...incoming.slice(0, Math.max(0, maxImages - existing.length))];

export const enqueueLatestRequestStateUpdate = <T>({
    gate,
    request,
    enqueue,
    update,
}: {
    gate: { isCurrent: (request: number) => boolean };
    request: number;
    enqueue: (update: (current: T) => T) => void;
    update: (current: T) => T;
}) => {
    if (!gate.isCurrent(request)) return false;
    enqueue(update);
    return true;
};

export const deriveSettledUploadStatuses = (form: {
    baseImage?: unknown;
    referenceImages: unknown[];
}) => ({
    base: form.baseImage ? ('success' as const) : ('idle' as const),
    reference: form.referenceImages.length ? ('success' as const) : ('idle' as const),
});

export const stageTemplateUploads = async <TAsset, TUploaded>({
    baseAsset,
    referenceAssets,
    upload,
}: {
    baseAsset?: TAsset;
    referenceAssets: TAsset[];
    upload: (
        asset: TAsset,
        role: 'base-image' | 'reference-image',
        index: number,
    ) => Promise<TUploaded>;
}): Promise<{ baseImage?: TUploaded; referenceImages: TUploaded[] }> => {
    const [baseImage, referenceImages] = await Promise.all([
        baseAsset ? upload(baseAsset, 'base-image', 0) : Promise.resolve(undefined),
        Promise.all(referenceAssets.map((asset, index) => upload(asset, 'reference-image', index))),
    ]);
    return { baseImage, referenceImages };
};
