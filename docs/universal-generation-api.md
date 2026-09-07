# Universal Generation API integration

The V3 client uses the API origin in `VITE_AIRI_API_BASE_URL`. Upload routing can be overridden with
`VITE_AIRI_UPLOAD_PATH`; otherwise it uses `/api/GenerateWorkflow/UploadMedia`. `VITE_AIRI_PROJECT_ID`
and `VITE_AIRI_TEAM_ID` must identify the current owner/environment and must never be copied from API examples.

## Authentication and security

Generation and upload requests omit browser credentials. When `VITE_AIRI_AUTH_TOKEN` is set, the client sends it as a
Bearer token. `VITE_AIRI_API_KEY` is supported for controlled deployments that explicitly accept a browser-visible key,
but production deployments should put `X-AIRI-API-Key` on a server-side proxy instead. Never commit, log, place in a URL,
or display a raw key.

## Workflow routing

Both user flows submit to `POST /api/Universal/Generate`, but they have deliberately separate payload mappers:

| User flow      | Workflow ID | Payload mapper                            |
| -------------- | ----------- | ----------------------------------------- |
| Text to image  | `"44"`      | `src/features/generation/textToImage.ts`  |
| Image to image | `39`        | `src/features/generation/imageToImage.ts` |

The workflow ID types match the currently accepted API contracts: text-to-image uses the string `"44"`, while
image-to-image uses the number `39`.

## Text-to-image: workflow 44 V3

Text-to-image submits the following payload:

```json
{
    "workflowId": "44",
    "workflowVersion": "V3",
    "projectId": "<current-project-id>",
    "teamId": "<current-team-id>",
    "prompt": "<prompt>",
    "aspectRatio": "16:9",
    "orientation": 0,
    "imageRatio": 3,
    "referenceImage": [],
    "language": "chs"
}
```

`projectId` and `teamId` are submitted as numbers sourced from the environment. Text-to-image never submits a base image
or reference images.

## Image-to-image: workflow 39 V3

Image-to-image first uploads the selected images, then submits the persisted URLs in the workflow-39 payload. The
distinguishing fields are:

```json
{
    "workflowId": 39,
    "workflowVersion": "V3",
    "model": 39,
    "projectId": "<current-project-id>",
    "projectName": "<current-project-name>",
    "teamId": "<current-team-id>",
    "baseImage": "https://<persisted-base-image-url>",
    "imageType": "architecture",
    "referenceImage": [
        {
            "url": "https://<persisted-reference-image-url>",
            "weight": 0,
            "categories": ["facade_or_interface"]
        }
    ],
    "enteredText": "<prompt>",
    "additionalPrompt": "<prompt>",
    "prompt": "<prompt>",
    "language": "en"
}
```

The mapper also supplies workflow-39's fixed generation settings, including dimensions, quality, style defaults, and
control values. A base image and at least one reference image are required; image-to-image supports one through three
reference images. Local object URLs are preview-only and are never submitted. The prompt input is optional; its value is
mirrored into `enteredText`, `additionalPrompt`, and `prompt`, with all three submitted as empty strings when omitted.

## Polling and results

After the generate response returns `jobId`, the client polls `GET /api/Universal/Job/:jobId` every five seconds,
with a ten-minute default timeout. Successful terminal states are `completed`, `complete`, `success`, `succeeded`,
`video_generation_complete`, `video_generation_completed`, `api complete`, and `api_complete`. Failure terminal states
are `failed`, `failed-content`, `video_generation_failed`, `error`, `interrupted`, and `file_download_aborted`.
All other statuses—including queued, prompt, generation, send, reduction, upload, and file-obtained states—remain non-terminal.

On success, the client requests `GET /api/Universal/Job/:jobId/result`. A 404 can mean persisted media is not visible yet;
the client retries that result request six times at three-second intervals before reporting the error.

## HTTP errors

- 400: invalid payload, workflow, or required field
- 401: missing or invalid credentials
- 403: key/workflow/IP disallowed, or job owned by another owner
- 404: job missing/expired, or result not persisted yet
- 429: concurrency limit reached
- 500/502: Universal Generation or downstream provider failure

Upload errors are field-specific. Network and 5xx upload failures are retried twice with a one-second delay; validation,
authentication, authorization, and other non-retryable errors are shown immediately.
