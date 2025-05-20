import { Client, PlaceInputType } from "@googlemaps/google-maps-services-js";
// import dotenv from 'dotenv'; // dotenv should be handled by the server's entry point or calling environment
// Top-level constant and check for GOOGLE_MAPS_API_KEY removed.
// This will now be handled solely within the constructor based on process.env.
const client = new Client({});
export class GooglePlacesClient {
    apiKey;
    constructor() {
        const apiKeyFromEnv = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKeyFromEnv) {
            console.error("FATAL ERROR: GOOGLE_MAPS_API_KEY is not defined in process.env. The MCP server must be launched with this environment variable set (e.g., via its own .env file loaded by the main server.ts, or via Claude Desktop config's 'env' property).");
            throw new Error("GooglePlacesClient: GOOGLE_MAPS_API_KEY is not configured in the process environment.");
        }
        this.apiKey = apiKeyFromEnv;
        console.error("GooglePlacesClient initialized."); // Log to stderr
    }
    // Method to find places (Text Search or Find Place from Text)
    async findPlace(params) {
        console.error(`GooglePlacesClient.findPlace called with query: ${params.query}`);
        try {
            // Example using findPlaceFromText, which is good for ambiguous queries
            // Or use textSearch for broader searches
            const response = await client.findPlaceFromText({
                params: {
                    input: params.query,
                    inputtype: params.inputtype || PlaceInputType.textQuery, // textQuery or phoneNumber
                    fields: params.fields || ['place_id', 'name', 'formatted_address', 'types', 'geometry', 'icon_mask_base_uri', 'icon_background_color'], // Basic fields
                    language: params.language,
                    // region: params.region, // 'region' might not be a direct param for findPlaceFromText, needs verification. Removing for now.
                    key: this.apiKey,
                    // Add locationbias if provided in params
                },
            });
            if (response.data.status === "OK") {
                // If max_results is specified, slice the candidates
                const candidates = params.max_results
                    ? response.data.candidates.slice(0, params.max_results)
                    : response.data.candidates;
                return { status: "success", places: candidates };
            }
            else {
                console.error(`GooglePlacesClient.findPlace API error: ${response.data.status} - ${response.data.error_message || ''}`);
                return { status: "error", message: response.data.error_message || response.data.status };
            }
        }
        catch (e) {
            console.error(`GooglePlacesClient.findPlace exception: ${e.message}`, e);
            return { status: "error", message: e.message };
        }
    }
    // Method to get place details
    async getPlaceDetails(params) {
        console.error(`GooglePlacesClient.getPlaceDetails called for place_id: ${params.place_id}`);
        try {
            const defaultFields = [
                'place_id', 'name', 'formatted_address', 'types', 'url', 'website', // Corrected 'type' to 'types'
                'international_phone_number', 'formatted_phone_number', 'geometry',
                'opening_hours', 'utc_offset_minutes', 'photos', 'rating', // Corrected 'photo' to 'photos'
                'user_ratings_total', 'reviews', 'price_level', 'business_status' // Corrected 'review' to 'reviews'
            ];
            const response = await client.placeDetails({
                params: {
                    place_id: params.place_id,
                    // fields: params.fields || defaultFields, // Temporarily override with minimal fields for debugging
                    fields: ['place_id', 'name', 'photos'],
                    language: params.language,
                    region: params.region,
                    key: this.apiKey,
                },
            });
            if (response.data.status === "OK") {
                return { status: "success", details: response.data.result };
            }
            else {
                console.error(`GooglePlacesClient.getPlaceDetails API error: ${response.data.status} - ${response.data.error_message || ''}`);
                return { status: "error", message: response.data.error_message || response.data.status };
            }
        }
        catch (e) {
            console.error(`GooglePlacesClient.getPlaceDetails exception: ${e.message}`, e);
            return { status: "error", message: e.message };
        }
    }
    // Method to get place photo URL
    // The Google Places Photo API returns an image directly, or a redirect.
    // The client library might handle the redirect and give the final image URL,
    // or we might need to construct it. For MCP, returning the URL is best.
    getPlacePhotoUrl(params) {
        console.error(`GooglePlacesClient.getPlacePhotoUrl called for photo_reference: ${params.photo_reference}`);
        // Base URL for Place Photos
        // Corrected template literal syntax
        let photoUrl = `https://maps.googleapis.com/maps/api/place/photo?photo_reference=${params.photo_reference}&key=${this.apiKey}`;
        if (params.max_width) {
            photoUrl += `&maxwidth=${params.max_width}`;
        }
        if (params.max_height) {
            photoUrl += `&maxheight=${params.max_height}`;
        }
        // Note: The API requires at least one of maxwidth or maxheight.
        // The actual image might be served via a redirect from this URL.
        // For the MCP tool, returning this constructed URL is appropriate.
        // Claude or the displaying client will make the HTTP GET to this URL.
        return photoUrl; // Added return statement
    }
}
