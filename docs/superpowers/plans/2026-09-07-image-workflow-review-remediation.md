# Image Workflow Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the final image-to-image validation and asynchronous state-race findings from the independent code review.

**Architecture:** Keep payload validation in the workflow-39 mapper, and move asynchronous ownership into small request-gate helpers that can be tested without network calls. Manual uploads receive their own abortable request gates, while template assets are staged locally and applied to the form in one successful transaction.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner

**Spec:** Independent review of `30f4bd7..70f7db9` and the official Explore V3 implementation in `D:\git\AAIOdyssey-frontend-2`.

## Global Constraints

- Workflow 39 requires a persisted base-image URL and one through three persisted reference-image URLs.
- The image-to-image prompt is optional and limited to 6,000 characters.
- Selecting a template must not allow older manual uploads or template requests to overwrite newer state.
- Template application must be atomic: partial success or failure must not alter the current form.
- Tests must not make live upload or generation requests.

---

### Task 1: Payload and prompt boundaries

**Files:**

- Modify: `src/features/generation/imageToImage.ts`
- Modify: `src/pages/ImageToImagePage.tsx`
- Test: `tests/generation-workflows.test.mjs`

**Interfaces:**

- Consumes: `mapImageToImagePayload(input)` and `hasRequiredImageToImageInputs(input)`
- Produces: workflow-39 validation for non-empty persisted URLs and the 6,000-character prompt boundary

- [x] **Step 1: Write failing boundary tests**

```js
assert.equal(
    hasRequiredImageToImageInputs({
        baseImage: { url: 'https://example.test/base.webp' },
        referenceImages: [{ url: '' }],
    }),
    false,
);
assert.throws(() => mapImageToImagePayload(overlongPromptInput), /6,000/);
```

- [x] **Step 2: Run the contract test and verify the new assertions fail for the missing guards**

```powershell
npm run test:contracts
```

- [x] **Step 3: Add minimal mapper guards and `maxLength={6000}`**

```ts
if (prompt.length > 6000) throw new Error('Workflow 39 accepts prompts up to 6,000 characters.');
if (input.referenceImages.some(({ url }) => !url)) {
    throw new Error('Workflow 39 requires persisted reference image URLs.');
}
```

- [x] **Step 4: Run contract and type tests**

```powershell
npm run test:contracts
npm run test:types
```

### Task 2: Abortable request ownership

**Files:**

- Modify: `src/features/creativeRefinement/latestRequest.ts`
- Test: `tests/generation-workflows.test.mjs`

**Interfaces:**

- Consumes: `createLatestRequestGate()`
- Produces: `signal(request)` and `hasActive()` in addition to begin/invalidate/complete/isCurrent

- [x] **Step 1: Write a failing gate test proving invalidation aborts the owned signal**

```js
const request = gate.begin();
assert.equal(gate.signal(request).aborted, false);
gate.invalidate();
assert.equal(gate.signal(request).aborted, true);
```

- [x] **Step 2: Run the contract test and verify failure because the gate has no signal API**

```powershell
npm run test:contracts
```

- [x] **Step 3: Add an AbortController owned by each active request**

```ts
begin: () => {
    activeController?.abort();
    activeController = new AbortController();
    activeRequest = ++currentRequest;
    return activeRequest;
};
```

- [x] **Step 4: Run the contract tests and keep the existing latest-request behavior green**

```powershell
npm run test:contracts
```

### Task 3: Transactional templates and bounded manual uploads

**Files:**

- Modify: `src/features/creativeRefinement/useCreativeRefinementActions.ts`
- Modify: `src/features/creativeRefinement/latestRequest.ts`
- Test: `tests/generation-workflows.test.mjs`

**Interfaces:**

- Consumes: separate template, base-upload, and reference-batch request gates
- Produces: staged template assets committed once; stale manual completions discarded; one reference batch active at a time; commit-time maximum of three references

- [x] **Step 1: Write failing helper tests for stale commits, atomic staging, and reference capacity**

```js
assert.equal(
    commitIfCurrent(gate, staleRequest, () => 'committed'),
    undefined,
);
assert.deepEqual(appendWithinLimit(existing, incoming, 3), expectedThreeReferences);
```

- [x] **Step 2: Run contract tests and verify the missing helpers fail**

```powershell
npm run test:contracts
```

- [x] **Step 3: Wire request ownership into manual uploads**

```ts
const requestId = baseUploadGate.current.begin();
const signal = baseUploadGate.current.signal(requestId);
const image = await runImageUploadPipeline(file, 'base-image', guardedProgress, signal);
if (!baseUploadGate.current.isCurrent(requestId)) return;
```

- [x] **Step 4: Stage all template uploads and commit only after every upload succeeds**

```ts
const [baseImage, ...referenceImages] = await Promise.all(stagedUploads);
if (!templateRequestGate.current.isCurrent(requestId)) return;
state.setForm((current) => ({ ...current, baseImage, referenceImages }));
```

