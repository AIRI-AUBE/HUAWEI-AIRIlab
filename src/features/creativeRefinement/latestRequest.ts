export const createLatestRequestGate = () => {
    let currentRequest = 0;
    let activeRequest: number | undefined;
    let activeController: AbortController | undefined;

    return {
        begin: () => {
            activeController?.abort();
            currentRequest += 1;
            activeRequest = currentRequest;
            activeController = new AbortController();
            return currentRequest;
        },
        invalidate: () => {
            if (activeRequest === undefined) return false;
            activeController?.abort();
            activeRequest = undefined;
            activeController = undefined;
            return true;
        },
        complete: (request: number) => {
            if (request !== activeRequest) return false;
            activeRequest = undefined;
            activeController = undefined;
            return true;
        },
        hasActive: () => activeRequest !== undefined,
        isCurrent: (request: number) => request === activeRequest,
        signal: (request: number) => {
            if (request !== activeRequest || !activeController) {
                throw new Error('Cannot access an inactive request signal.');
            }
            return activeController.signal;
        },
    };
};
