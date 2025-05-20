var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-lS6mpk/checked-fetch.js
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

// .wrangler/tmp/bundle-lS6mpk/strip-cf-connecting-ip-header.js
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
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authorized: false };
  }
  const token = authHeader.slice(7);
  if (!env.MCP_AUTH_KEY) {
    console.error("MCP_AUTH_KEY not configured");
    return { authorized: false };
  }
  if (token === env.MCP_AUTH_KEY) {
    return { authorized: true, userId: "default" };
  }
  return { authorized: false };
}
__name(handleAuth, "handleAuth");

// src/protocol.ts
var toolRegistry = null;
function getToolRegistry() {
  if (!toolRegistry) {
    toolRegistry = {
      tools: [],
      handlers: /* @__PURE__ */ new Map()
    };
  }
  return toolRegistry;
}
__name(getToolRegistry, "getToolRegistry");
async function handleSseRequest(request, env, ctx) {
  return new Response("SSE endpoint not implemented", {
    status: 501,
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(handleSseRequest, "handleSseRequest");
async function handleMcpRequest(request, env, ctx) {
  try {
    const body = await request.text();
    const jsonRpcRequest = JSON.parse(body);
    const { method, params, id } = jsonRpcRequest;
    switch (method) {
      case "initialize": {
        const response = {
          jsonrpc: "2.0",
          result: {
            protocolVersion: "1.0",
            serverInfo: {
              name: "google-places-mcp",
              version: "1.0.0"
            },
            capabilities: {
              tools: {}
            }
          },
          id
        };
        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" }
        });
      }
      case "tools/list": {
        const registry = getToolRegistry();
        const response = {
          jsonrpc: "2.0",
          result: {
            tools: registry.tools
          },
          id
        };
        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" }
        });
      }
      case "tools/call": {
        const { name, arguments: toolArgs } = params;
        const registry = getToolRegistry();
        const handler = registry.handlers.get(name);
        if (!handler) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32601,
              message: `Tool not found: ${name}`
            },
            id
          }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
          });
        }
        try {
          const result = await handler(toolArgs);
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            result,
            id
          }), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : "Internal Server Error"
            },
            id
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      default: {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          },
          id
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  } catch (error) {
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32700,
        message: "Parse error"
      },
      id: null
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleMcpRequest, "handleMcpRequest");

