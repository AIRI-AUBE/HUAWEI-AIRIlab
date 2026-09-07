export type ReferenceImageCategory = 'architecture' | 'interior' | 'landscape' | 'urban';

export type ReferenceImageTag = {
    id: string;
    en: string;
    chs: string;
    payloadValue: string;
};

export const referenceImageTagsByCategory: Readonly<
    Record<ReferenceImageCategory, readonly ReferenceImageTag[]>
> = {
    architecture: [
        {
            id: 'architecture.design_approach',
            en: 'Design Approach',
            chs: '设计手法',
            payloadValue: 'design_language',
        },
        {
            id: 'architecture.facade_design',
            en: 'Façade Design',
            chs: '立面设计',
            payloadValue: 'facade_or_interface',
        },
        {
            id: 'architecture.materials_construction',
            en: 'Materials & Details',
            chs: '材料构造',
            payloadValue: 'material',
        },
        {
            id: 'architecture.site_context',
            en: 'Site Context',
            chs: '场地配景',
            payloadValue: 'surrounding_context',
        },
        {
            id: 'architecture.lighting_atmosphere',
            en: 'Lighting & Atmosphere',
            chs: '光影氛围',
            payloadValue: 'lighting_atmosphere',
        },
        {
            id: 'architecture.visual_style',
            en: 'Visual Style',
            chs: '图像风格',
            payloadValue: 'visualization_style',
        },
    ],
    interior: [
        {
            id: 'interior.spatial_design',
            en: 'Spatial Strategy',
            chs: '空间手法',
            payloadValue: 'design_language',
        },
        {
            id: 'interior.materials_finishes',
            en: 'Materials & Finishes',
            chs: '材质饰面',
            payloadValue: 'material',
        },
        {
            id: 'interior.interior_surfaces',
            en: 'Interior Surfaces',
            chs: '界面硬装',
            payloadValue: 'facade_or_interface',
        },
        {
            id: 'interior.furnishings_decor',
            en: 'Furnishings & Décor',
            chs: '陈设软装',
            payloadValue: 'surrounding_context',
        },
        {
            id: 'interior.lighting_atmosphere',
            en: 'Lighting & Atmosphere',
            chs: '光影氛围',
            payloadValue: 'lighting_atmosphere',
        },
        {
            id: 'interior.visual_style',
            en: 'Visual Style',
            chs: '图像风格',
            payloadValue: 'visualization_style',
        },
    ],
    landscape: [
        {
            id: 'landscape.landscape_design',
            en: 'Landscape Strategy',
            chs: '景观策略',
            payloadValue: 'design_language',
        },
        {
            id: 'landscape.materials_planting',
            en: 'Materials & Planting',
            chs: '材料植物',
            payloadValue: 'material',
        },
        {
            id: 'landscape.site_surfaces',
            en: 'Site Interfaces',
            chs: '场地界面',
            payloadValue: 'facade_or_interface',
        },
        {
            id: 'landscape.people_activities',
            en: 'People & Activities',
            chs: '配景活动',
            payloadValue: 'surrounding_context',
        },
        {
            id: 'landscape.light_seasonality',
            en: 'Light & Atmosphere',
            chs: '光影氛围',
            payloadValue: 'lighting_atmosphere',
        },
        {
            id: 'landscape.visual_style',
            en: 'Visual Style',
            chs: '图像风格',
            payloadValue: 'visualization_style',
        },
    ],
    urban: [
        {
            id: 'urban.urban_design_approach',
            en: 'Urban Strategy',
            chs: '规划策略',
            payloadValue: 'design_language',
        },
        {
            id: 'urban.street_block_frontages',
            en: 'Street & Block Edges',
            chs: '街区界面',
            payloadValue: 'facade_or_interface',
        },
        {
            id: 'urban.material_system',
            en: 'Material System',
            chs: '材质系统',
            payloadValue: 'material',
        },
        {
            id: 'urban.context_transportation',
            en: 'Context & Mobility',
            chs: '背景交通',
            payloadValue: 'surrounding_context',
        },
        {
            id: 'urban.urban_atmosphere',
            en: 'Light & Atmosphere',
            chs: '光影氛围',
            payloadValue: 'lighting_atmosphere',
        },
        {
            id: 'urban.visual_style',
            en: 'Visual Style',
            chs: '图像风格',
            payloadValue: 'visualization_style',
        },
    ],
};

