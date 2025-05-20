var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-UTMJWA/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-UTMJWA/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/auth.ts
async function handleAuth(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (request.method === "OPTIONS") {
    return null;
  }
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": "Bearer"
      }
    });
  }
  const token = authHeader.substring(7);
  if (token !== env.MCP_AUTH_KEY) {
    return new Response("Invalid token", { status: 403 });
  }
  return null;
}
__name(handleAuth, "handleAuth");

// node_modules/uuid/dist/esm-browser/rng.js
var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
  if (!getRandomValues) {
    getRandomValues = typeof crypto !== "undefined" && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);
    if (!getRandomValues) {
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    }
  }
  return getRandomValues(rnds8);
}
__name(rng, "rng");

// node_modules/uuid/dist/esm-browser/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]];
}
__name(unsafeStringify, "unsafeStringify");

// node_modules/uuid/dist/esm-browser/native.js
var randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
var native_default = {
  randomUUID
};

// node_modules/uuid/dist/esm-browser/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
__name(v4, "v4");
var v4_default = v4;

// src/protocol.ts
async function handleMcpRequest(request, tools, corsHeaders) {
  try {
    const json = await request.json();
    const response = await processJsonRpcRequest(json, tools);
    return new Response(JSON.stringify(response), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error("Parse error in handleMcpRequest:", error);
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32700,
        message: "Parse error"
      },
      id: null
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
}
__name(handleMcpRequest, "handleMcpRequest");
async function handleSseRequest(request, tools, corsHeaders) {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        jsonrpc: "2.0",
        method: "connected",
        params: { sessionId: v4_default() }
      })}

`));
      try {
        const reader = request.body?.getReader();
        if (!reader) return;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = new TextDecoder().decode(value);
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              try {
                const json = JSON.parse(data);
                const response = await processJsonRpcRequest(json, tools);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(response)}

`));
              } catch (e) {
                console.error("Error processing SSE message:", e);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  jsonrpc: "2.0",
                  error: {
                    code: -32603,
                    message: "Internal error",
                    data: e instanceof Error ? e.message : "Unknown error"
                  },
                  id: null
                })}

`));
              }
            }
          }
        }
      } catch (error) {
        console.error("SSE error:", error);
      } finally {
        controller.close();
      }
    }
  });
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      ...corsHeaders
    }
  });
}
__name(handleSseRequest, "handleSseRequest");
async function processJsonRpcRequest(request, tools) {
  switch (request.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            prompts: {}
          },
          serverInfo: {
            name: "Google Places API MCP Server",
            version: "1.0.0"
          }
        },
        id: request.id
      };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        result: { tools: tools.tools },
        id: request.id
      };
    case "tools/call":
      try {
        const { name, arguments: args } = request.params;
        const handler = tools.handlers.get(name);
        if (!handler) {
          return {
            jsonrpc: "2.0",
            error: {
              code: -32601,
              message: `Tool not found: ${name}`
            },
            id: request.id
          };
        }
        const result = await handler(args);
        return {
          jsonrpc: "2.0",
          result: {
            content: [
              { type: "text", text: JSON.stringify(result) }
            ]
          },
          id: request.id
        };
      } catch (error) {
        console.error(`Error executing tool:`, error);
        return {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal error",
            data: error instanceof Error ? error.message : "Unknown error"
          },
          id: request.id
        };
      }
    default:
      return {
        jsonrpc: "2.0",
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`
        },
        id: request.id
      };
  }
}
__name(processJsonRpcRequest, "processJsonRpcRequest");

