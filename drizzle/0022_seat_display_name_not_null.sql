UPDATE "huffle-shuffle_seat" AS s
SET "displayName" = COALESCE(NULLIF(TRIM(s."displayName"), ''), NULLIF(TRIM(u.name), ''), 'Player')
FROM "huffle-shuffle_user" AS u
WHERE s."playerId" = u.id
  AND (s."displayName" IS NULL OR TRIM(s."displayName") = '');

ALTER TABLE "huffle-shuffle_seat"
    ALTER COLUMN "displayName" SET NOT NULL;
