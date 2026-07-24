const tmdbImageOrigin = "https://image.tmdb.org/t/p/original";
const widths: Record<string, number | undefined> = {
  w185: 185,
  w342: 342,
  w500: 500,
  w780: 780,
  w1280: 1280,
  original: undefined,
};

interface ImageEnv {
  TMDB_IMAGES: R2Bucket;
}

function cachedImageKeys(imagePath: string): string[] {
  const filename = imagePath.replace(/^\//, "");
  return [
    `tmdb/poster/original/${filename}`,
    `tmdb/backdrop/original/${filename}`,
    `tmdb/profile/original/${filename}`,
  ];
}

export default {
  async fetch(request: Request, env: ImageEnv): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    const url = new URL(request.url);
    const [, requestedSize, ...pathParts] = url.pathname.split("/");
    const width = widths[requestedSize];
    const imagePath = pathParts.join("/");

    if (!(requestedSize in widths) || !/^[a-zA-Z0-9/_-]+\.(avif|jpg|jpeg|png|webp)$/.test(imagePath)) {
      return new Response("Invalid image path", { status: 400 });
    }

    for (const key of cachedImageKeys(imagePath)) {
      const object = await env.TMDB_IMAGES.get(key);
      if (!object) continue;
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=604800");
      headers.set("ETag", object.httpEtag);
      headers.set("X-Image-Source", "r2");
      return new Response(request.method === "HEAD" ? null : object.body, { headers });
    }

    const accept = request.headers.get("Accept") ?? "image/webp,image/*";
    const format = accept.includes("image/avif") ? "avif" : accept.includes("image/webp") ? "webp" : "jpeg";
    const requestInit: RequestInit<RequestInitCfProperties> = {
      headers: {
        Accept: accept,
      },
      cf: {
        cacheEverything: true,
        cacheTtl: 2_592_000,
        image: {
          fit: "scale-down",
          format,
          quality: 82,
          ...(width ? { width } : {}),
        },
      },
    };
    const upstream = await fetch(`${tmdbImageOrigin}/${imagePath}`, requestInit);
    if (!upstream.ok) return new Response("Image unavailable", { status: upstream.status });

    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=604800");
    headers.set("Vary", "Accept");
    headers.set("X-Image-Source", "tmdb");
    headers.delete("Set-Cookie");

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};
