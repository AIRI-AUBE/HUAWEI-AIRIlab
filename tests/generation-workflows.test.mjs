import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
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
    assert.equal('aspectRatio' in payload, false);
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

    const repeated = changeReferenceImageCategory(changed.form, 'urban');
    assert.equal(repeated.changed, false);
    assert.equal(repeated.form, changed.form);
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
