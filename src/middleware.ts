import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url;
  if (url.hostname === "f-movies.app" || url.hostname === "www.f-movies.app") {
    return new Response("Gone", {
      status: 410,
      headers: {
        "Cache-Control": "public, max-age=86400",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  if (url.hostname === "www.watchfmovies.org") {
    url.hostname = "watchfmovies.org";
    url.protocol = "https:";
    return Response.redirect(url, 301);
  }

  if (url.hostname === "watchfmovies.org" && url.protocol === "http:") {
    url.protocol = "https:";
    return Response.redirect(url, 301);
  }

  const response = await next();
  if (url.hostname === "watchfmovies.org" && url.protocol === "https:") {
    const headers = new Headers(response.headers);
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return response;
});