export const isReferenceImageCategory = (value: unknown): value is ReferenceImageCategory =>
    typeof value === 'string' && Object.hasOwn(referenceImageTagsByCategory, value);

export const getReferenceImageTags = (category: ReferenceImageCategory) =>
    referenceImageTagsByCategory[category];

export const referenceImageTags = getReferenceImageTags('architecture');

export const referenceImagePayloadCategoryOrder = [
    'design_language',
    'facade_or_interface',
    'material',
    'lighting_atmosphere',
    'visualization_style',
    'surrounding_context',
] as const;

export const toReferenceImagePayloadCategories = (
    category: unknown,
    selectedTagIds: string[],
): string[] => {
    if (!isReferenceImageCategory(category)) {
        return [];
    }

    const selectedIds = new Set(selectedTagIds);
    const selectedPayloadValues = new Set(
        getReferenceImageTags(category)
            .filter(({ id }) => selectedIds.has(id))
            .map(({ payloadValue }) => payloadValue),
    );

    return referenceImagePayloadCategoryOrder.filter((payloadValue) =>
        selectedPayloadValues.has(payloadValue),
    );
};

export const getDefaultReferenceImageTagIds = (
    category: ReferenceImageCategory,
    referenceIndex: number,
) => {
    const tagIds = getReferenceImageTags(category).map(({ id }) => id);
    return referenceIndex === 0 ? tagIds : tagIds.slice(0, 1);
};

export const appendReferenceImage = <T extends { tags: string[] }>(
    references: T[],
    reference: T,
    category: ReferenceImageCategory,
): T[] => [
    ...references,
    {
        ...reference,
        tags: getDefaultReferenceImageTagIds(category, references.length),
    },
];

export const toggleReferenceImageTag = (
    selectedIds: string[],
    tagId: string,
    availableTagIds: string[],
): string[] => {
    const availableIds = new Set(availableTagIds);
    const normalizedSelected = availableTagIds.filter((id) => selectedIds.includes(id));
    if (!availableIds.has(tagId)) return normalizedSelected;
    if (!normalizedSelected.includes(tagId)) {
        return availableTagIds.filter((id) => id === tagId || normalizedSelected.includes(id));
    }
    return normalizedSelected.length === 1
        ? normalizedSelected
        : normalizedSelected.filter((id) => id !== tagId);
};

export const resetReferenceImageTags = <T extends { tags: string[] }>(
    references: T[],
    category: ReferenceImageCategory,
): T[] =>
    references.map((reference, index) => ({
        ...reference,
        tags: getDefaultReferenceImageTagIds(category, index),
    }));

export const changeReferenceImageCategory = <
    T extends {
        baseImageType: ReferenceImageCategory;
        baseImage?: { sourceType?: string };
        referenceImages: Array<{ tags: string[]; sourceType?: string }>;
        categoryNotice?: ReferenceImageCategory;
    },
>(
    form: T,
    category: ReferenceImageCategory,
    options: { removeTemplateAssets?: boolean } = {},
): { form: T; changed: boolean } => {
    if (form.baseImageType === category) return { form, changed: false };

    const referenceImages = options.removeTemplateAssets
        ? form.referenceImages.filter(({ sourceType }) => sourceType !== 'template')
        : form.referenceImages;
    return {
        form: {
            ...form,
            baseImageType: category,
            baseImage:
                options.removeTemplateAssets && form.baseImage?.sourceType === 'template'
                    ? undefined
                    : form.baseImage,
            referenceImages: resetReferenceImageTags(referenceImages, category),
            categoryNotice: referenceImages.length ? category : undefined,
        } as T,
        changed: true,
    };
};

const legacyPayloadValues: Readonly<Record<string, string>> = {
    'design-techniques': 'design_language',
    'facade-design': 'facade_or_interface',
    'materials-construction': 'material',
    'site-landscaping': 'surrounding_context',
    'light-atmosphere': 'lighting_atmosphere',
    'image-style': 'visualization_style',
};

export const referenceImageTagPayloadValues: Readonly<Record<string, string>> = {
    ...legacyPayloadValues,
    ...Object.fromEntries(
        Object.values(referenceImageTagsByCategory)
            .flat()
            .map(({ id, payloadValue }) => [id, payloadValue]),
    ),
};
