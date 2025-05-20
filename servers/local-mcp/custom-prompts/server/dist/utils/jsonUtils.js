// JSON utility functions
/**
 * Validates JSON arguments against the prompt's expected arguments
 * @param jsonArgs The JSON arguments to validate
 * @param prompt The prompt data containing expected arguments
 * @returns Object with validation results and sanitized arguments
 */
export function validateJsonArguments(jsonArgs, prompt) {
    const errors = [];
    const sanitizedArgs = {};
    // Check for unexpected properties
    const expectedArgNames = prompt.arguments.map(arg => arg.name);
    const providedArgNames = Object.keys(jsonArgs);
    for (const argName of providedArgNames) {
        if (!expectedArgNames.includes(argName)) {
            errors.push(`Unexpected argument: ${argName}`);
        }
    }
    // Check for and sanitize expected arguments
    for (const arg of prompt.arguments) {
        const value = jsonArgs[arg.name];
        // All arguments are treated as optional now
        if (value !== undefined) {
            // Sanitize the value based on expected type
            // This is a simple implementation - expand as needed for your use case
            if (typeof value === "string") {
                // Sanitize string inputs
                sanitizedArgs[arg.name] = value
                    .replace(/[<>]/g, '') // Remove potentially dangerous HTML characters
                    .trim();
            }
            else if (typeof value === "number") {
                // Ensure it's a valid number
                sanitizedArgs[arg.name] = isNaN(value) ? 0 : value;
            }
            else if (typeof value === "boolean") {
                sanitizedArgs[arg.name] = !!value; // Ensure boolean type
            }
            else if (Array.isArray(value)) {
                // For arrays, sanitize each element if they're strings
                sanitizedArgs[arg.name] = value.map(item => typeof item === "string" ? item.replace(/[<>]/g, '').trim() : item);
            }
            else if (value !== null && typeof value === "object") {
                // For objects, convert to string for simplicity
                sanitizedArgs[arg.name] = JSON.stringify(value);
            }
            else {
                // For any other type, convert to string
                sanitizedArgs[arg.name] = String(value);
            }
        }
    }
    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        sanitizedArgs
    };
}
/**
 * Processes a template string by replacing placeholders with values
 * @param template The template string with placeholders
 * @param args The arguments to replace placeholders with
 * @param specialContext Special context values to replace first
 * @returns The processed template string
 */
export function processTemplate(template, args, specialContext = {}) {
    let processed = template;
    // Process special context placeholders first
    Object.entries(specialContext).forEach(([key, value]) => {
        processed = processed.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
    });
    // Replace regular placeholders with argument values
    Object.entries(args).forEach(([key, value]) => {
        if (value !== undefined) {
            processed = processed.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
        }
    });
    return processed;
}
//# sourceMappingURL=jsonUtils.js.map