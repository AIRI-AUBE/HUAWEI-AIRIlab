import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;

before(async () => {
    server = await createServer({
        root: process.cwd(),
        configFile: false,
        appType: 'custom',
        logLevel: 'error',
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true },
    });
});

after(async () => {
    await server?.close();
});

test('text-to-image emits the workflow 44 contract without image inputs', async () => {
    const { mapTextToImagePayload } = await server.ssrLoadModule(
        '/src/features/generation/textToImage.ts',
    );

    const payload = mapTextToImagePayload({
        prompt: 'A timber library',
        projectId: 101,
        teamId: 202,
    });

    assert.deepEqual(payload, {
        workflowId: '44',
        workflowVersion: 'V3',
        projectId: 101,
        teamId: 202,
        prompt: 'A timber library',
        aspectRatio: '16:9',
        orientation: 0,
        imageRatio: 3,
        referenceImage: [],
        language: 'chs',
    });
    assert.equal('baseImage' in payload, false);
    assert.equal('model' in payload, false);
});

test('image-to-image emits workflow 39 with uploaded images and no prompt', async () => {
    const { mapImageToImagePayload } = await server.ssrLoadModule(
        '/src/features/generation/imageToImage.ts',
    );

    const payload = mapImageToImagePayload({
        baseImage: { url: 'https://example.test/base.webp' },
        imageType: 'architecture',
        referenceImages: [
            {
                url: 'https://example.test/reference.webp',
                tags: ['architecture.facade_design'],
            },
        ],
        projectId: 101,
        projectName: 'Regression test',
        teamId: 202,
        language: 'en',
    });

    assert.equal(payload.workflowId, 39);
    assert.equal(payload.workflowVersion, 'V3');
    assert.equal(payload.model, 39);
    assert.equal(payload.baseImage, 'https://example.test/base.webp');
    assert.deepEqual(payload.referenceImage, [
        {
            url: 'https://example.test/reference.webp',
            weight: 0,
            categories: ['facade_or_interface'],
        },
    ]);
    assert.equal(payload.enteredText, '');
    assert.equal(payload.prompt, '');
    assert.equal(payload.designLibraryName, '');
    assert.equal('aspectRatio' in payload, false);
});

test('image-to-image mirrors a non-empty prompt into every official prompt field', async () => {
    const { mapImageToImagePayload } = await server.ssrLoadModule(
        '/src/features/generation/imageToImage.ts',
    );

    const payload = mapImageToImagePayload({
        baseImage: { url: 'https://example.test/base.webp' },
        imageType: 'architecture',
        referenceImages: [
            {
                url: 'https://example.test/reference.webp',
                tags: ['architecture.design_approach'],
            },
        ],
        prompt: 'Refine the entrance canopy',
        projectId: 101,
        teamId: 202,
    });

    assert.equal(payload.enteredText, 'Refine the entrance canopy');
    assert.equal(payload.prompt, 'Refine the entrance canopy');
    assert.equal(payload.additionalPrompt, 'Refine the entrance canopy');
});

test('image-to-image rejects payloads without a reference image', async () => {
    const { mapImageToImagePayload } = await server.ssrLoadModule(
        '/src/features/generation/imageToImage.ts',
    );

    assert.throws(
        () =>
            mapImageToImagePayload({
                baseImage: { url: 'https://example.test/base.webp' },
                imageType: 'architecture',
                referenceImages: [],
                projectId: 101,
                teamId: 202,
            }),
        /at least one reference image/i,
    );
});

test('image-to-image readiness requires both base and reference images', async () => {
    const { hasRequiredImageToImageInputs } = await server.ssrLoadModule(
        '/src/features/generation/imageToImage.ts',
    );

    assert.equal(
        hasRequiredImageToImageInputs({
            baseImage: { url: 'https://example.test/base.webp' },
            referenceImages: [],
        }),
        false,
    );
    assert.equal(
        hasRequiredImageToImageInputs({
            referenceImages: [{ url: 'https://example.test/reference.webp' }],
        }),
        false,
    );
    assert.equal(
        hasRequiredImageToImageInputs({
            baseImage: { url: 'https://example.test/base.webp' },
            referenceImages: [{ url: 'https://example.test/reference.webp' }],
        }),
        true,
    );
});

