const tmdbImageOrigin = "https://image.tmdb.org/t/p";
const allowedSizes: Record<string, true> = {
  w185: true,
  w342: true,
  w500: true,
  w780: true,
  w1280: true,
  original: true,
};

interface ImageEnv {
  TMDB_IMAGES: R2Bucket;
}

function cachedImageKey(imagePath: string, requestedSize: string): string | null {
  const filename = imagePath.replace(/^\//, "");
  if (requestedSize === "w185") return `tmdb/profile/w185/${filename}`;
  if (requestedSize === "w342" || requestedSize === "w500") return `tmdb/poster/${requestedSize}/${filename}`;
  if (requestedSize === "w780" || requestedSize === "w1280") return `tmdb/backdrop/${requestedSize}/${filename}`;
  return null;
}

export default {
  async fetch(request: Request, env: ImageEnv, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    const url = new URL(request.url);
    const [, requestedSize, ...pathParts] = url.pathname.split("/");
    const imagePath = pathParts.join("/");

    if (!(requestedSize in allowedSizes) || !/^[a-zA-Z0-9/_-]+\.(avif|jpg|jpeg|png|webp)$/.test(imagePath)) {
      return new Response("Invalid image path", { status: 400 });
    }

    const cacheKey = cachedImageKey(imagePath, requestedSize);
    if (cacheKey) {
      const object = await env.TMDB_IMAGES.get(cacheKey);
      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=604800");
        headers.set("ETag", object.httpEtag);
        headers.set("X-Image-Source", "r2");
        return new Response(request.method === "HEAD" ? null : object.body, { headers });
      }
    }

    const requestInit: RequestInit<RequestInitCfProperties> = {
      cf: {
        cacheEverything: true,
        cacheTtl: 2_592_000,
      },
    };
    const upstream = await fetch(`${tmdbImageOrigin}/${requestedSize}/${imagePath}`, {
      ...requestInit,
      method: request.method,
    });
    if (!upstream.ok) return new Response("Image unavailable", { status: upstream.status });

    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=604800");
    headers.set("X-Image-Source", "tmdb");
    headers.delete("Set-Cookie");

    if (request.method === "HEAD" || !cacheKey || !upstream.body) {
      return new Response(request.method === "HEAD" ? null : upstream.body, {
        status: upstream.status,
        headers,
      });
    }

    const [clientBody, cacheBody] = upstream.body.tee();
    ctx.waitUntil(env.TMDB_IMAGES.put(cacheKey, cacheBody, {
      httpMetadata: {
        contentType: upstream.headers.get("Content-Type") ?? undefined,
        cacheControl: "public, max-age=2592000",
      },
      customMetadata: { source: "tmdb", sourcePath: `/${imagePath}`, cachedAt: new Date().toISOString() },
    }));

    return new Response(clientBody, {
      status: upstream.status,
      headers,
    });
  },
};
