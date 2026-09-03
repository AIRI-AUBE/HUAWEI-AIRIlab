# Universal Generation API integration

The V3 client uses the API origin in `VITE_AIRI_API_BASE_URL`. Upload routing can be overridden with
`VITE_AIRI_UPLOAD_PATH`; otherwise it uses `/api/Workflow/UploadMedia`. `VITE_AIRI_PROJECT_ID`
and `VITE_AIRI_TEAM_ID` must identify the current owner/environment and must never be copied from API examples.

## Authentication and security

Requests use same-origin credentials. `VITE_AIRI_API_KEY` is supported for controlled deployments that explicitly
accept a browser-visible key, but production deployments should put `X-AIRI-API-Key` on a server-side proxy instead.
Never commit, log, place in a URL, or display a raw key.

## Workflow 44 V3

Generation submits `POST /api/Universal/Generate` with JSON shaped as follows:

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
    "referenceImage": [{ "url": "https://<persisted-reference-url>" }],
    "language": "chs"
}
```

`projectId` and `teamId` are submitted as numbers sourced from the environment. `referenceImage` supports zero through
three entries, and each entry contains only an HTTPS `url`. Local object URLs are preview-only and are never submitted.

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