test('image-to-image requires every reference to have a persisted URL', async () => {
    const { hasRequiredImageToImageInputs, mapImageToImagePayload } = await server.ssrLoadModule(
        '/src/features/generation/imageToImage.ts',
    );
    const input = {
        baseImage: { url: 'https://example.test/base.webp' },
        imageType: 'architecture',
        referenceImages: [
            {
                url: '',
                tags: ['architecture.design_approach'],
            },
        ],
        projectId: 101,
        teamId: 202,
    };

    assert.equal(hasRequiredImageToImageInputs(input), false);
    assert.throws(() => mapImageToImagePayload(input), /persisted reference image url/i);
});

test('image-to-image accepts 6,000 prompt characters and rejects 6,001', async () => {
    const { mapImageToImagePayload } = await server.ssrLoadModule(
        '/src/features/generation/imageToImage.ts',
    );
    const input = {
        baseImage: { url: 'https://example.test/base.webp' },
        imageType: 'architecture',
        referenceImages: [
            {
                url: 'https://example.test/reference.webp',
                tags: ['architecture.design_approach'],
            },
        ],
        projectId: 101,
        teamId: 202,
    };

    assert.equal(
        mapImageToImagePayload({ ...input, prompt: 'x'.repeat(6000) }).prompt.length,
        6000,
    );
    assert.throws(
        () => mapImageToImagePayload({ ...input, prompt: 'x'.repeat(6001) }),
        /6,000 characters/i,
    );
});

test('image-to-image rejects payloads without a base image', async () => {
    const { mapImageToImagePayload } = await server.ssrLoadModule(
        '/src/features/generation/imageToImage.ts',
    );

    assert.throws(
        () =>
            mapImageToImagePayload({
                imageType: 'architecture',
                referenceImages: [
                    {
                        url: 'https://example.test/reference.webp',
                        tags: ['architecture.design_approach'],
                    },
                ],
                projectId: 101,
                teamId: 202,
            }),
        /requires a base image/i,
    );
});

test('image-to-image disabled reasons identify the active blocker', async () => {
    const { getImageToImageDisabledReason } = await server.ssrLoadModule(
        '/src/features/generation/imageToImage.ts',
    );
    const ready = {
        hasBaseImage: true,
        hasReferenceImages: true,
        templateLoading: false,
        uploadInProgress: false,
        generating: false,
    };

    assert.equal(getImageToImageDisabledReason(ready), undefined);
    assert.equal(
        getImageToImageDisabledReason({
            ...ready,
            hasBaseImage: false,
            hasReferenceImages: false,
        }),
        'missingBaseAndReference',
    );
    assert.equal(getImageToImageDisabledReason({ ...ready, hasBaseImage: false }), 'missingBase');
    assert.equal(
        getImageToImageDisabledReason({ ...ready, hasReferenceImages: false }),
        'missingReference',
    );
    assert.equal(getImageToImageDisabledReason({ ...ready, uploadInProgress: true }), 'uploading');
    assert.equal(
        getImageToImageDisabledReason({ ...ready, templateLoading: true }),
        'templateLoading',
    );
    assert.equal(getImageToImageDisabledReason({ ...ready, generating: true }), 'generating');
});

test('image-to-image rejects an unsupported image category', async () => {
    const { mapImageToImagePayload } = await server.ssrLoadModule(
        '/src/features/generation/imageToImage.ts',
    );

    assert.throws(
        () =>
            mapImageToImagePayload({
                baseImage: { url: 'https://example.test/base.webp' },
                imageType: 'product',
                referenceImages: [
                    {
                        url: 'https://example.test/reference.webp',
                        tags: ['architecture.design_approach'],
                    },
                ],
                projectId: 101,
                teamId: 202,
            }),
        /unsupported image category/i,
    );
});

