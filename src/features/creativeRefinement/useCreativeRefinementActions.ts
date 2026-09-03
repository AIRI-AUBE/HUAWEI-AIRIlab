import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getV3Case, loadTemplateCase, type V3Template } from '../../data/v3/cases';
import { generate, waitForResult } from '../generation/universalGeneration';
import { mapWorkflow44Payload } from '../generation/workflow44';
import {
    disposeUploadedImage,
    errorMessage,
    runImageUploadPipeline,
    runTemplateImageUploadPipeline,
} from '../imageUpload/pipeline';
import { useCreativeRefinement } from './CreativeRefinementContext';

export function useCreativeRefinementActions() {
    const { t } = useTranslation();
    const state = useCreativeRefinement();
    const generationLock = useRef(false);

    const addBase = async (files: File[]) => {
        if (!files[0]) return;
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
                    referenceImages: [...current.referenceImages, image],
                }));
            } catch (error) {
                state.setReferenceStatus('error');
                state.setReferenceError(`${file.name}: ${errorMessage(error)}`);
            } finally {
                state.setReferenceLoadingCount((count) => Math.max(0, count - 1));
            }
        }
    };

    const removeBase = () =>
        state.setForm((current) => {
            disposeUploadedImage(current.baseImage);
            state.setBaseStatus('idle');
            state.setBaseError('');
            return { ...current, baseImage: undefined };
        });

    const removeReference = (index: number) =>
        state.setForm((current) => {
            disposeUploadedImage(current.referenceImages[index]);
            const next = current.referenceImages.filter((_, itemIndex) => itemIndex !== index);
            state.setActiveReference((value) => Math.max(0, Math.min(value, next.length - 1)));
            return { ...current, referenceImages: next };
        });

    const selectBaseImageType = (baseImageType: string) => {
        state.setForm((current) => {
            if (!state.selectedTemplateId) {
                return { ...current, baseImageType: baseImageType as typeof current.baseImageType };
            }
            if (current.baseImage?.file) disposeUploadedImage(current.baseImage);
            current.referenceImages.filter((image) => image.file).forEach(disposeUploadedImage);
            return {
                ...current,
                baseImageType: baseImageType as typeof current.baseImageType,
                baseImage: undefined,
                referenceImages: [],
            };
        });
        if (state.selectedTemplateId) {
            state.setBaseStatus('idle');
            state.setReferenceStatus('idle');
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
            };
        });
        try {
            const loaded = await loadTemplateCase(template.caseId);
            state.setForm((current) => ({
                ...current,
                baseImageType: loaded.baseImageType,
                prompt: loaded.prompt || current.prompt,
            }));

            const baseUpload = loaded.baseImage
                ? runTemplateImageUploadPipeline(
                      loaded.baseImage.previewUrl,
                      'base-image',
                      state.setBaseStatus,
                  ).then((baseImage) => {
                      state.setForm((current) => ({ ...current, baseImage }));
                      return baseImage;
                  })
                : Promise.resolve(undefined);
            const referenceUploads = loaded.referenceImages.map(async (image, index) => {
                try {
                    const uploaded = {
                        ...(await runTemplateImageUploadPipeline(
                            image.previewUrl,
                            'reference-image',
                            state.setReferenceStatus,
                        )),
                        id: `${template.id}-reference-${index}`,
                        tags: image.tags,
                    };
                    state.setForm((current) => ({
                        ...current,
                        referenceImages: [...current.referenceImages, uploaded].sort(
                            (left, right) => left.id.localeCompare(right.id),
                        ),
                    }));
                    return uploaded;
                } finally {
                    state.setReferenceLoadingCount((count) => Math.max(0, count - 1));
                }
            });
            const results = await Promise.allSettled([baseUpload, ...referenceUploads]);
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
            state.setTemplateStatus('error');
            state.setTemplateError(
                error instanceof Error ? error.message : t('imageToImage.templateError'),
            );
        } finally {
            state.setReferenceLoadingCount(0);
            state.setLoadingTemplateId(undefined);
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
            const payload = mapWorkflow44Payload({
                referenceImages: state.form.referenceImages,
                prompt: state.form.prompt,
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