// src/googlePlacesFetchClient.ts
var GooglePlacesFetchClient = class {
  static {
    __name(this, "GooglePlacesFetchClient");
  }
  apiKey;
  baseUrl = "https://places.googleapis.com/v1/places";
  constructor(env) {
    const apiKey = env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY environment variable is not set");
    }
    this.apiKey = apiKey;
  }
  async findPlace(params) {
    const url = "https://places.googleapis.com/v1/places:searchText";
    const requestBody = {
      textQuery: params.query,
      maxResultCount: params.max_results || 5
    };
    if (params.language) {
      requestBody.languageCode = params.language;
    }
    if (params.region) {
      requestBody.regionCode = params.region;
    }
    let fieldMask = "places.id,places.displayName,places.formattedAddress,places.types,places.location";
    if (params.fields && params.fields.length > 0) {
      const fieldMap = {
        "place_id": "id",
        "name": "displayName",
        "formatted_address": "formattedAddress",
        "geometry": "location",
        "icon_mask_base_uri": "iconMaskBaseUri",
        "icon_background_color": "iconBackgroundColor"
      };
      fieldMask = params.fields.map(
        (field) => `places.${fieldMap[field] || field}`
      ).join(",");
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": fieldMask
        },
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status} - ${JSON.stringify(data)}`);
      }
      return {
        candidates: data.places?.map((place) => ({
          place_id: place.id || place.name?.split("/").pop(),
          name: place.displayName?.text || "",
          formatted_address: place.formattedAddress || "",
          types: place.types || [],
          geometry: place.location ? {
            location: {
              lat: place.location.latitude,
              lng: place.location.longitude
            }
          } : void 0,
          // Include any other properties present
          ...place.iconMaskBaseUri && { icon_mask_base_uri: place.iconMaskBaseUri },
          ...place.iconBackgroundColor && { icon_background_color: place.iconBackgroundColor }
        })) || [],
        status: "OK"
      };
    } catch (error) {
      console.error("Error calling Google Places API:", error);
      throw error;
    }
  }
  async getPlaceDetails(params) {
    const placeName = `places/${params.place_id}`;
    const url = `https://places.googleapis.com/v1/${placeName}`;
    let fieldMask = "places.id,places.displayName,places.formattedAddress,places.types,places.googleMapsUri,places.websiteUri,places.internationalPhoneNumber,places.nationalPhoneNumber,places.location,places.regularOpeningHours,places.utcOffsetMinutes,places.photos,places.rating,places.userRatingCount,places.reviews,places.priceLevel,places.businessStatus";
    if (params.fields && params.fields.length > 0) {
      const fieldMap = {
        "place_id": "id",
        "name": "displayName",
        "formatted_address": "formattedAddress",
        "types": "types",
        "url": "googleMapsUri",
        "website": "websiteUri",
        "international_phone_number": "internationalPhoneNumber",
        "formatted_phone_number": "nationalPhoneNumber",
        "geometry": "location",
        "opening_hours": "regularOpeningHours",
        "utc_offset_minutes": "utcOffsetMinutes",
        "photos": "photos",
        "rating": "rating",
        "user_ratings_total": "userRatingCount",
        "reviews": "reviews",
        "price_level": "priceLevel",
        "business_status": "businessStatus"
      };
      fieldMask = params.fields.map(
        (field) => `places.${fieldMap[field] || field}`
      ).join(",");
    }
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": fieldMask
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status} - ${JSON.stringify(data)}`);
      }
      return {
        result: {
          place_id: data.id || params.place_id,
          name: data.displayName?.text || "",
          formatted_address: data.formattedAddress || "",
          types: data.types || [],
          url: data.googleMapsUri || "",
          website: data.websiteUri || "",
          international_phone_number: data.internationalPhoneNumber || "",
          formatted_phone_number: data.nationalPhoneNumber || "",
          geometry: data.location ? {
            location: {
              lat: data.location.latitude,
              lng: data.location.longitude
            }
          } : void 0,
          opening_hours: data.regularOpeningHours ? {
            weekday_text: data.regularOpeningHours.weekdayDescriptions || [],
            open_now: data.regularOpeningHours.openNow || false
          } : void 0,
          utc_offset_minutes: data.utcOffsetMinutes,
          photos: data.photos ? data.photos.map((photo) => ({
            photo_reference: photo.name || "",
            height: photo.heightPx || 0,
            width: photo.widthPx || 0
          })) : [],
          rating: data.rating || 0,
          user_ratings_total: data.userRatingCount || 0,
          reviews: data.reviews || [],
          price_level: data.priceLevel || 0,
          business_status: data.businessStatus || ""
        },
        status: "OK"
      };
    } catch (error) {
      console.error("Error calling Google Places API:", error);
      throw error;
    }
  }
  getPlacePhotoUrl(params) {
    if (params.photo_reference.startsWith("http")) {
      return params.photo_reference;
    }
    if (params.photo_reference.includes("/photos/")) {
      const baseUrl = "https://places.googleapis.com/v1";
      return `${baseUrl}/${params.photo_reference}/media?maxWidthPx=${params.max_width || 400}&maxHeightPx=${params.max_height || 400}&key=${this.apiKey}`;
    }
    return `https://places.googleapis.com/v1/places/photos/${params.photo_reference}/media?maxWidthPx=${params.max_width || 400}&maxHeightPx=${params.max_height || 400}&key=${this.apiKey}`;
  }
};

