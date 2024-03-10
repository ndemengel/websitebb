export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
            "Access-Control-Max-Age": "86400",
        };

        const GITHUB_URL = "https://github.com/login/oauth/access_token";

        const PROXY_ENDPOINT = "/github-access-token";

        async function handleRequest(request) {
            const initialUrl = new URL(request.url);

            // Rewrite request to point to API URL. This also makes the request mutable
            // so we can add the correct Origin header to make the API server think
            // that this request is not cross-site.
            const newUrl = new URL(GITHUB_URL);
            for (let entry of initialUrl.searchParams.entries()) {
                newUrl.searchParams.set(entry[0], entry[1]);
            }
            newUrl.searchParams.set('client_secret', env.GITHUB_APP_CLIENT_SECRET);

            console.log('new URL', newUrl.toString());
            const newRequest = new Request(newUrl.toString(), request);
            newRequest.headers.set("Origin", new URL(GITHUB_URL).origin);
            const response = await fetch(newRequest);
            console.log('response status', response.status);

            // Recreate the response so we can modify the headers
            const newResponse = new Response(response.body, response);
            newResponse.headers.set("Access-Control-Allow-Origin", '*');

            // Append to/Add Vary header so browser will cache response correctly
            newResponse.headers.append("Vary", "Origin");

            return newResponse;
        }

        async function handleOptions(request) {
            if (
                request.headers.get("Origin") !== null &&
                request.headers.get("Access-Control-Request-Method") !== null &&
                request.headers.get("Access-Control-Request-Headers") !== null
            ) {
                // Handle CORS preflight requests.
                return new Response(null, {
                    headers: {
                        ...corsHeaders,
                        "Access-Control-Allow-Headers": request.headers.get(
                            "Access-Control-Request-Headers"
                        ),
                    },
                });
            } else {
                // Handle standard OPTIONS request.
                return new Response(null, {
                    headers: {
                        Allow: "GET, HEAD, POST, OPTIONS",
                    },
                });
            }
        }

        const url = new URL(request.url);
        if (url.pathname.startsWith(PROXY_ENDPOINT)) {
            if (request.method === "OPTIONS") {
                // Handle CORS preflight requests
                return handleOptions(request);
            } else if (
                request.method === "GET" ||
                request.method === "HEAD" ||
                request.method === "POST"
            ) {
                return handleRequest(request);
            } else {
                return new Response(null, {
                    status: 405,
                    statusText: "Method Not Allowed",
                });
            }
        } else {
            return new Response(null, {status: 404});
        }
    },
};