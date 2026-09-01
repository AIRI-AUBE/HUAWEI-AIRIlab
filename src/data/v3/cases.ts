import manifest from './manifest.json';
import { referenceImageTags } from '../referenceImageTags';
import type { UploadedImage } from '../../features/imageUpload/types';

export type BaseImageType = 'architecture' | 'interior' | 'landscape' | 'urban';

type ManifestCase = (typeof manifest.cases)[number];

const categoryMap: Readonly<Record<string, BaseImageType>> = {
    建筑: 'architecture',
    室内: 'interior',
    景观: 'landscape',
    规划: 'urban',
    城市: 'urban',
    architecture: 'architecture',
    interior: 'interior',
    landscape: 'landscape',
    urban: 'urban',
};

const repairUtf8Mojibake = (value: string) => {
    try {
        const bytes = Uint8Array.from(value, (character) => character.charCodeAt(0));
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return value;
    }
};

export const normalizeV3Category = (value: string): BaseImageType | undefined =>
    categoryMap[value.trim().toLowerCase()] ??
    categoryMap[repairUtf8Mojibake(value).trim().toLowerCase()];

export type V3Template = {
    id: string;
    caseId: string;
    baseImageType: BaseImageType;
    title: string;
    thumbnail: string;
    sourceCategory: string;
};

export const v3Templates: V3Template[] = manifest.cases.flatMap((item, index) => {
    const baseImageType = normalizeV3Category(item.type);
    if (!baseImageType) return [];
    return [
        {
            id: item.id,
            caseId: item.id,
            baseImageType,
            title: `Template ${String(index + 1).padStart(2, '0')}`,
            thumbnail: item.expectedOutput,
            sourceCategory: item.type,
        },
    ];
});

export const getV3Case = (caseId: string) => manifest.cases.find((item) => item.id === caseId);

const caseAsset = (
    caseId: string,
    role: string,
    url: string,
    selections: number[] = [],
): UploadedImage => ({
    id: `${caseId}-${role}`,
    url,
    previewUrl: url,
    tags: selections.flatMap((selection) => {
        const tag = referenceImageTags[selection - 1];
        return tag ? [tag.id] : [];
    }),
    uploadStatus: 'success',
});

export const caseToFormAssets = (item: ManifestCase) => ({
    baseImage: item.baseImage ? caseAsset(item.id, 'base', item.baseImage) : undefined,
    referenceImages: [
        item.ref1Image
            ? caseAsset(item.id, 'ref-1', item.ref1Image, item.ref1Selections)
            : undefined,
        item.ref2Image
            ? caseAsset(item.id, 'ref-2', item.ref2Image, item.ref2Selections)
            : undefined,
        item.ref3Image
            ? caseAsset(item.id, 'ref-3', item.ref3Image, item.ref3Selections)
            : undefined,
    ].filter((image): image is UploadedImage => Boolean(image)),
    expectedOutput: item.expectedOutput,
});
