export type ReferenceImageTag = {
    id: string;
    en: string;
    chs: string;
};

export const referenceImageTags: readonly ReferenceImageTag[] = [
    { id: 'design-techniques', en: 'Design Techniques', chs: '设计手法' },
    { id: 'facade-design', en: 'Facade Design', chs: '立面设计' },
    {
        id: 'materials-construction',
        en: 'Materials & Construction',
        chs: '材料构造',
    },
    { id: 'site-landscaping', en: 'Site Landscaping', chs: '场地配景' },
    { id: 'light-atmosphere', en: 'Light & Atmosphere', chs: '光影氛围' },
    { id: 'image-style', en: 'Image Style', chs: '图像风格' },
] as const;