test('image-to-image emits the same canonical reference categories as the full frontend', async () => {
    const { mapImageToImagePayload } = await server.ssrLoadModule(
        '/src/features/generation/imageToImage.ts',
    );
    const selectedTagsByCategory = {
        architecture: [
            'architecture.design_approach',
            'architecture.facade_design',
            'architecture.materials_construction',
            'architecture.site_context',
            'architecture.lighting_atmosphere',
            'architecture.visual_style',
            'interior.furnishings_decor',
        ],
        interior: [
            'interior.spatial_design',
            'interior.materials_finishes',
            'interior.interior_surfaces',
            'interior.furnishings_decor',
            'interior.lighting_atmosphere',
            'interior.visual_style',
            'architecture.site_context',
        ],
        landscape: [
            'landscape.landscape_design',
            'landscape.materials_planting',
            'landscape.site_surfaces',
            'landscape.people_activities',
            'landscape.light_seasonality',
            'landscape.visual_style',
            'architecture.site_context',
        ],
        urban: [
            'urban.urban_design_approach',
            'urban.street_block_frontages',
            'urban.material_system',
            'urban.context_transportation',
            'urban.urban_atmosphere',
            'urban.visual_style',
            'architecture.site_context',
        ],
    };
    const expectedCategories = [
        'design_language',
        'facade_or_interface',
        'material',
        'lighting_atmosphere',
        'visualization_style',
        'surrounding_context',
    ];

    for (const [imageType, tags] of Object.entries(selectedTagsByCategory)) {
        const payload = mapImageToImagePayload({
            baseImage: { url: 'https://example.test/base.webp' },
            imageType,
            referenceImages: [
                {
                    url: 'https://example.test/reference.webp',
                    tags: [...tags, tags[0]],
                },
            ],
            projectId: 101,
            teamId: 202,
        });

        assert.deepEqual(
            payload.referenceImage[0].categories,
            expectedCategories,
            `${imageType} payload differs from the full frontend`,
        );
    }
});

test('reference options change with the selected image category', async () => {
    const { getReferenceImageTags } = await server.ssrLoadModule('/src/data/referenceImageTags.ts');

    const expected = {
        architecture: [
            ['architecture.design_approach', 'Design Approach', '设计手法', 'design_language'],
            ['architecture.facade_design', 'Façade Design', '立面设计', 'facade_or_interface'],
            ['architecture.materials_construction', 'Materials & Details', '材料构造', 'material'],
            ['architecture.site_context', 'Site Context', '场地配景', 'surrounding_context'],
            [
                'architecture.lighting_atmosphere',
                'Lighting & Atmosphere',
                '光影氛围',
                'lighting_atmosphere',
            ],
            ['architecture.visual_style', 'Visual Style', '图像风格', 'visualization_style'],
        ],
        interior: [
            ['interior.spatial_design', 'Spatial Strategy', '空间手法', 'design_language'],
            ['interior.materials_finishes', 'Materials & Finishes', '材质饰面', 'material'],
            ['interior.interior_surfaces', 'Interior Surfaces', '界面硬装', 'facade_or_interface'],
            [
                'interior.furnishings_decor',
                'Furnishings & Décor',
                '陈设软装',
                'surrounding_context',
            ],
            [
                'interior.lighting_atmosphere',
                'Lighting & Atmosphere',
                '光影氛围',
                'lighting_atmosphere',
            ],
            ['interior.visual_style', 'Visual Style', '图像风格', 'visualization_style'],
        ],
        landscape: [
            ['landscape.landscape_design', 'Landscape Strategy', '景观策略', 'design_language'],
            ['landscape.materials_planting', 'Materials & Planting', '材料植物', 'material'],
            ['landscape.site_surfaces', 'Site Interfaces', '场地界面', 'facade_or_interface'],
            [
                'landscape.people_activities',
                'People & Activities',
                '配景活动',
                'surrounding_context',
            ],
            [
                'landscape.light_seasonality',
                'Light & Atmosphere',
                '光影氛围',
                'lighting_atmosphere',
            ],
            ['landscape.visual_style', 'Visual Style', '图像风格', 'visualization_style'],
        ],
        urban: [
            ['urban.urban_design_approach', 'Urban Strategy', '规划策略', 'design_language'],
            [
                'urban.street_block_frontages',
                'Street & Block Edges',
                '街区界面',
                'facade_or_interface',
            ],
            ['urban.material_system', 'Material System', '材质系统', 'material'],
            [
                'urban.context_transportation',
                'Context & Mobility',
                '背景交通',
                'surrounding_context',
            ],
            ['urban.urban_atmosphere', 'Light & Atmosphere', '光影氛围', 'lighting_atmosphere'],
            ['urban.visual_style', 'Visual Style', '图像风格', 'visualization_style'],
        ],
    };

    for (const [category, expectedOptions] of Object.entries(expected)) {
        assert.deepEqual(
            getReferenceImageTags(category).map(({ id, en, chs, payloadValue }) => [
                id,
                en,
                chs,
                payloadValue,
            ]),
            expectedOptions,
        );
    }
});

