# Genius Terms of Service — fetched excerpts

Source: https://genius.com/static/terms (fetched 2026-11-14)
Page header: "Last Updated: January 13, 2026"
No lyrics were fetched or scraped.

These excerpts are recorded for the v4 memo. Read the full terms before any
implementation; the quotes below are not legal advice.

## Commercial use

> **Commercial Use:** Unless otherwise expressly authorized by Genius' in
> writing in accordance with the terms set forth in this paragraph, you agree
> not to use, display, distribute, license, perform, publish, reproduce,
> duplicate, copy, create derivative works from, modify, sell, resell, exploit
> (including, without limitation, for A.I. machine learning purposes), transfer
> or transmit for any commercial purposes/machine learning purposes, any portion
> of the Service (including Genius Content), use of the Service, or access to
> the Service. The Service is for your personal use and may not be used for
> direct commercial endeavors without the express written consent of Genius.

## Derivative works and scraping

> Except as expressly authorized by Genius in writing, you agree not to modify,
> copy, frame, scrape, rent, lease, loan, sell, distribute or create derivative
> works based on the Service or the Genius Content, in whole or in part,
> including for any purposes related to AI machine learning/use on AI platforms,
> except that the foregoing does not apply to your own User Content (as defined
> above) that you legally upload to the Service. In connection with your use of
> the Service you shall not engage in or use any data mining, robots, scraping
> or similar data gathering or extraction methods, including for any purposes
> related to AI machine learning/use on AI platforms. Any use of the Service or
> the Genius Content other than as specifically authorized herein is strictly
> prohibited.

## Genius Content ownership

> Except for your User Content, the Service and all materials therein or
> transferred thereby, including, without limitation, software, images, text,
> graphics, illustrations, logos, patents, trademarks, service marks,
> copyrights, photographs, audio, videos, music, and User Content belonging to
> other Users (the "Genius Content"), and all Intellectual Property Rights
> related thereto, are the exclusive property of Genius and its licensors
> (including other Users who post User Content to the Service).

## Why this matters for Krotify

- A local cache of Genius annotations, artwork or metadata is a copy/derivative
  use of Genius Content. The terms do not grant a caching or offline-display
  licence.
- The API docs separately forbid commercial use without a licence. A free,
  personal, open-source app is closer to "personal use", but that argument is
  not confirmed by Genius in writing and should be treated as unresolved until
  counsel or Genius confirms.
- Annotations are commentary about lyrics. Displaying them may still reproduce
  or derive from the underlying lyric document, which Krotify does not licence.
- No scraping fallback is permitted. LRCLIB remains the lyrics source.
