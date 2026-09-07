export const appendUploadedImagesWithinLimit = <T>(
    existing: T[],
    incoming: T[],
    maxImages: number,
) => [...existing, ...incoming.slice(0, Math.max(0, maxImages - existing.length))];

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
