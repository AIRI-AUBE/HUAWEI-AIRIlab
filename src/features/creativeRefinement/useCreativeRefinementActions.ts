import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    appendReferenceImage,
    changeReferenceImageCategory,
    isReferenceImageCategory,
} from '../../data/referenceImageTags';
import { getV3Case, loadTemplateCase, type V3Template } from '../../data/v3/cases';
import { mapImageToImagePayload } from '../generation/imageToImage';
import { generate, waitForResult } from '../generation/universalGeneration';
import {
    disposeUploadedImage,
    errorMessage,
    runImageUploadPipeline,
    runTemplateImageUploadPipeline,
} from '../imageUpload/pipeline';
import { useCreativeRefinement } from './CreativeRefinementContext';
import { createLatestRequestGate } from './latestRequest';
import { appendUploadedImagesWithinLimit, stageTemplateUploads } from './uploadTransactions';

export function useCreativeRefinementActions() {
    const { t } = useTranslation();
    const state = useCreativeRefinement();
    const generationLock = useRef(false);
    const generationAbort = useRef<AbortController | undefined>(undefined);
    const templateRequestGate = useRef(createLatestRequestGate());
    const baseUploadRequestGate = useRef(createLatestRequestGate());
    const referenceUploadRequestGate = useRef(createLatestRequestGate());

    const invalidatePendingTemplateLoad = () => {
        if (!templateRequestGate.current.invalidate()) return;
        state.setLoadingTemplateId(undefined);
        state.setTemplateStatus('idle');
        state.setTemplateError('');
        state.setReferenceLoadingCount(0);
    };

    const invalidatePendingManualUploads = () => {
        if (baseUploadRequestGate.current.invalidate()) {
            state.setBaseStatus(state.form.baseImage ? 'success' : 'idle');
        }
        if (referenceUploadRequestGate.current.invalidate()) {
            state.setReferenceStatus(state.form.referenceImages.length ? 'success' : 'idle');
            state.setReferenceLoadingCount(0);
        }
    };

    useEffect(
        () => () => {
            templateRequestGate.current.invalidate();
            baseUploadRequestGate.current.invalidate();
            referenceUploadRequestGate.current.invalidate();
            generationAbort.current?.abort();
        },
        [],
    );

    const addBase = async (files: File[]) => {
        if (!files[0]) return;
        invalidatePendingTemplateLoad();
        const requestId = baseUploadRequestGate.current.begin();
        const signal = baseUploadRequestGate.current.signal(requestId);
        const isCurrentRequest = () => baseUploadRequestGate.current.isCurrent(requestId);
        state.setBaseError('');
        try {
            const image = await runImageUploadPipeline(
                files[0],
                'base-image',
                (status) => {
                    if (isCurrentRequest()) state.setBaseStatus(status);
                },
                signal,
            );
            if (!isCurrentRequest()) {
                disposeUploadedImage(image);
                return;
            }
            state.setForm((current) => {
                disposeUploadedImage(current.baseImage);
                return { ...current, baseImage: image };
            });
        } catch (error) {
            if (!isCurrentRequest()) return;
            state.setBaseStatus('error');
            state.setBaseError(errorMessage(error));
        } finally {
            baseUploadRequestGate.current.complete(requestId);
        }
    };

    const addReferences = async (files: File[]) => {
        if (referenceUploadRequestGate.current.hasActive()) return;
        invalidatePendingTemplateLoad();
        const available = Math.max(0, 3 - state.form.referenceImages.length);
        const acceptedFiles = files.slice(0, available);
        state.setReferenceError(
            files.length > available ? t('imageToImage.tooManyReferences') : '',
        );
        if (!acceptedFiles.length) return;

        const requestId = referenceUploadRequestGate.current.begin();
        const signal = referenceUploadRequestGate.current.signal(requestId);
        const isCurrentRequest = () => referenceUploadRequestGate.current.isCurrent(requestId);
        state.setReferenceLoadingCount(acceptedFiles.length);
        try {
            for (const file of acceptedFiles) {
                if (!isCurrentRequest()) break;
                try {
                    const image = await runImageUploadPipeline(
                        file,
                        'reference-image',
                        (status) => {
                            if (isCurrentRequest()) state.setReferenceStatus(status);
                        },
                        signal,
                    );
                    if (!isCurrentRequest()) {
                        disposeUploadedImage(image);
                        break;
                    }
                    state.setForm((current) => {
                        const appended = appendReferenceImage(
                            current.referenceImages,
                            image,
                            current.baseImageType,
                        );
                        const [taggedImage] = appended.slice(current.referenceImages.length);
                        const next = appendUploadedImagesWithinLimit(
                            current.referenceImages,
                            [taggedImage],
                            3,
                        );
                        if (next.length === current.referenceImages.length) {
                            disposeUploadedImage(image);
                            return current;
                        }
                        return { ...current, referenceImages: next };
                    });
                } catch (error) {
                    if (!isCurrentRequest()) break;
                    state.setReferenceStatus('error');
                    state.setReferenceError(`${file.name}: ${errorMessage(error)}`);
                } finally {
                    if (isCurrentRequest()) {
                        state.setReferenceLoadingCount((count) => Math.max(0, count - 1));
                    }
                }
            }
        } finally {
            referenceUploadRequestGate.current.complete(requestId);
        }
    };

    const removeBase = () => {
        invalidatePendingTemplateLoad();
        baseUploadRequestGate.current.invalidate();
        state.setForm((current) => {
            disposeUploadedImage(current.baseImage);
            state.setBaseStatus('idle');
            state.setBaseError('');
            return { ...current, baseImage: undefined };
        });
    };

    const removeReference = (index: number) => {
        invalidatePendingTemplateLoad();
        state.setForm((current) => {
            disposeUploadedImage(current.referenceImages[index]);
            const next = current.referenceImages.filter((_, itemIndex) => itemIndex !== index);
            state.setActiveReference((value) => Math.max(0, Math.min(value, next.length - 1)));
            return { ...current, referenceImages: next };
        });
    };

    const selectBaseImageType = (baseImageType: string) => {
        if (!isReferenceImageCategory(baseImageType)) return;
        const nextType = baseImageType;
        if (nextType === state.form.baseImageType) return;

        invalidatePendingTemplateLoad();
        state.setForm((current) => {
            return changeReferenceImageCategory(current, nextType, {
                removeTemplateAssets: Boolean(state.selectedTemplateId),
            }).form;
        });
        if (state.selectedTemplateId) {
            state.setActiveReference(0);
        }
        state.setSelectedTemplateId(undefined);
        state.setTemplateStatus('idle');
        state.setTemplateError('');
        state.setTemplateOpen(false);
    };

    const selectTemplate = async (template: V3Template) => {
        const selectedCase = getV3Case(template.caseId);
        if (!selectedCase) return;
        invalidatePendingManualUploads();
        const requestId = templateRequestGate.current.begin();
        const isCurrentRequest = () => templateRequestGate.current.isCurrent(requestId);
        const signal = templateRequestGate.current.signal(requestId);
        state.setLoadingTemplateId(template.id);
        state.setTemplateStatus('loading');
        state.setTemplateOpen(false);
        state.setTemplateError('');
        state.setReferenceLoadingCount(
            [selectedCase.ref1Image, selectedCase.ref2Image, selectedCase.ref3Image].filter(Boolean)
                .length,
        );
        try {
            const loaded = await loadTemplateCase(template.caseId);
            if (!isCurrentRequest()) return;
            const staged = await stageTemplateUploads({
                baseAsset: loaded.baseImage,
                referenceAssets: loaded.referenceImages,
                upload: async (asset, role, index) => {
                    try {
                        const uploaded = await runTemplateImageUploadPipeline(
                            asset.previewUrl,
                            role,
                            undefined,
                            signal,
                        );
                        return {
                            ...uploaded,
                            id:
                                role === 'reference-image'
                                    ? `${template.id}-reference-${index}`
                                    : `${template.id}-base`,
                            tags: asset.tags,
                        };
                    } finally {
                        if (role === 'reference-image' && isCurrentRequest()) {
                            state.setReferenceLoadingCount((count) => Math.max(0, count - 1));
                        }
                    }
                },
            });
            if (!isCurrentRequest()) return;

            state.setForm((current) => {
                if (!isCurrentRequest()) {
                    disposeUploadedImage(staged.baseImage);
                    staged.referenceImages.forEach(disposeUploadedImage);
                    return current;
                }
                disposeUploadedImage(current.baseImage);
                current.referenceImages.forEach(disposeUploadedImage);
                return {
                    ...current,
                    baseImageType: loaded.baseImageType,
                    baseImage: staged.baseImage,
                    referenceImages: staged.referenceImages,
                    prompt: loaded.prompt || current.prompt,
                    categoryNotice: undefined,
                };
            });
            state.setSelectedTemplateId(template.id);
            state.setTemplateStatus('success');
            state.setBaseStatus(staged.baseImage ? 'success' : 'idle');
            state.setReferenceStatus(staged.referenceImages.length ? 'success' : 'idle');
            state.setBaseError('');
            state.setReferenceError('');
            state.setActiveReference(0);
        } catch (error) {
            if (!isCurrentRequest()) return;
            templateRequestGate.current.invalidate();
            state.setTemplateStatus('error');
            state.setTemplateError(
                error instanceof Error ? error.message : t('imageToImage.templateError'),
            );
            state.setReferenceLoadingCount(0);
            state.setLoadingTemplateId(undefined);
        } finally {
            if (isCurrentRequest()) {
                state.setReferenceLoadingCount(0);
                state.setLoadingTemplateId(undefined);
                templateRequestGate.current.complete(requestId);
            }
        }
    };

    const startGeneration = async () => {
        if (generationLock.current || !state.form.baseImage) return;
        generationLock.current = true;
        const controller = new AbortController();
        generationAbort.current = controller;
        state.setGenerationStatus('validating');
        state.setGenerationError('');
        state.setOutputs([]);
        state.setJobId('');
        try {
            const payload = mapImageToImagePayload({
                baseImage: state.form.baseImage,
                imageType: state.form.baseImageType,
                referenceImages: state.form.referenceImages,
                prompt: state.form.prompt,
                language: state.form.language,
            });
            state.setGenerationStatus('submitting');
            const jobId = await generate(payload, controller.signal);
            state.setJobId(jobId);
            state.setGenerationStatus('generating');
            const result = await waitForResult(jobId, { signal: controller.signal });
            const outputs = (result.outputs ?? []).filter(
                (output) => typeof output.url === 'string' && output.url.length > 0,
            );
            if (!outputs.length) throw new Error('Generation completed without an output image.');
            state.setOutputs(outputs);
            state.setGenerationStatus('completed');
        } catch (error) {
            if (controller.signal.aborted) return;
            state.setGenerationStatus('failed');
            state.setGenerationError(
                error instanceof Error ? error.message : t('imageToImage.generationFailed'),
            );
        } finally {
            if (generationAbort.current === controller) {
                generationAbort.current = undefined;
                generationLock.current = false;
            }
        }
    };

    return {
        addBase,
        addReferences,
        removeBase,
        removeReference,
        selectBaseImageType,
        selectTemplate,
        startGeneration,
    };
}