- [x] **Step 5: Enforce reference capacity again at commit time**

```ts
referenceImages: appendWithinLimit(current.referenceImages, [image], 3);
```

- [x] **Step 6: Run contract and type tests**

```powershell
npm run test:contracts
npm run test:types
```

### Task 4: Lifecycle, verification, and review

**Files:**

- Modify: `src/features/creativeRefinement/useCreativeRefinementActions.ts`
- Modify: `docs/universal-generation-api.md`
- Test: `tests/generation-workflows.test.mjs`

**Interfaces:**

- Consumes: abortable upload/template/generation operations
- Produces: unmount cleanup, updated API documentation, verified production build

- [x] **Step 1: Add cleanup that invalidates upload/template requests and aborts generation**

```ts
useEffect(
    () => () => {
        templateRequestGate.current.invalidate();
        baseUploadRequestGate.current.invalidate();
        referenceUploadRequestGate.current.invalidate();
        generationAbort.current?.abort();
    },
    [],
);
```

- [x] **Step 2: Pass the generation signal through submit and polling**

```ts
const jobId = await generate(payload, controller.signal);
const result = await waitForResult(jobId, { signal: controller.signal });
```

- [x] **Step 3: Update the workflow-39 documentation**

Document the 6,000-character prompt maximum, persisted URL validation, and transactional upload behavior.

- [x] **Step 4: Run final verification**

```powershell
npm run build
npm audit --audit-level=high
npx prettier --check docs/universal-generation-api.md docs/superpowers/plans/2026-09-07-image-workflow-review-remediation.md src/features/creativeRefinement/latestRequest.ts src/features/creativeRefinement/uploadTransactions.ts src/features/creativeRefinement/useCreativeRefinementActions.ts src/features/generation/imageToImage.ts src/features/generation/types.ts src/pages/ImageToImagePage.tsx tests/generation-workflows.test.mjs
git diff --check
```

- [x] **Step 5: Commit and request a final read-only review**

```powershell
git add src tests docs
git commit -m "fix: harden image workflow async state"
```

### Task 5: Deferred React commits and route cleanup

**Files:**

- Modify: `src/features/creativeRefinement/uploadTransactions.ts`
- Modify: `src/features/creativeRefinement/useCreativeRefinementActions.ts`
- Test: `tests/generation-workflows.test.mjs`

**Interfaces:**

- Consumes: the current request gate and provider-owned form/upload state
- Produces: a queued form update whose validity is decided before enqueueing, plus settled provider statuses after route cleanup

- [x] **Step 1: Write failing tests for deferred updater validity and retained-asset statuses**

```js
assert.equal(enqueueLatestRequestStateUpdate?.(input), true);
gate.complete(request);
assert.deepEqual(queuedUpdate(current), expected);
assert.deepEqual(deriveSettledUploadStatuses(formWithImages), {
    base: 'success',
    reference: 'success',
});
```

- [x] **Step 2: Run contract tests and verify both helpers are absent**

```powershell
npm run test:contracts
```

- [x] **Step 3: Decide request validity before enqueueing the React updater**

```ts
if (!gate.isCurrent(request)) return false;
enqueue(update);
return true;
```

- [x] **Step 4: Reset only active provider-owned operations during route cleanup**

```ts
const settledStatuses = deriveSettledUploadStatuses(formRef.current);
if (baseUploadRequestGate.current.invalidate()) {
    state.setBaseStatus(settledStatuses.base);
}
```

- [x] **Step 5: Run contract and type tests**

```powershell
npm run test:contracts
npm run test:types
```

### Task 6: Manual field-edit ownership

**Files:**

- Modify: `src/features/creativeRefinement/uploadTransactions.ts`
- Modify: `src/features/creativeRefinement/useCreativeRefinementActions.ts`
- Modify: `src/pages/ImageToImagePage.tsx`
- Test: `tests/generation-workflows.test.mjs`

**Interfaces:**

- Consumes: the template request invalidator and functional form updater
- Produces: prompt and reference-tag edits that cancel an active template before updating state

- [x] **Step 1: Write a failing ownership test**

```js
applyManualFormEdit({
    invalidate: () => gate.invalidate(),
    enqueue,
    update,
});
assert.equal(gate.isCurrent(templateRequest), false);
assert.deepEqual(form, { prompt: 'manual prompt' });
```

- [x] **Step 2: Run the contract test and verify the request remains active**

```powershell
npm run test:contracts
```

- [x] **Step 3: Route prompt and tag edits through one invalidating form-edit action**

```ts
applyManualFormEdit({
    invalidate: invalidatePendingTemplateLoad,
    enqueue: state.setForm,
    update,
});
```

- [x] **Step 4: Run contract and type tests**

```powershell
npm run test:contracts
npm run test:types
```
