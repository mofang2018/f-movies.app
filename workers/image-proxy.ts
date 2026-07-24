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

function cachedImageKeys(imagePath: string, requestedSize: string): string[] {
  const filename = imagePath.replace(/^\//, "");
  // Site markup consistently uses w500/w342 for posters, w1280 for
  // backdrops and w185 for profiles. Pick the corresponding bucket directly
  // instead of performing up to three R2 reads on a CDN miss.
  const primaryKey = requestedSize === "w1280"
    ? `tmdb/backdrop/w1280/${filename}`
    : requestedSize === "w185"
      ? `tmdb/profile/w185/${filename}`
      : `tmdb/poster/w500/${filename}`;
  return [
    primaryKey,
    ...(requestedSize === "original" ? [
      `tmdb/poster/original/${filename}`,
      `tmdb/backdrop/original/${filename}`,
      `tmdb/profile/original/${filename}`,
    ] : []),
  ];
}

export default {
  async fetch(request: Request, env: ImageEnv): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    const url = new URL(request.url);
    const [, requestedSize, ...pathParts] = url.pathname.split("/");
    const imagePath = pathParts.join("/");

    if (!(requestedSize in allowedSizes) || !/^[a-zA-Z0-9/_-]+\.(avif|jpg|jpeg|png|webp)$/.test(imagePath)) {
      return new Response("Invalid image path", { status: 400 });
    }

    for (const key of cachedImageKeys(imagePath, requestedSize)) {
      const object = await env.TMDB_IMAGES.get(key);
      if (!object) continue;
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=604800");
      headers.set("ETag", object.httpEtag);
      headers.set("X-Image-Source", "r2");
      return new Response(request.method === "HEAD" ? null : object.body, { headers });
    }

    const requestInit: RequestInit<RequestInitCfProperties> = {
      cf: {
        cacheEverything: true,
        cacheTtl: 2_592_000,
      },
    };
    const upstream = await fetch(`${tmdbImageOrigin}/${requestedSize}/${imagePath}`, requestInit);
    if (!upstream.ok) return new Response("Image unavailable", { status: upstream.status });

    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=604800");
    headers.set("X-Image-Source", "tmdb");
    headers.delete("Set-Cookie");

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};
