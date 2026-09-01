export type UploadStatus = 'idle' | 'validating' | 'uploading' | 'success' | 'error';

export type ImageRole = 'base-image' | 'reference-image';

export type UploadedImage = {
    id: string;
    url: string;
    previewUrl: string;
    mediaId?: string;
    tags: string[];
    uploadStatus: UploadStatus;
    error?: string;
    file?: File;
    sourceType: 'template' | 'user-upload';
};

export type UploadProgress = (status: UploadStatus) => void;
