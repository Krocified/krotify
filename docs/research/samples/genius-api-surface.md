# Genius API surface — fetched excerpts

Source: https://docs.genius.com/ (fetched 2026-11-14)
No lyrics were fetched or scraped.

## Authentication

> Genius uses OAuth2 for authentication. All API requests must be authenticated.

> If your application doesn't include user-specific behaviors you can use the
> *client* access token associated with your API instead of tokens for
> authenticated users. These tokens are only valid for read-only endpoints that
> are not restricted by a required scope. You can get a client access token by
> clicking "Generate Access Token" on the API Client management page.

Request header example from the docs:

```
GET /some-endpoint HTTP/1.1
User-Agent: CompuServe Classic/1.22
Accept: application/json
Host: api.genius.com
Authorization: Bearer ACCESS_TOKEN
```

Client registration returns a `client_id` and `client_secret`; the
`redirect_uri` is used for user authorization.

## Documented resources (read endpoints)

- `GET /annotations/:id`
- `GET /referents` (by `song_id` or `web_page_id`)
- `GET /songs/:id`
- `GET /artists/:id`
- `GET /artists/:id/songs`
- `GET /web_pages/lookup`
- `GET /search` with `q`
- `GET /account` (requires `me` scope)

The docs describe a song as a Genius-hosted document, usually lyrics, and say
song data includes the document details and attached referents. No documented
endpoint returns a lyrics body as a playback lyric source, and the v4 plan
forbids scraping the web pages.

## Cost / commercial use

> Commercial use of the Genius API is not allowed without a license. Please
> reach out to api-sales@genius.com to discuss commercial usage.

## Response envelope

> All Genius API responses are JSON. Every JSON response has a `meta` field with
> a `status` value that is an integer representation of the HTTP status code for
> the response.

Errors use the same envelope, e.g. `meta.status` plus `meta.message`.

## Unauthenticated probe

`GET https://api.genius.com/search?q=radiohead%20creep` without a token returned
HTTP 401:

```json
{"meta":{"status":401,"message":"This call requires an access_token. Please see: https://genius.com/developers"}}
```

See `genius-no-token-401.json`.