test('changing category resets filled references to that category defaults', async () => {
    const { resetReferenceImageTags } = await server.ssrLoadModule(
        '/src/data/referenceImageTags.ts',
    );
    const references = [
        { id: 'first', tags: ['architecture.facade_design'] },
        { id: 'second', tags: ['architecture.visual_style'] },
    ];

    const reset = resetReferenceImageTags(references, 'interior');

    assert.deepEqual(reset[0].tags, [
        'interior.spatial_design',
        'interior.materials_finishes',
        'interior.interior_surfaces',
        'interior.furnishings_decor',
        'interior.lighting_atmosphere',
        'interior.visual_style',
    ]);
    assert.deepEqual(reset[1].tags, ['interior.spatial_design']);
    assert.deepEqual(references[0].tags, ['architecture.facade_design']);
});

test('manual category changes preserve images, reset their directions, and ignore repeat clicks', async () => {
    const { changeReferenceImageCategory } = await server.ssrLoadModule(
        '/src/data/referenceImageTags.ts',
    );
    const form = {
        baseImageType: 'architecture',
        baseImage: { id: 'base' },
        referenceImages: [
            { id: 'first', tags: ['architecture.facade_design'] },
            { id: 'second', tags: ['architecture.visual_style'] },
        ],
        prompt: '',
        language: 'en',
    };

    const changed = changeReferenceImageCategory(form, 'urban');
    assert.equal(changed.changed, true);
    assert.equal(changed.form.baseImage, form.baseImage);
    assert.deepEqual(changed.form.referenceImages[0].tags, [
        'urban.urban_design_approach',
        'urban.street_block_frontages',
        'urban.material_system',
        'urban.context_transportation',
        'urban.urban_atmosphere',
        'urban.visual_style',
    ]);
    assert.deepEqual(changed.form.referenceImages[1].tags, ['urban.urban_design_approach']);
    assert.equal(changed.form.categoryNotice, 'urban');

    const repeated = changeReferenceImageCategory(changed.form, 'urban');
    assert.equal(repeated.changed, false);
    assert.equal(repeated.form, changed.form);
});

test('category changes remove template assets without removing user uploads', async () => {
    const { changeReferenceImageCategory } = await server.ssrLoadModule(
        '/src/data/referenceImageTags.ts',
    );
    const userBaseImage = {
        id: 'user-base',
        sourceType: 'user-upload',
        tags: [],
    };
    const userReference = {
        id: 'user-reference',
        sourceType: 'user-upload',
        tags: ['architecture.visual_style'],
    };
    const form = {
        baseImageType: 'architecture',
        baseImage: userBaseImage,
        referenceImages: [
            {
                id: 'template-reference',
                sourceType: 'template',
                tags: ['architecture.facade_design'],
            },
            userReference,
        ],
        prompt: '',
        language: 'en',
    };

    const changed = changeReferenceImageCategory(form, 'interior', {
        removeTemplateAssets: true,
    });

    assert.equal(changed.form.baseImage, userBaseImage);
    assert.deepEqual(
        changed.form.referenceImages.map(({ id }) => id),
        ['user-reference'],
    );
    assert.deepEqual(changed.form.referenceImages[0].tags, [
        'interior.spatial_design',
        'interior.materials_finishes',
        'interior.interior_surfaces',
        'interior.furnishings_decor',
        'interior.lighting_atmosphere',
        'interior.visual_style',
    ]);
    assert.equal(changed.form.categoryNotice, 'interior');
});

test('newly uploaded references receive category defaults in upload order', async () => {
    const { appendReferenceImage } = await server.ssrLoadModule('/src/data/referenceImageTags.ts');

    const first = appendReferenceImage([], { id: 'first', tags: [] }, 'landscape');
    const second = appendReferenceImage(first, { id: 'second', tags: [] }, 'landscape');

    assert.deepEqual(first[0].tags, [
        'landscape.landscape_design',
        'landscape.materials_planting',
        'landscape.site_surfaces',
        'landscape.people_activities',
        'landscape.light_seasonality',
        'landscape.visual_style',
    ]);
    assert.deepEqual(second[1].tags, ['landscape.landscape_design']);
});

