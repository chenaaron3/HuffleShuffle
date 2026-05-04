ALTER TABLE "huffle-shuffle_user"
    ADD COLUMN "displayName" varchar(255) NOT NULL DEFAULT 'Player';

UPDATE "huffle-shuffle_user" u
SET "displayName" = s."displayName"
FROM "huffle-shuffle_seat" s
WHERE u.id = s."playerId";

UPDATE "huffle-shuffle_user" u
SET "displayName" = COALESCE(NULLIF(TRIM(u.name), ''), 'Player')
WHERE NOT EXISTS (
    SELECT 1
    FROM "huffle-shuffle_seat" s
    WHERE s."playerId" = u.id
);

ALTER TABLE "huffle-shuffle_seat"
    DROP COLUMN "displayName";
