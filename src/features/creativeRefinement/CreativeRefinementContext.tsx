import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
} from 'react';
import type { BaseImageType } from '../../data/v3/cases';
import type { GenerationOutput } from '../generation/types';
import { disposeUploadedImage } from '../imageUpload/pipeline';
import type { UploadedImage, UploadStatus } from '../imageUpload/types';

export type V3FormState = {
    baseImageType: BaseImageType;
    baseImage?: UploadedImage;
    referenceImages: UploadedImage[];
    prompt: string;
};

export type GenerationStatus =
    'idle' | 'validating' | 'submitting' | 'generating' | 'completed' | 'failed';

type Setter<T> = Dispatch<SetStateAction<T>>;
type TemplateStatus = 'idle' | 'loading' | 'success' | 'error';

type CreativeRefinementContextValue = {
    form: V3FormState;
    setForm: Setter<V3FormState>;
    activeReference: number;
    setActiveReference: Setter<number>;
    templateOpen: boolean;
    setTemplateOpen: Setter<boolean>;
    selectedTemplateId?: string;
    setSelectedTemplateId: Setter<string | undefined>;
    baseStatus: UploadStatus;
    setBaseStatus: Setter<UploadStatus>;
    baseError: string;
    setBaseError: Setter<string>;
    referenceError: string;
    setReferenceError: Setter<string>;
    referenceStatus: UploadStatus;
    setReferenceStatus: Setter<UploadStatus>;
    referenceLoadingCount: number;
    setReferenceLoadingCount: Setter<number>;
    templateStatus: TemplateStatus;
    setTemplateStatus: Setter<TemplateStatus>;
    templateError: string;
    setTemplateError: Setter<string>;
    loadingTemplateId?: string;
    setLoadingTemplateId: Setter<string | undefined>;
    generationStatus: GenerationStatus;
    setGenerationStatus: Setter<GenerationStatus>;
    jobId: string;
    setJobId: Setter<string>;
    generationError: string;
    setGenerationError: Setter<string>;
    outputs: GenerationOutput[];
    setOutputs: Setter<GenerationOutput[]>;
};

const CreativeRefinementContext = createContext<CreativeRefinementContextValue | undefined>(
    undefined,
);

export function CreativeRefinementProvider({ children }: { children: ReactNode }) {
    const [form, setForm] = useState<V3FormState>({
        baseImageType: 'architecture',
        referenceImages: [],
        prompt: '',
    });
    const [activeReference, setActiveReference] = useState(0);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
    const [baseStatus, setBaseStatus] = useState<UploadStatus>('idle');
    const [baseError, setBaseError] = useState('');
    const [referenceError, setReferenceError] = useState('');
    const [referenceStatus, setReferenceStatus] = useState<UploadStatus>('idle');
    const [referenceLoadingCount, setReferenceLoadingCount] = useState(0);
    const [templateStatus, setTemplateStatus] = useState<TemplateStatus>('idle');
    const [templateError, setTemplateError] = useState('');
    const [loadingTemplateId, setLoadingTemplateId] = useState<string>();
    const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle');
    const [jobId, setJobId] = useState('');
    const [generationError, setGenerationError] = useState('');
    const [outputs, setOutputs] = useState<GenerationOutput[]>([]);

    useEffect(
        () => () => {
            if (form.baseImage) disposeUploadedImage(form.baseImage);
            form.referenceImages.forEach(disposeUploadedImage);
        },
        [],
    );

    const value = useMemo<CreativeRefinementContextValue>(
        () => ({
            form,
            setForm,
            activeReference,
            setActiveReference,
            templateOpen,
            setTemplateOpen,
            selectedTemplateId,
            setSelectedTemplateId,
            baseStatus,
            setBaseStatus,
            baseError,
            setBaseError,
            referenceError,
            setReferenceError,
            referenceStatus,
            setReferenceStatus,
            referenceLoadingCount,
            setReferenceLoadingCount,
            templateStatus,
            setTemplateStatus,
            templateError,
            setTemplateError,
            loadingTemplateId,
            setLoadingTemplateId,
            generationStatus,
            setGenerationStatus,
            jobId,
            setJobId,
            generationError,
            setGenerationError,
            outputs,
            setOutputs,
        }),
        [
            form,
            activeReference,
            templateOpen,
            selectedTemplateId,
            baseStatus,
            baseError,
            referenceError,
            referenceStatus,
            referenceLoadingCount,
            templateStatus,
            templateError,
            loadingTemplateId,
            generationStatus,
            jobId,
            generationError,
            outputs,
        ],
    );

    return (
        <CreativeRefinementContext.Provider value={value}>
            {children}
        </CreativeRefinementContext.Provider>
    );
}

export function useCreativeRefinement() {
    const context = useContext(CreativeRefinementContext);
    if (!context) {
        throw new Error('useCreativeRefinement must be used within CreativeRefinementProvider.');
    }
    return context;
}
