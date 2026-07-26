export default {
  fetch(): Response {
    return new Response("Gone", {
      status: 410,
      headers: {
        "Cache-Control": "public, max-age=86400",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  },
};
