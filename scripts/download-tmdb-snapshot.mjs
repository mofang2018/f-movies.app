import { writeFile } from "node:fs/promises";
import { load } from "cheerio";

const siteBase = "https://www.themoviedb.org";
const outputPath = new URL("../src/data/tmdb-snapshot.json", import.meta.url);
const requestHeaders = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "watchfmovies.org catalog snapshot/1.0",
};

const genreNames = new Map([
  [12, "Adventure"],
  [14, "Fantasy"],
  [16, "Animation"],
  [18, "Drama"],
  [27, "Horror"],
  [28, "Action"],
  [35, "Comedy"],
  [36, "History"],
  [37, "Western"],
  [53, "Thriller"],
  [80, "Crime"],
  [99, "Documentary"],
  [878, "Science Fiction"],
  [9648, "Mystery"],
  [10402, "Music"],
  [10749, "Romance"],
  [10751, "Family"],
  [10752, "War"],
  [10759, "Action & Adventure"],
  [10762, "Kids"],
  [10763, "News"],
  [10764, "Reality"],
  [10765, "Sci-Fi & Fantasy"],
  [10766, "Soap"],
  [10767, "Talk"],
  [10768, "War & Politics"],
]);

async function fetchHtml(path, extraHeaders = {}) {
  const url = new URL(path, siteBase);
  if (!url.searchParams.has("language")) url.searchParams.set("language", "en-US");
  const response = await fetch(url, {
    headers: { ...requestHeaders, ...extraHeaders },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function extractImagePath(value) {
  if (!value) return null;
  const match = value.match(/\/([a-zA-Z0-9_-]+\.(?:avif|jpe?g|png|webp))(?:\s|\?|$)/);
  return match ? `/${match[1]}` : null;
}

function normalizeDate(value) {
  const clean = value.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function parseRuntime(value) {
  const hours = Number(value.match(/(\d+)h/)?.[1] ?? 0);
  const minutes = Number(value.match(/(\d+)m/)?.[1] ?? 0);
  const total = (hours * 60) + minutes;
  return total || null;
}

function parseList(html, expectedType) {
  const $ = load(html);
  const items = [];
  const seen = new Set();

  $('[class*="comp:poster-"]').each((_, card) => {
    const link = $(card).find("a[data-media-type]").filter((__, element) => $(element).find("img").length > 0).first();
    const href = link.attr("href")?.split("?")[0] ?? "";
    const match = href.match(/^\/(movie|tv)\/(\d+)/);
    if (!match) return;
    const mediaType = match[1];
    const id = Number(match[2]);
    if ((expectedType && mediaType !== expectedType) || seen.has(`${mediaType}:${id}`)) return;

    const image = link.find("img").first();
    const title = image.attr("alt")?.trim() || $(card).find("h2").first().text().trim() || "Untitled";
    const releaseText = $(card).find(".release_date, .subheader").first().text();
    seen.add(`${mediaType}:${id}`);
    items.push({
      id,
      mediaType,
      title,
      overview: "",
      posterPath: extractImagePath(image.attr("src") ?? image.attr("srcset")),
      backdropPath: null,
      releaseDate: normalizeDate(releaseText),
      voteAverage: 0,
      genreIds: [],
      href,
    });
  });

  return items.slice(0, 20);
}

function parseFact($, label) {
  let value = "";
  $("section.facts p").each((_, element) => {
    const strong = $(element).find("strong").first().text().trim();
    if (strong.replace(/:$/, "") !== label) return;
    value = $(element).clone().find("strong").remove().end().text().replace(/\s+/g, " ").trim();
  });
  return value;
}

async function fetchDetails(item) {
  const html = await fetchHtml(item.href);
  const $ = load(html);
  const images = $('meta[property="og:image"]').map((_, element) => $(element).attr("content")).get();
  const genreLinks = $(".header_poster_wrapper .facts .genres a");
  const genres = genreLinks.map((_, element) => {
    const id = Number($(element).attr("href")?.match(/^\/genre\/(\d+)/)?.[1]);
    const name = $(element).text().trim() || genreNames.get(id) || "Genre";
    return { id, name };
  }).get().filter((genre) => Number.isInteger(genre.id));
  const cast = $("#cast_scroller li.card").slice(0, 10).map((_, element) => {
    const personLink = $(element).find('a[href^="/person/"]').first();
    const profile = $(element).find("img.profile").first();
    return {
      id: Number(personLink.attr("href")?.match(/^\/person\/(\d+)/)?.[1] ?? 0),
      name: $(element).find("p a").first().text().trim() || profile.attr("alt")?.trim() || "Cast",
      character: $(element).find("p.character").text().replace(/\s+/g, " ").trim(),
      profilePath: extractImagePath(profile.attr("src")),
    };
  }).get().filter((person) => person.id > 0);
  const title = $(".header_poster_wrapper h2 a").first().text().trim()
    || $('meta[property="og:title"]').attr("content")?.trim()
    || item.title;
  const overview = $(".header_info .overview p").first().text().replace(/\s+/g, " ").trim()
    || $('meta[property="og:description"]').attr("content")?.trim()
    || "";
  const score = Number($(".user_score_chart").first().attr("data-percent") ?? 0) / 10;
  const releaseDate = normalizeDate($(".header_poster_wrapper .facts .release").first().text()) || item.releaseDate;
  const runtime = parseRuntime($(".header_poster_wrapper .facts .runtime").first().text());
  const seasonValue = parseFact($, "Number of Seasons");

  return {
    id: item.id,
    mediaType: item.mediaType,
    title,
    overview,
    posterPath: extractImagePath(images[0]) || item.posterPath,
    backdropPath: extractImagePath(images[1]),
    releaseDate,
    voteAverage: Number.isFinite(score) ? score : 0,
    genreIds: genres.map((genre) => genre.id),
    tagline: $(".header_info .tagline").first().text().replace(/\s+/g, " ").trim(),
    runtime,
    seasons: seasonValue ? Number(seasonValue.match(/\d+/)?.[0] ?? 0) || null : null,
    status: parseFact($, "Status") || (releaseDate && releaseDate <= new Date().toISOString().slice(0, 10) ? "Released" : "Planned"),
    genres,
    cast,
    similar: [],
  };
}

async function mapInBatches(items, batchSize, mapper) {
  const output = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const results = await Promise.all(batch.map(async (item) => {
      try {
        const result = await mapper(item);
        process.stdout.write(".");
        return result;
      } catch (error) {
        process.stdout.write("x");
        console.error(`\nFailed ${item.mediaType}/${item.id}: ${error.message}`);
        return { ...item, tagline: "", runtime: null, seasons: null, status: "", genres: [], cast: [], similar: [] };
      }
    }));
    output.push(...results);
  }
  process.stdout.write("\n");
  return output;
}

function mediaItem(details) {
  const { tagline, runtime, seasons, status, genres, cast, similar, ...item } = details;
  return item;
}

function attachSimilar(details, catalog) {
  return details.map((detail) => ({
    ...detail,
    similar: catalog
      .filter((candidate) => candidate.mediaType === detail.mediaType && candidate.id !== detail.id)
      .map((candidate) => ({
        candidate,
        overlap: candidate.genreIds.filter((id) => detail.genreIds.includes(id)).length,
      }))
      .sort((a, b) => b.overlap - a.overlap || b.candidate.voteAverage - a.candidate.voteAverage)
      .slice(0, 12)
      .map(({ candidate }) => candidate),
  }));
}

console.log("Downloading TMDB website lists...");
const [trendingHtml, moviesHtml, tvHtml] = await Promise.all([
  fetchHtml("/remote/panel?panel=trending_scroller&group=this-week", { "X-Requested-With": "XMLHttpRequest" }),
  fetchHtml("/movie"),
  fetchHtml("/tv"),
]);

const trendingSeeds = parseList(trendingHtml);
const movieSeeds = parseList(moviesHtml, "movie");
const tvSeeds = parseList(tvHtml, "tv");
const uniqueSeeds = [...new Map([...trendingSeeds, ...movieSeeds, ...tvSeeds].map((item) => [`${item.mediaType}:${item.id}`, item])).values()];

console.log(`Downloading ${uniqueSeeds.length} TMDB detail pages...`);
const detailsWithoutSimilar = await mapInBatches(uniqueSeeds, 6, fetchDetails);
const catalog = detailsWithoutSimilar.map(mediaItem);
const details = attachSimilar(detailsWithoutSimilar, catalog);
const byKey = new Map(details.map((item) => [`${item.mediaType}:${item.id}`, item]));
const resolveSeeds = (seeds) => seeds.map((seed) => mediaItem(byKey.get(`${seed.mediaType}:${seed.id}`) ?? seed));
const discoveredGenres = [...new Map(details.flatMap((item) => item.genres).map((genre) => [genre.id, genre])).values()]
  .sort((a, b) => a.name.localeCompare(b.name));

const snapshot = {
  generatedAt: new Date().toISOString(),
  source: "TMDB website (official same-origin pages)",
  trending: resolveSeeds(trendingSeeds),
  movies: resolveSeeds(movieSeeds),
  tv: resolveSeeds(tvSeeds),
  genres: discoveredGenres,
  details,
};

await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Saved ${snapshot.trending.length} trending, ${snapshot.movies.length} movies, ${snapshot.tv.length} TV series and ${snapshot.details.length} details.`);