// src/tools/google-places-tools.ts
var envRef = null;
function setEnvironment(env) {
  envRef = env;
}
__name(setEnvironment, "setEnvironment");
function getPlacesClient() {
  if (!envRef) {
    throw new Error("Environment not initialized");
  }
  return new GooglePlacesFetchClient(envRef);
}
__name(getPlacesClient, "getPlacesClient");
var findPlaceTool = {
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
      inputtype: {
        type: "string",
        description: 'The type of input. Can be "textQuery" or "phoneNumber".',
        enum: ["textquery", "phonenumber"],
        default: "textquery"
      },
      fields: {
        type: "array",
        items: { type: "string" },
        description: "Basic fields to return for each candidate.",
        default: ["place_id", "name", "formatted_address", "types", "geometry", "icon_mask_base_uri", "icon_background_color"]
      },
      max_results: {
        type: "integer",
        description: "Maximum number of place candidates to return (default 5, max 10).",
        minimum: 1,
        maximum: 10,
        default: 5
      }
    },
    required: ["query"]
  },
  handler: /* @__PURE__ */ __name(async (args) => {
    try {
      const client = getPlacesClient();
      const result = await client.findPlace({
        query: args.query,
        language: args.language,
        region: args.region,
        inputtype: args.inputtype || "textquery",
        fields: args.fields || ["place_id", "name", "formatted_address", "types", "geometry", "icon_mask_base_uri", "icon_background_color"],
        max_results: args.max_results || 5
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      console.error("Error in find_place tool:", error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: error.message
          }, null, 2)
        }]
      };
    }
  }, "handler")
};
var getPlaceDetailsTool = {
  name: "get_place_details",
  description: "Retrieves detailed information about a specific place using its Place ID.",
  inputSchema: {
    type: "object",
    properties: {
      place_id: {
        type: "string",
        description: "The Place ID of the place."
      },
      fields: {
        type: "array",
        items: { type: "string" },
        description: "Specific fields to request. Defaults to a comprehensive set.",
        default: ["place_id", "name", "formatted_address", "types", "url", "website", "international_phone_number", "formatted_phone_number", "geometry", "opening_hours", "utc_offset_minutes", "photos", "rating", "user_ratings_total", "reviews", "price_level", "business_status"]
      },
      language: {
        type: "string",
        description: "The language code for the results.",
        enum: ["ar", "be", "bg", "bn", "ca", "cs", "da", "de", "el", "en", "en-Au", "en-GB", "es", "eu", "fa", "fi", "fil", "fr", "gl", "gu", "hi", "hr", "hu", "id", "it", "iw", "ja", "kk", "kn", "ko", "ky", "lt", "lv", "mk", "ml", "mr", "my", "nl", "no", "pa", "pl", "pt", "pt-BR", "pt-PT", "ro", "ru", "sk", "sl", "sq", "sr", "sv", "ta", "te", "th", "tl", "tr", "uk", "uz", "vi", "zh-CN", "zh-TW"]
      },
      region: {
        type: "string",
        description: "The region code for biasing results."
      }
    },
    required: ["place_id"]
  },
  handler: /* @__PURE__ */ __name(async (args) => {
    try {
      const client = getPlacesClient();
      const result = await client.getPlaceDetails({
        place_id: args.place_id,
        fields: args.fields || ["place_id", "name", "formatted_address", "types", "url", "website", "international_phone_number", "formatted_phone_number", "geometry", "opening_hours", "utc_offset_minutes", "photos", "rating", "user_ratings_total", "reviews", "price_level", "business_status"],
        language: args.language,
        region: args.region
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      console.error("Error in get_place_details tool:", error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: error.message
          }, null, 2)
        }]
      };
    }
  }, "handler")
};
var getPlacePhotoUrlTool = {
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
  },
  handler: /* @__PURE__ */ __name(async (args) => {
    try {
      const client = getPlacesClient();
      const url = client.getPlacePhotoUrl({
        photo_reference: args.photo_reference,
        max_width: args.max_width,
        max_height: args.max_height
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ url }, null, 2)
        }]
      };
    } catch (error) {
      console.error("Error in get_place_photo_url tool:", error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: error.message
          }, null, 2)
        }]
      };
    }
  }, "handler")
};

// src/tools/index.ts
function initializeTools(env) {
  setEnvironment(env);
  const registry = getToolRegistry();
  registry.tools = [];
  registry.handlers.clear();
  const tools = [
    findPlaceTool,
    getPlaceDetailsTool,
    getPlacePhotoUrlTool
  ];
  tools.forEach((tool) => {
    registry.tools.push({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    });
    registry.handlers.set(tool.name, async (params) => {
      return await tool.handler(params);
    });
  });
  return registry;
}
__name(initializeTools, "initializeTools");

