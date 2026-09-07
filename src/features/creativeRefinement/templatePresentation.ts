type PreviewImage = {
    previewUrl: string;
    tags: string[];
};

type TemplatePresentationInput = {
    form: {
        baseImage?: Pick<PreviewImage, 'previewUrl'>;
        referenceImages: PreviewImage[];
    };
    activeReference: number;
    templateLoading: boolean;
    targetHasBaseImage: boolean;
    targetReferenceCount: number;
};

export const deriveTemplateAssetPresentation = ({
    form,
    activeReference,
    templateLoading,
    targetHasBaseImage,
    targetReferenceCount,
}: TemplatePresentationInput) => {
    if (templateLoading) {
        return {
            baseImages: [],
            referenceImages: [],
            activeTags: [],
            baseLoadingCount: targetHasBaseImage ? 1 : 0,
            referenceLoadingCount: targetReferenceCount,
        };
    }

    return {
        baseImages: form.baseImage ? [form.baseImage.previewUrl] : [],
        referenceImages: form.referenceImages.map((image) => image.previewUrl),
        activeTags: form.referenceImages[activeReference]?.tags ?? [],
        baseLoadingCount: 0,
        referenceLoadingCount: 0,
    };
};
