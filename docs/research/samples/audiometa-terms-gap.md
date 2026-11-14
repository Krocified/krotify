# Audiometa.io terms and match evidence — gap record

Captured 2026-11-14.

## Published terms

The public site and API docs were checked for a terms, privacy, legal or
attribution page. None was found:

| Path | Result |
| --- | --- |
| `https://audiometa.io/terms` | 404 |
| `https://audiometa.io/terms-of-service` | 404 |
| `https://audiometa.io/tos` | 404 |
| `https://audiometa.io/legal` | 404 |
| `https://audiometa.io/privacy` | 404 |
| `https://audiometa.io/about` | 404 |
| `https://audiometa.io/faq` | 404 |

The static sitemap (`https://audiometa.io/sitemap/static.xml`) lists only `/`,
`/v1/docs`, `/browse`, `/browse/artists`, `/browse/albums`, `/browse/tracks`,
`/contribute` and `/mission` — no legal page.

`https://audiometa.io/v1/openapi.json` contains no `termsOfService`, licence or
attribution field. The homepage marketing copy says:

> audiometa.io is a new project — we're still seeding the catalog and enriching
> records. Expect gaps, growth, and rapid change. — catalog still seeding.

> Completely free
> No paid tiers to unlock catalog data. Create a free account, generate API
> keys, and query the platform.

> Built for products
> Use Audiometa as the metadata layer for apps, research tools, dashboards, DJ
> tools, and internal products.

Those claims are not a licence. Caching, offline storage, display of artwork,
attribution and commercial use are all unstated. The memo therefore cannot
approve a cache or display policy from the vendor's own words.

The `/mission` page says the project "aggregates track, artist, and album
records" and is "free for developers to query via API"; the footer says
"© 2026 Audiometa. All rights reserved." The `/contribute` page says users can
add and edit lyrics ("Adding lyrics awards +10"), but the v1 OpenAPI Track schema
does not expose a lyrics field. This is another reason to keep LRCLIB as the
only lyrics source and to get written terms before using any Audiometa content.

## Credential and match sample

No Audiometa API key was available in this environment. A real unauthenticated
request was captured:

`GET https://api.audiometa.io/v1/search?q=drake&type=artist`

```json
{"error":{"status":401,"message":"No API key provided. Use Authorization: Bearer <key>."}}
```

See `audiometa-no-key-401.json`.

The 20-track local-library match sample (`audiometa-match-sample.csv`) was not
produced. It needs both:

1. a free Audiometa API key, created at `https://audiometa.io/dashboard/api`
   (raw key shown once; up to 3 keys per account), and
2. access to the user's actual on-device library tags.

Neither is available in this research worktree. Do not invent matches.
