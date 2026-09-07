import { useRef } from 'react';
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

export function useCreativeRefinementActions() {
    const { t } = useTranslation();
    const state = useCreativeRefinement();
    const generationLock = useRef(false);
    const templateRequestGate = useRef(createLatestRequestGate());

    const invalidatePendingTemplateLoad = () => {
        if (!templateRequestGate.current.invalidate()) return;
        state.setLoadingTemplateId(undefined);
        state.setTemplateStatus('idle');
        state.setTemplateError('');
        state.setBaseStatus('idle');
        state.setReferenceStatus('idle');
        state.setReferenceLoadingCount(0);
    };

    const addBase = async (files: File[]) => {
        if (!files[0]) return;
        invalidatePendingTemplateLoad();
        state.setBaseError('');
        try {
            const image = await runImageUploadPipeline(files[0], 'base-image', state.setBaseStatus);
            state.setForm((current) => {
                disposeUploadedImage(current.baseImage);
                return { ...current, baseImage: image };
            });
        } catch (error) {
            state.setBaseStatus('error');
            state.setBaseError(errorMessage(error));
        }
    };

    const addReferences = async (files: File[]) => {
        invalidatePendingTemplateLoad();
        const available = Math.max(0, 3 - state.form.referenceImages.length);
        const acceptedFiles = files.slice(0, available);
        state.setReferenceLoadingCount(acceptedFiles.length);
        state.setReferenceError(
            files.length > available ? t('imageToImage.tooManyReferences') : '',
        );
        for (const file of acceptedFiles) {
            try {
                const image = await runImageUploadPipeline(
                    file,
                    'reference-image',
                    state.setReferenceStatus,
                );
                state.setForm((current) => ({
                    ...current,
                    referenceImages: appendReferenceImage(
                        current.referenceImages,
                        image,
                        current.baseImageType,
                    ),
                }));
            } catch (error) {
                state.setReferenceStatus('error');
                state.setReferenceError(`${file.name}: ${errorMessage(error)}`);
            } finally {
                state.setReferenceLoadingCount((count) => Math.max(0, count - 1));
            }
        }
    };

    const removeBase = () => {
        invalidatePendingTemplateLoad();
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
        const requestId = templateRequestGate.current.begin();
        const isCurrentRequest = () => templateRequestGate.current.isCurrent(requestId);
        state.setLoadingTemplateId(template.id);
        state.setTemplateStatus('loading');
        state.setTemplateOpen(false);
        state.setTemplateError('');
        state.setBaseStatus('idle');
        state.setReferenceLoadingCount(
            [selectedCase.ref1Image, selectedCase.ref2Image, selectedCase.ref3Image].filter(Boolean)
                .length,
        );
        state.setForm((current) => {
            if (current.baseImage?.file) disposeUploadedImage(current.baseImage);
            current.referenceImages.filter((image) => image.file).forEach(disposeUploadedImage);
            return {
                ...current,
                baseImageType: template.baseImageType,
                baseImage: undefined,
                referenceImages: [],
                categoryNotice: undefined,
            };
        });
        try {
            const loaded = await loadTemplateCase(template.caseId);
            if (!isCurrentRequest()) return;
            state.setForm((current) => ({
                ...current,
                baseImageType: loaded.baseImageType,
                prompt: loaded.prompt || current.prompt,
            }));

            const baseUpload = loaded.baseImage
                ? runTemplateImageUploadPipeline(
                      loaded.baseImage.previewUrl,
                      'base-image',
                      (status) => {
                          if (isCurrentRequest()) state.setBaseStatus(status);
                      },
                  ).then((baseImage) => {
                      if (isCurrentRequest()) {
                          state.setForm((current) => ({ ...current, baseImage }));
                      }
                      return baseImage;
                  })
                : Promise.resolve(undefined);
            const referenceUploads = loaded.referenceImages.map(async (image, index) => {
                try {
                    const uploaded = {
                        ...(await runTemplateImageUploadPipeline(
                            image.previewUrl,
                            'reference-image',
                            (status) => {
                                if (isCurrentRequest()) state.setReferenceStatus(status);
                            },
                        )),
                        id: `${template.id}-reference-${index}`,
                        tags: image.tags,
                    };
                    if (isCurrentRequest()) {
                        state.setForm((current) => ({
                            ...current,
                            referenceImages: [...current.referenceImages, uploaded].sort(
                                (left, right) => left.id.localeCompare(right.id),
                            ),
                        }));
                    }
                    return uploaded;
                } finally {
                    if (isCurrentRequest()) {
                        state.setReferenceLoadingCount((count) => Math.max(0, count - 1));
                    }
                }
            });
            const results = await Promise.allSettled([baseUpload, ...referenceUploads]);
            if (!isCurrentRequest()) return;
            const failed = results.find(
                (result): result is PromiseRejectedResult => result.status === 'rejected',
            );
            if (failed) throw failed.reason;

            state.setSelectedTemplateId(template.id);
            state.setTemplateStatus('success');
            state.setBaseError('');
            state.setReferenceError('');
            state.setActiveReference(0);
        } catch (error) {
            if (!isCurrentRequest()) return;
            state.setTemplateStatus('error');
            state.setTemplateError(
                error instanceof Error ? error.message : t('imageToImage.templateError'),
            );
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
            const jobId = await generate(payload);
            state.setJobId(jobId);
            state.setGenerationStatus('generating');
            const result = await waitForResult(jobId);
            const outputs = (result.outputs ?? []).filter(
                (output) => typeof output.url === 'string' && output.url.length > 0,
            );
            if (!outputs.length) throw new Error('Generation completed without an output image.');
            state.setOutputs(outputs);
            state.setGenerationStatus('completed');
        } catch (error) {
            state.setGenerationStatus('failed');
            state.setGenerationError(
                error instanceof Error ? error.message : t('imageToImage.generationFailed'),
            );
        } finally {
            generationLock.current = false;
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
