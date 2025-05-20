import dotenv from 'dotenv';
// Load environment variables from .env file at the very beginning
dotenv.config();
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { GooglePlacesClient } from './googlePlacesClient.js';
import { Language, PlaceInputType } from '@googlemaps/google-maps-services-js';
// Initialize the GooglePlacesClient
// It will pick up the API key from the .env file via its own constructor
const placesClient = new GooglePlacesClient();
// Create FastMCP server instance
const server = new FastMCP({
    name: 'Google Places MCP Server',
    version: '1.0.0',
    // description: 'Provides tools to interact with Google Places API for finding places, getting details, and photos.', // Description is not a direct constructor option
});
// --- Tool 1: find_place ---
server.addTool({
    name: 'find_place',
    description: 'Searches for places based on a text query. Returns a list of candidates.',
    parameters: z.object({
        query: z.string().describe('The text string to search for (e.g., "restaurants in Paris", "Eiffel Tower").'),
        language: z.nativeEnum(Language).optional().describe('The language code (e.g., "en", "fr") to return results in.'),
        region: z.string().optional().describe('The region code (e.g., "us", "fr") to bias results towards.'),
        // location_bias: z.any().optional().describe('Defines a geographic area to bias results (e.g., circle or rectangle). Refer to Google Places API for structure.'), // Zod schema for location_bias can be complex
        inputtype: z.nativeEnum(PlaceInputType).optional().default(PlaceInputType.textQuery).describe('The type of input. Can be "textQuery" or "phoneNumber".'),
        fields: z.array(z.string()).optional().default(['place_id', 'name', 'formatted_address', 'types', 'geometry', 'icon_mask_base_uri', 'icon_background_color']).describe('Basic fields to return for each candidate.'),
        max_results: z.number().int().min(1).max(10).optional().default(5).describe('Maximum number of place candidates to return (default 5, max 10).')
    }),
    execute: async (args, { log }) => {
        log.info(`Tool 'find_place' called with query: ${args.query}`);
        try {
            const result = await placesClient.findPlace({
                query: args.query,
                language: args.language,
                region: args.region,
                inputtype: args.inputtype,
                fields: args.fields,
                max_results: args.max_results,
                // locationbias: args.location_bias, // Pass if defined and schema is added
            });
            return JSON.stringify(result, null, 2);
        }
        catch (error) {
            log.error(`Error in 'find_place' tool: ${error.message}`, error);
            return JSON.stringify({ status: "error", message: error.message }, null, 2);
        }
    },
});
// --- Tool 2: get_place_details ---
const defaultPlaceDetailFields = [
    'place_id', 'name', 'formatted_address', 'types', 'url', 'website', // Corrected 'type' to 'types'
    'international_phone_number', 'formatted_phone_number', 'geometry',
    'opening_hours', 'utc_offset_minutes', 'photos', 'rating', // Corrected 'photo' to 'photos'
    'user_ratings_total', 'reviews', 'price_level', 'business_status' // Corrected 'review' to 'reviews'
];
server.addTool({
    name: 'get_place_details',
    description: 'Retrieves detailed information about a specific place using its Place ID.',
    parameters: z.object({
        place_id: z.string().describe('The Place ID of the place.'),
        language: z.nativeEnum(Language).optional().describe('The language code for the results.'),
        region: z.string().optional().describe('The region code for biasing results.'),
        fields: z.array(z.string()).optional().default(defaultPlaceDetailFields).describe('Specific fields to request. Defaults to a comprehensive set.')
    }),
    execute: async (args, { log }) => {
        log.info(`Tool 'get_place_details' called for place_id: ${args.place_id}`);
        try {
            const result = await placesClient.getPlaceDetails({
                place_id: args.place_id,
                language: args.language,
                region: args.region,
                fields: args.fields,
            });
            return JSON.stringify(result, null, 2);
        }
        catch (error) {
            log.error(`Error in 'get_place_details' tool: ${error.message}`, error);
            return JSON.stringify({ status: "error", message: error.message }, null, 2);
        }
    },
});
// --- Tool 3: get_place_photo_url ---
server.addTool({
    name: 'get_place_photo_url',
    description: 'Constructs and returns a direct URL to a place photo using its photo reference.',
    parameters: z.object({
        photo_reference: z.string().describe('The reference string for the photo, obtained from get_place_details.'),
        max_width: z.number().int().optional().describe('Maximum desired width of the photo in pixels.'),
        max_height: z.number().int().optional().describe('Maximum desired height of the photo in pixels.'),
    }),
    execute: async (args, { log }) => {
        log.info(`Tool 'get_place_photo_url' called for photo_reference: ${args.photo_reference}`);
        if (!args.max_width && !args.max_height) {
            const message = "At least one of max_width or max_height must be provided for get_place_photo_url.";
            log.warn(message);
            return JSON.stringify({ status: "error", message }, null, 2);
        }
        try {
            const photoUrl = placesClient.getPlacePhotoUrl({
                photo_reference: args.photo_reference,
                max_width: args.max_width,
                max_height: args.max_height,
            });
            // The Place Details 'photos' array also contains 'html_attributions'.
            // It's better to get attributions from the Place Details call along with the photo_reference.
            // This tool will just return the URL. Claude can be prompted to use attributions from Place Details.
            return JSON.stringify({ status: "success", photo_url: photoUrl }, null, 2);
        }
        catch (error) {
            log.error(`Error in 'get_place_photo_url' tool: ${error.message}`, error);
            return JSON.stringify({ status: "error", message: error.message }, null, 2);
        }
    },
});
// Start the server, explicitly specifying stdio transport.
// This will keep the process alive and handle stdio communication.
console.error('Google Places MCP Server initialized. Starting stdio transport...');
server.start({ transportType: "stdio" })
    .then(() => {
    console.error('Google Places MCP Server successfully started on stdio.');
})
    .catch(error => {
    console.error('Failed to start Google Places MCP Server on stdio:', error);
    process.exit(1);
});
