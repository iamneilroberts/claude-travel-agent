import { Language, PlaceInputType } from "@googlemaps/google-maps-services-js";
export declare class GooglePlacesClient {
    private apiKey;
    constructor();
    findPlace(params: {
        query: string;
        language?: Language;
        region?: string;
        inputtype?: PlaceInputType;
        fields?: string[];
        max_results?: number;
    }): Promise<any>;
    getPlaceDetails(params: {
        place_id: string;
        language?: Language;
        region?: string;
        fields?: string[];
    }): Promise<any>;
    getPlacePhotoUrl(params: {
        photo_reference: string;
        max_width?: number;
        max_height?: number;
    }): string;
}
