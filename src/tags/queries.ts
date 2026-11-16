export const TAG_ACTIVE_COUNT_SQL = `
SELECT g.id AS id, g.name AS name, COUNT(t.id) AS count
FROM tags g
LEFT JOIN track_tags tt ON tt.tagId = g.id
LEFT JOIN tracks t ON t.id = tt.trackId AND t.status = 'active'
GROUP BY g.id, g.name
ORDER BY g.name COLLATE NOCASE ASC
`;

export const TAG_ASSIGNMENTS_SQL = `
SELECT tt.trackId AS trackId, tt.tagId AS tagId
FROM track_tags tt
JOIN tracks t ON t.id = tt.trackId
WHERE t.status = 'active'
ORDER BY tt.trackId ASC, tt.tagId ASC
`;

export const TAGS_FOR_TRACK_SQL = `
SELECT g.id AS id, g.name AS name
FROM tags g
JOIN track_tags tt ON tt.tagId = g.id
WHERE tt.trackId = ?
ORDER BY g.name COLLATE NOCASE ASC
`;