test('reference direction selection cannot remove the final valid option', async () => {
    const { toggleReferenceImageTag } = await server.ssrLoadModule(
        '/src/data/referenceImageTags.ts',
    );
    const available = [
        'urban.urban_design_approach',
        'urban.street_block_frontages',
        'urban.material_system',
    ];

    assert.deepEqual(
        toggleReferenceImageTag(
            ['urban.urban_design_approach'],
            'urban.urban_design_approach',
            available,
        ),
        ['urban.urban_design_approach'],
    );
    assert.deepEqual(
        toggleReferenceImageTag(
            ['architecture.facade_design', 'urban.material_system'],
            'urban.street_block_frontages',
            available,
        ),
        ['urban.street_block_frontages', 'urban.material_system'],
    );
});

test('category controls expose their selected state to assistive technology', async () => {
    const { OptionGrid } = await server.ssrLoadModule('/src/components/RefinementControls.tsx');
    const markup = renderToStaticMarkup(
        createElement(OptionGrid, {
            options: [
                { id: 'architecture', en: 'Architecture', chs: '建筑' },
                { id: 'interior', en: 'Interior', chs: '室内' },
            ],
            language: 'en',
            selected: ['interior'],
            onToggle: () => undefined,
            className: 'base-types',
        }),
    );

    assert.match(markup, /aria-pressed="false"[^>]*>.*Architecture/);
    assert.match(markup, /aria-pressed="true"[^>]*>.*Interior/);
});

test('invalidating a template request prevents its later callbacks from committing', async () => {
    const { createLatestRequestGate } = await server.ssrLoadModule(
        '/src/features/creativeRefinement/latestRequest.ts',
    );
    const gate = createLatestRequestGate();

    const firstRequest = gate.begin();
    assert.equal(gate.isCurrent(firstRequest), true);
    assert.equal(gate.hasActive(), true);
    const firstSignal = gate.signal(firstRequest);
    assert.equal(firstSignal.aborted, false);

    assert.equal(gate.invalidate(), true);
    assert.equal(gate.isCurrent(firstRequest), false);
    assert.equal(gate.hasActive(), false);
    assert.equal(firstSignal.aborted, true);
    assert.equal(gate.invalidate(), false);

    const secondRequest = gate.begin();
    assert.equal(gate.isCurrent(secondRequest), true);
    assert.notEqual(secondRequest, firstRequest);
    assert.equal(gate.complete(secondRequest), true);
    assert.equal(gate.isCurrent(secondRequest), false);
    assert.equal(gate.hasActive(), false);
});

test('reference uploads never append beyond the configured maximum', async () => {
    const { appendUploadedImagesWithinLimit } = await server.ssrLoadModule(
        '/src/features/creativeRefinement/uploadTransactions.ts',
    );
    const existing = [{ id: 'one' }, { id: 'two' }];
    const incoming = [{ id: 'three' }, { id: 'four' }];

    assert.deepEqual(appendUploadedImagesWithinLimit?.(existing, incoming, 3), [
        { id: 'one' },
        { id: 'two' },
        { id: 'three' },
    ]);
});

test('template uploads are staged as one complete result', async () => {
    const { stageTemplateUploads } = await server.ssrLoadModule(
        '/src/features/creativeRefinement/uploadTransactions.ts',
    );
    const baseAsset = { id: 'base', previewUrl: '/base.webp', tags: [] };
    const referenceAssets = [
        { id: 'reference-one', previewUrl: '/one.webp', tags: ['design'] },
        { id: 'reference-two', previewUrl: '/two.webp', tags: ['material'] },
    ];
    const staged = await stageTemplateUploads?.({
        baseAsset,
        referenceAssets,
        upload: async (asset, role) => ({
            ...asset,
            url: `https://example.test/${role}/${asset.id}.webp`,
            sourceType: 'template',
        }),
    });

    assert.deepEqual(staged, {
        baseImage: {
            ...baseAsset,
            url: 'https://example.test/base-image/base.webp',
            sourceType: 'template',
        },
        referenceImages: [
            {
                ...referenceAssets[0],
                url: 'https://example.test/reference-image/reference-one.webp',
                sourceType: 'template',
            },
            {
                ...referenceAssets[1],
                url: 'https://example.test/reference-image/reference-two.webp',
                sourceType: 'template',
            },
        ],
    });
});

