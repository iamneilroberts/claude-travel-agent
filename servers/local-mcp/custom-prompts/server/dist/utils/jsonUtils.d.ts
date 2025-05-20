import { PromptData } from '../types.js';
/**
 * Validates JSON arguments against the prompt's expected arguments
 * @param jsonArgs The JSON arguments to validate
 * @param prompt The prompt data containing expected arguments
 * @returns Object with validation results and sanitized arguments
 */
export declare function validateJsonArguments(jsonArgs: any, prompt: PromptData): {
    valid: boolean;
    errors?: string[];
    sanitizedArgs?: Record<string, any>;
};
/**
 * Processes a template string by replacing placeholders with values
 * @param template The template string with placeholders
 * @param args The arguments to replace placeholders with
 * @param specialContext Special context values to replace first
 * @returns The processed template string
 */
export declare function processTemplate(template: string, args: Record<string, string>, specialContext?: Record<string, string>): string;
