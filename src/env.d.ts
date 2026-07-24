/// <reference types="astro/client" />

type RuntimeEnv = {
  CATALOG_DB?: D1Database;
  TMDB_READ_ACCESS_TOKEN?: string;
  PUBLIC_IMAGE_CDN_URL?: string;
};

declare namespace App {
  interface Locals {
    runtime?: {
      env?: RuntimeEnv;
    };
  }
}