// src/googlePlacesFetchClient.ts
var GooglePlacesFetchClient = class {
  static {
    __name(this, "GooglePlacesFetchClient");
  }
  apiKey;
  constructor(apiKey) {
    if (!apiKey) {
      console.error("FATAL ERROR: Google Maps API Key is not defined");
      throw new Error("GooglePlacesFetchClient: Google Maps API Key is not configured");
    }
    this.apiKey = apiKey;
  }
  // Field mapping between legacy field names (used by Claude) and Places API v1 field paths
  FIELD_MAPPING = {
    "place_id": "id",
    "name": "displayName",
    "formatted_address": "formattedAddress",
    "types": "types",
    "geometry": "location",
    "photos": "photos",
    "rating": "rating",
    "user_ratings_total": "userRatingCount",
    "editorial_summary": "editorialSummary",
    "formatted_phone_number": "internationalPhoneNumber",
    "website": "websiteUri",
    "url": "googleMapsUri",
    "opening_hours": "regularOpeningHours",
    "price_level": "priceLevel",
    "business_status": "businessStatus"
  };
  // Map Claude-style field names to Google Places API v1 field paths
  mapFieldNames(fields) {
    if (!fields || fields.length === 0) {
      return "name,formattedAddress,types,location,id";
    }
    const mappedFields = fields.map((field) => {
      switch (field) {
        case "place_id":
          return "id";
        case "name":
          return "displayName.text";
        case "formatted_address":
          return "formattedAddress";
        case "types":
          return "types";
        case "geometry":
          return "location";
        case "photos":
          return "photos";
        case "rating":
          return "rating";
        case "user_ratings_total":
          return "userRatingCount";
        case "editorial_summary":
          return "editorialSummary.text";
        case "formatted_phone_number":
          return "internationalPhoneNumber";
        case "website":
          return "websiteUri";
        case "url":
          return "googleMapsUri";
        case "opening_hours":
          return "regularOpeningHours";
        case "price_level":
          return "priceLevel";
        case "business_status":
          return "businessStatus";
        default:
          return field.startsWith("places.") ? field.substring(7) : field;
      }
    });
    return mappedFields.join(",");
  }
  // Method to find places
  async findPlace(params) {
    console.error(`GooglePlacesFetchClient.findPlace called with query: ${params.query}`);
    try {
      let fieldMask = "places.displayName,places.formattedAddress,places.id";
      if (params.fields && params.fields.length > 0) {
        fieldMask = params.fields.map((field) => {
          switch (field) {
            case "place_id":
              return "places.id";
            case "name":
              return "places.displayName";
            case "formatted_address":
              return "places.formattedAddress";
            case "types":
              return "places.types";
            case "geometry":
              return "places.location";
            case "photos":
              return "places.photos";
            default:
              return `places.${field}`;
          }
        }).join(",");
      }
      console.error(`Using field mask: ${fieldMask}`);
      const searchUrl = new URL("https://places.googleapis.com/v1/places:searchText");
      const requestBody = {
        textQuery: params.query,
        ...params.language && { languageCode: params.language },
        ...params.region && { regionCode: params.region }
      };
      console.error(`Request body: ${JSON.stringify(requestBody)}`);
      console.error(`Fetching from URL: ${searchUrl.toString()}`);
      const finalUrl = `${searchUrl.toString()}?key=${this.apiKey}`;
      console.error("Final search URL (with key redacted):", finalUrl.replace(this.apiKey, "REDACTED"));
      const response = await fetch(finalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-FieldMask": fieldMask
        },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error: ${errorText}`);
        throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.error(`Received places data: ${JSON.stringify(data).substring(0, 200)}...`);
      const places = data.places || [];
      const limitedPlaces = params.max_results && params.max_results > 0 ? places.slice(0, params.max_results) : places;
      return {
        status: "success",
        candidates: limitedPlaces.map((place) => ({
          place_id: place.id,
          name: place.displayName?.text,
          formatted_address: place.formattedAddress,
          types: place.types,
          geometry: {
            location: {
              lat: place.location?.latitude,
              lng: place.location?.longitude
            }
          }
        }))
      };
    } catch (e) {
      console.error(`GooglePlacesFetchClient.findPlace exception: ${e.message}`, e);
      return { status: "error", message: e.message };
    }
  }
  // Method to get place details
  async getPlaceDetails(params) {
    console.error(`GooglePlacesFetchClient.getPlaceDetails called for place_id: ${params.place_id}`);
    try {
      let fieldMask = "places.displayName,places.formattedAddress,places.id,places.photos";
      if (params.fields && params.fields.length > 0) {
        fieldMask = params.fields.map((field) => {
          switch (field) {
            case "place_id":
              return "places.id";
            case "name":
              return "places.displayName";
            case "formatted_address":
              return "places.formattedAddress";
            case "types":
              return "places.types";
            case "geometry":
              return "places.location";
            case "photos":
              return "places.photos";
            case "rating":
              return "places.rating";
            case "user_ratings_total":
              return "places.userRatingCount";
            case "editorial_summary":
              return "places.editorialSummary.text";
            case "formatted_phone_number":
              return "places.internationalPhoneNumber";
            case "website":
              return "places.websiteUri";
            case "url":
              return "places.googleMapsUri";
            case "opening_hours":
              return "places.regularOpeningHours";
            case "price_level":
              return "places.priceLevel";
            case "business_status":
              return "places.businessStatus";
            default:
              return `places.${field}`;
          }
        }).join(",");
      }
      console.error(`Using field mask: ${fieldMask}`);
      const detailsUrl = new URL(`https://places.googleapis.com/v1/places/${params.place_id}`);
      const urlParams = new URLSearchParams();
      urlParams.append("key", this.apiKey);
      if (params.language) {
        urlParams.append("languageCode", params.language);
      }
      if (params.region) {
        urlParams.append("regionCode", params.region);
      }
      const finalUrl = `${detailsUrl.toString()}?${urlParams.toString()}`;
      console.error("Final URL (with key redacted):", finalUrl.replace(this.apiKey, "REDACTED"));
      const response = await fetch(finalUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-FieldMask": fieldMask
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error: ${errorText}`);
        throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
      }
      const place = await response.json();
      console.error(`Received place data: ${JSON.stringify(place).substring(0, 200)}...`);
      return {
        status: "success",
        result: {
          place_id: place.id,
          name: place.displayName?.text,
          formatted_address: place.formattedAddress,
          types: place.types,
          rating: place.rating,
          user_ratings_total: place.userRatingCount,
          editorial_summary: place.editorialSummary?.text,
          formatted_phone_number: place.internationalPhoneNumber,
          website: place.websiteUri,
          url: place.googleMapsUri,
          business_status: place.businessStatus,
          // Handle opening hours
          opening_hours: place.regularOpeningHours ? {
            open_now: place.regularOpeningHours.openNow,
            weekday_text: place.regularOpeningHours.weekdayDescriptions
          } : void 0,
          // Handle photos
          photos: place.photos?.map((photo) => ({
            photo_reference: photo.name,
            // The photo name is used as the reference in Places API v1
            height: photo.heightPx,
            width: photo.widthPx
          }))
        }
      };
    } catch (e) {
      console.error(`GooglePlacesFetchClient.getPlaceDetails exception: ${e.message}`, e);
      return { status: "error", message: e.message };
    }
  }
  // Method to get place photo URL
  getPlacePhotoUrl(params) {
    console.error(`GooglePlacesFetchClient.getPlacePhotoUrl called for photo_reference: ${params.photo_reference}`);
    try {
      let photoRef = params.photo_reference;
      if (!photoRef.includes("places/") && !photoRef.includes("photos/")) {
        photoRef = `photos/${photoRef}`;
      }
      let photoUrl = `https://places.googleapis.com/v1/${photoRef}/media`;
      const urlParams = new URLSearchParams();
      urlParams.append("key", this.apiKey);
      if (params.max_width) {
        urlParams.append("maxWidthPx", params.max_width.toString());
      }
      if (params.max_height) {
        urlParams.append("maxHeightPx", params.max_height.toString());
      }
      if (!params.max_width && !params.max_height) {
        urlParams.append("maxWidthPx", "800");
      }
      const finalUrl = `${photoUrl}?${urlParams.toString()}`;
      console.error("Final photo URL (with key redacted):", finalUrl.replace(this.apiKey, "REDACTED"));
      return {
        status: "success",
        url: finalUrl
      };
    } catch (e) {
      console.error(`GooglePlacesFetchClient.getPlacePhotoUrl exception: ${e.message}`, e);
      return { status: "error", message: e.message };
    }
  }
};

// src/tools/index.ts
function initializeTools(env) {
  const registry = {
    tools: [],
    handlers: /* @__PURE__ */ new Map()
  };
  const placesClient = new GooglePlacesFetchClient(env.GOOGLE_MAPS_API_KEY);
  registry.tools.push({
    name: "find_place",
    description: "Searches for places based on a text query. Returns a list of candidates.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: 'The text string to search for (e.g., "restaurants in Paris", "Eiffel Tower").'
        },
        language: {
          type: "string",
          description: 'The language code (e.g., "en", "fr") to return results in.',
          enum: ["ar", "be", "bg", "bn", "ca", "cs", "da", "de", "el", "en", "en-Au", "en-GB", "es", "eu", "fa", "fi", "fil", "fr", "gl", "gu", "hi", "hr", "hu", "id", "it", "iw", "ja", "kk", "kn", "ko", "ky", "lt", "lv", "mk", "ml", "mr", "my", "nl", "no", "pa", "pl", "pt", "pt-BR", "pt-PT", "ro", "ru", "sk", "sl", "sq", "sr", "sv", "ta", "te", "th", "tl", "tr", "uk", "uz", "vi", "zh-CN", "zh-TW"]
        },
        region: {
          type: "string",
          description: 'The region code (e.g., "us", "fr") to bias results towards.'
        },
        fields: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Fields to include in the response."
        },
        max_results: {
          type: "integer",
          description: "Maximum number of place candidates to return (default 5, max 10).",
          default: 5,
          maximum: 10,
          minimum: 1
        }
      },
      required: ["query"]
    }
  });
  registry.handlers.set("find_place", async (args) => {
    try {
      const result = await placesClient.findPlace({
        query: args.query,
        language: args.language,
        region: args.region,
        fields: args.fields,
        max_results: args.max_results || 5
      });
      return result;
    } catch (error) {
      console.error(`Error in 'find_place' tool:`, error);
      return { status: "error", message: error instanceof Error ? error.message : "Unknown error" };
    }
  });
  registry.tools.push({
    name: "get_place_details",
    description: "Retrieves detailed information about a specific place using its Place ID.",
    inputSchema: {
      type: "object",
      properties: {
        place_id: {
          type: "string",
          description: "The Place ID of the place."
        },
        language: {
          type: "string",
          description: "The language code for the results.",
          enum: ["ar", "be", "bg", "bn", "ca", "cs", "da", "de", "el", "en", "en-Au", "en-GB", "es", "eu", "fa", "fi", "fil", "fr", "gl", "gu", "hi", "hr", "hu", "id", "it", "iw", "ja", "kk", "kn", "ko", "ky", "lt", "lv", "mk", "ml", "mr", "my", "nl", "no", "pa", "pl", "pt", "pt-BR", "pt-PT", "ro", "ru", "sk", "sl", "sq", "sr", "sv", "ta", "te", "th", "tl", "tr", "uk", "uz", "vi", "zh-CN", "zh-TW"]
        },
        region: {
          type: "string",
          description: "The region code for biasing results."
        },
        fields: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Specific fields to request."
        }
      },
      required: ["place_id"]
    }
  });
  registry.handlers.set("get_place_details", async (args) => {
    try {
      const result = await placesClient.getPlaceDetails({
        place_id: args.place_id,
        language: args.language,
        region: args.region,
        fields: args.fields
      });
      return result;
    } catch (error) {
      console.error(`Error in 'get_place_details' tool:`, error);
      return { status: "error", message: error instanceof Error ? error.message : "Unknown error" };
    }
  });
  registry.tools.push({
    name: "get_place_photo_url",
    description: "Constructs and returns a direct URL to a place photo using its photo reference.",
    inputSchema: {
      type: "object",
      properties: {
        photo_reference: {
          type: "string",
          description: "The reference string for the photo, obtained from get_place_details."
        },
        max_width: {
          type: "integer",
          description: "Maximum desired width of the photo in pixels."
        },
        max_height: {
          type: "integer",
          description: "Maximum desired height of the photo in pixels."
        }
      },
      required: ["photo_reference"]
    }
  });
  registry.handlers.set("get_place_photo_url", (args) => {
    try {
      const result = placesClient.getPlacePhotoUrl({
        photo_reference: args.photo_reference,
        max_width: args.max_width,
        max_height: args.max_height
      });
      return result;
    } catch (error) {
      console.error(`Error in 'get_place_photo_url' tool:`, error);
      return { status: "error", message: error instanceof Error ? error.message : "Unknown error" };
    }
  });
  return registry;
}
__name(initializeTools, "initializeTools");

// src/index.ts
var src_default = {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    try {
      const authResponse = await handleAuth(request, env);
      if (authResponse) return authResponse;
      const tools = initializeTools(env);
      const url = new URL(request.url);
      if (url.pathname === "/rpc") {
        return handleMcpRequest(request, tools, corsHeaders);
      } else if (url.pathname === "/sse") {
        return handleSseRequest(request, tools, corsHeaders);
      } else if (url.pathname === "/") {
        return handleMcpRequest(request, tools, corsHeaders);
      } else {
        return new Response("Not Found", {
          status: 404,
          headers: corsHeaders
        });
      }
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : "Unknown error"
        },
        id: null
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-UTMJWA/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-UTMJWA/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