test('template loading hides retained thumbnails until the replacement is ready', async () => {
    const { deriveTemplateAssetPresentation } = await server.ssrLoadModule(
        '/src/features/creativeRefinement/templatePresentation.ts',
    );
    const form = {
        baseImage: { previewUrl: '/old-base.webp' },
        referenceImages: [
            {
                previewUrl: '/old-reference.webp',
                tags: ['architecture.facade_design'],
            },
        ],
    };

    assert.deepEqual(
        deriveTemplateAssetPresentation({
            form,
            activeReference: 0,
            templateLoading: true,
            targetHasBaseImage: true,
            targetReferenceCount: 2,
        }),
        {
            baseImages: [],
            referenceImages: [],
            activeTags: [],
            baseLoadingCount: 1,
            referenceLoadingCount: 2,
        },
    );
    assert.deepEqual(
        deriveTemplateAssetPresentation({
            form,
            activeReference: 0,
            templateLoading: false,
            targetHasBaseImage: false,
            targetReferenceCount: 0,
        }),
        {
            baseImages: ['/old-base.webp'],
            referenceImages: ['/old-reference.webp'],
            activeTags: ['architecture.facade_design'],
            baseLoadingCount: 0,
            referenceLoadingCount: 0,
        },
    );
});

test('a queued template state update remains valid after its request completes', async () => {
    const { createLatestRequestGate } = await server.ssrLoadModule(
        '/src/features/creativeRefinement/latestRequest.ts',
    );
    const { enqueueLatestRequestStateUpdate } = await server.ssrLoadModule(
        '/src/features/creativeRefinement/uploadTransactions.ts',
    );
    const gate = createLatestRequestGate();
    const request = gate.begin();
    const queuedUpdates = [];

    const queued = enqueueLatestRequestStateUpdate?.({
        gate,
        request,
        enqueue: (update) => queuedUpdates.push(update),
        update: (current) => ({ ...current, template: 'new' }),
    });
    gate.complete(request);

    assert.equal(queued, true);
    assert.deepEqual(queuedUpdates[0]?.({ template: 'old' }), { template: 'new' });
});

test('upload status recovery reflects assets retained across route navigation', async () => {
    const { deriveSettledUploadStatuses } = await server.ssrLoadModule(
        '/src/features/creativeRefinement/uploadTransactions.ts',
    );

    assert.deepEqual(
        deriveSettledUploadStatuses?.({
            baseImage: { url: 'https://example.test/base.webp' },
            referenceImages: [{ url: 'https://example.test/reference.webp' }],
        }),
        { base: 'success', reference: 'success' },
    );
    assert.deepEqual(
        deriveSettledUploadStatuses?.({
            referenceImages: [],
        }),
        { base: 'idle', reference: 'idle' },
    );
});

test('manual form edits invalidate a pending template before updating state', async () => {
    const { createLatestRequestGate } = await server.ssrLoadModule(
        '/src/features/creativeRefinement/latestRequest.ts',
    );
    const { applyManualFormEdit } = await server.ssrLoadModule(
        '/src/features/creativeRefinement/uploadTransactions.ts',
    );
    const gate = createLatestRequestGate();
    const templateRequest = gate.begin();
    let form = { prompt: 'template prompt' };

    applyManualFormEdit?.({
        invalidate: () => gate.invalidate(),
        enqueue: (update) => {
            form = update(form);
        },
        update: (current) => ({ ...current, prompt: 'manual prompt' }),
    });

    assert.equal(gate.isCurrent(templateRequest), false);
    assert.deepEqual(form, { prompt: 'manual prompt' });
});

test('template selection numbers resolve through the template category', async () => {
    const { caseToFormAssets, getV3Case } = await server.ssrLoadModule('/src/data/v3/cases.ts');
    const template = getV3Case('case-006');
    assert.ok(template);

    const assets = caseToFormAssets(template);

    assert.deepEqual(
        assets.referenceImages.map(({ tags }) => tags),
        [
            [
                'interior.spatial_design',
                'interior.materials_finishes',
                'interior.interior_surfaces',
            ],
            ['interior.furnishings_decor', 'interior.lighting_atmosphere'],
            ['interior.lighting_atmosphere', 'interior.visual_style'],
        ],
    );
});

test('the base-less workbook case reuses Template 02 base image', async () => {
    const { caseToFormAssets, getV3Case } = await server.ssrLoadModule('/src/data/v3/cases.ts');
    const templateTwo = getV3Case('case-002');
    const templateThree = getV3Case('case-003');
    assert.ok(templateTwo);
    assert.ok(templateThree);

    assert.equal(templateThree.baseImage, templateTwo.baseImage);
    assert.equal(
        caseToFormAssets(templateThree).baseImage?.previewUrl,
        '/v3/cases/case-002/base.webp',
    );
});
