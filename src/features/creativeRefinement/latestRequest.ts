export const createLatestRequestGate = () => {
    let currentRequest = 0;
    let activeRequest: number | undefined;

    return {
        begin: () => {
            currentRequest += 1;
            activeRequest = currentRequest;
            return currentRequest;
        },
        invalidate: () => {
            if (activeRequest === undefined) return false;
            activeRequest = undefined;
            return true;
        },
        complete: (request: number) => {
            if (request !== activeRequest) return false;
            activeRequest = undefined;
            return true;
        },
        isCurrent: (request: number) => request === activeRequest,
    };
};