// src/oauth.ts
function getOAuthMetadata(baseUrl) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256", "plain"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"]
  };
}
__name(getOAuthMetadata, "getOAuthMetadata");
async function handleAuthorize(request, env) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const responseType = url.searchParams.get("response_type");
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  if (!clientId || !redirectUri || responseType !== "code") {
    return new Response("Bad Request", { status: 400 });
  }
  if (env.OAUTH_CLIENT_ID && clientId !== env.OAUTH_CLIENT_ID) {
    return new Response("Invalid client_id", { status: 401 });
  }
  if (env.ALLOWED_REDIRECT_URIS) {
    const allowedUris = env.ALLOWED_REDIRECT_URIS.split(",");
    const isAllowed = allowedUris.some((pattern) => {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return regex.test(redirectUri);
    });
    if (!isAllowed) {
      return new Response("Invalid redirect_uri", { status: 401 });
    }
  }
  const code = crypto.randomUUID();
  const codeData = {
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    expiresAt: Date.now() + 6e5
    // 10 minutes
  };
  await env.CACHE.put(`auth_code:${code}`, JSON.stringify(codeData), {
    expirationTtl: 600
  });
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }
  return Response.redirect(redirectUrl.toString(), 302);
}
__name(handleAuthorize, "handleAuthorize");
async function handleToken(request, env) {
  const formData = await request.formData();
  const grantType = formData.get("grant_type");
  const code = formData.get("code");
  const clientId = formData.get("client_id");
  const clientSecret = formData.get("client_secret");
  const redirectUri = formData.get("redirect_uri");
  const codeVerifier = formData.get("code_verifier");
  if (grantType !== "authorization_code" || !code || !clientId) {
    return new Response(JSON.stringify({
      error: "invalid_request"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (env.OAUTH_CLIENT_ID && clientId !== env.OAUTH_CLIENT_ID) {
    return new Response(JSON.stringify({
      error: "invalid_client"
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (env.OAUTH_CLIENT_SECRET && clientSecret !== env.OAUTH_CLIENT_SECRET) {
    return new Response(JSON.stringify({
      error: "invalid_client"
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const codeDataStr = await env.CACHE.get(`auth_code:${code}`);
  if (!codeDataStr) {
    return new Response(JSON.stringify({
      error: "invalid_grant"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const codeData = JSON.parse(codeDataStr);
  if (codeData.clientId !== clientId || codeData.redirectUri !== redirectUri) {
    return new Response(JSON.stringify({
      error: "invalid_grant"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (codeData.codeChallenge) {
    if (!codeVerifier) {
      return new Response(JSON.stringify({
        error: "invalid_request",
        error_description: "code_verifier required"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    let expectedChallenge = codeVerifier;
    if (codeData.codeChallengeMethod === "S256") {
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const hash = await crypto.subtle.digest("SHA-256", data);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      expectedChallenge = base64;
    }
    if (expectedChallenge !== codeData.codeChallenge) {
      return new Response(JSON.stringify({
        error: "invalid_grant",
        error_description: "Code verifier mismatch"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  const accessToken = crypto.randomUUID();
  await env.CACHE.put(`access_token:${accessToken}`, JSON.stringify({
    clientId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 36e5
    // 1 hour
  }), {
    expirationTtl: 3600
  });
  await env.CACHE.delete(`auth_code:${code}`);
  return new Response(JSON.stringify({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleToken, "handleToken");

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
      const url = new URL(request.url);
      if (url.pathname === "/.well-known/oauth-metadata" || url.pathname === "/.well-known/openid-configuration" || url.pathname === "/sse/.well-known/oauth-metadata" || url.pathname === "/sse/.well-known/openid-configuration") {
        const baseUrl = url.origin;
        const metadata = getOAuthMetadata(baseUrl);
        return new Response(JSON.stringify(metadata), {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      } else if (url.pathname === "/authorize" || url.pathname === "/sse/authorize") {
        return handleAuthorize(request, env);
      } else if (url.pathname === "/token" || url.pathname === "/sse/token") {
        return handleToken(request, env);
      }
      const { authorized, userId } = await handleAuth(request, env);
      if (!authorized) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      initializeTools(env);
      if (url.pathname === "/sse" || url.pathname === "/sse/") {
        return handleSseRequest(request, env, ctx);
      }
      if (url.pathname === "/" && request.method === "POST") {
        return handleMcpRequest(request, env, ctx);
      }
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error("Worker error:", error);
      const errorResponse = {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal Server Error"
        },
        id: null
      };
      return new Response(JSON.stringify(errorResponse), {
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

// .wrangler/tmp/bundle-lS6mpk/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-lS6mpk/middleware-loader.entry.ts
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
