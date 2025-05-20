export declare class PromptError extends Error {
    constructor(message: string);
}
export declare class ArgumentError extends Error {
    constructor(message: string);
}
export declare class ValidationError extends Error {
    validationErrors?: string[];
    constructor(message: string, validationErrors?: string[]);
}
export interface Logger {
    info: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
}
export declare function handleError(error: unknown, context: string, logger: Logger): {
    message: string;
    isError: boolean;
};
