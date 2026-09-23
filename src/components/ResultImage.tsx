import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { GenerationOutput } from '../features/generation/types';
import { exportImage } from '../features/imageExport/exportImage';

export function ResultImage({ output }: { output: GenerationOutput }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [failed, setFailed] = useState<'save' | 'share'>();
    const [imageError, setImageError] = useState(false);
    const [imageAttempt, setImageAttempt] = useState(0);
    const lock = useRef(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const previous = useRef<{ x: number; y: number; distance: number } | undefined>(undefined);
    const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    useEffect(() => {
        if (!open) return;
        dialog.current?.showModal();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = overflow;
            trigger.current?.focus();
        };
    }, [open]);
    const close = () => {
        setOpen(false);
        pointers.current.clear();
        previous.current = undefined;
    };
    const run = async (action: 'save' | 'share') => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setFailed(undefined);
        setMessage(t('result.preparing'));
        try {
            const result = await exportImage(output, action);
            if (mounted.current)
                setMessage(t(`result.${result.status}`, { filename: result.filename ?? '' }));
        } catch (error) {
            if (mounted.current) {
                const code =
                    (error as { code?: string; message?: string }).code ?? (error as Error).message;
                setFailed(action);
                setMessage(
                    t(
                        code === 'SIZE_LIMIT'
                            ? 'result.tooLarge'
                            : code === 'SHARE_UNAVAILABLE'
                              ? 'result.shareUnavailable'
                              : 'result.failed',
                    ),
                );
            }
        } finally {
            lock.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    const zoom = (delta: number) =>
        setView((v) => ({ scale: Math.max(1, Math.min(4, v.scale + delta)), x: 0, y: 0 }));
    const gesture = (event: PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const points = [...pointers.current.values()];
        const a = points[0],
            b = points[1] ?? a;
        const next = {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            distance: Math.hypot(a.x - b.x, a.y - b.y),
        };
        const last = previous.current;
        if (last) {
            const bounds = event.currentTarget.getBoundingClientRect();
            setView((v) => {
                const scale = Math.max(
                    1,
                    Math.min(
                        4,
                        last.distance && next.distance
                            ? (v.scale * next.distance) / last.distance
                            : v.scale,
                    ),
                );
                const limitX = (bounds.width * (scale - 1)) / 2,
                    limitY = (bounds.height * (scale - 1)) / 2;
                return {
                    scale,
                    x: Math.max(-limitX, Math.min(limitX, v.x + next.x - last.x)),
                    y: Math.max(-limitY, Math.min(limitY, v.y + next.y - last.y)),
                };
            });
        }
        previous.current = next;
    };
    const actions = (
        <>
            <div className="result-actions" aria-label={t('result.actions')}>
                <button type="button" disabled={busy} onClick={() => void run('save')}>
                    {t('result.save')}
                </button>
                <button type="button" disabled={busy} onClick={() => void run('share')}>
                    {t('result.share')}
                </button>
            </div>
            <div
                className="result-feedback"
                role={failed ? 'alert' : 'status'}
                aria-live="polite"
                aria-busy={busy}
            >
                {message}
                {failed && (
                    <button type="button" onClick={() => void run(failed)}>
                        {t('result.retry')}
                    </button>
                )}
            </div>
        </>
    );
    return (
        <div className="result-image">
            <button
                ref={trigger}
                className="result-image__open"
                type="button"
                aria-label={t('result.open')}
                onClick={() => {
                    setView({ scale: 1, x: 0, y: 0 });
                    setImageError(false);
                    setOpen(true);
                }}
            >
                <img src={output.thumbnail || output.url} alt={t('result.alt')} />
                <span>{t('result.open')}</span>
            </button>
            {actions}
            {open &&
                createPortal(
                    <dialog
                        ref={dialog}
                        className="image-viewer"
                        aria-label={t('result.original')}
                        onCancel={(event) => {
                            event.preventDefault();
                            close();
                        }}
                    >
                        <header>
                            <strong>{t('result.original')}</strong>
                            <button autoFocus type="button" data-image-viewer-close onClick={close}>
                                {t('result.close')}
                            </button>
                        </header>
                        <div
                            className="image-viewer__stage"
                            onPointerDown={(event) => {
                                event.currentTarget.setPointerCapture(event.pointerId);
                                pointers.current.set(event.pointerId, {
                                    x: event.clientX,
                                    y: event.clientY,
                                });
                                previous.current = undefined;
                            }}
                            onPointerMove={gesture}
                            onPointerUp={(event) => {
                                pointers.current.delete(event.pointerId);
                                previous.current = undefined;
                            }}
                            onPointerCancel={(event) => {
                                pointers.current.delete(event.pointerId);
                                previous.current = undefined;
                            }}
                            onDoubleClick={() =>
                                setView((v) => ({ scale: v.scale === 1 ? 2 : 1, x: 0, y: 0 }))
                            }
                        >
                            <img
                                key={imageAttempt}
                                src={output.url}
                                alt={t('result.alt')}
                                draggable={false}
                                onError={() => setImageError(true)}
                                onLoad={() => setImageError(false)}
                                style={{
                                    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                                }}
                            />
                        </div>
                        {imageError && (
                            <p role="alert">
                                {t('result.loadFailed')}{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setImageError(false);
                                        setImageAttempt((n) => n + 1);
                                    }}
                                >
                                    {t('result.retry')}
                                </button>
                            </p>
                        )}
                        <footer>
                            <div className="result-actions">
                                <button
                                    type="button"
                                    aria-label={t('result.zoomOut')}
                                    onClick={() => zoom(-0.5)}
                                    disabled={view.scale <= 1}
                                >
                                    −
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setView({ scale: 1, x: 0, y: 0 })}
                                >
                                    {Math.round(view.scale * 100)}% · {t('result.reset')}
                                </button>
                                <button
                                    type="button"
                                    aria-label={t('result.zoomIn')}
                                    onClick={() => zoom(0.5)}
                                    disabled={view.scale >= 4}
                                >
                                    +
                                </button>
                            </div>
                            <small>{t('result.gestures')}</small>
                            {actions}
                        </footer>
                    </dialog>,
                    document.body,
                )}
        </div>
    );
}
