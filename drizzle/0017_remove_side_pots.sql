-- Remove sidePots column from games table
-- Side pots are now recalculated from scratch at showdown using cumulative bets
-- (startingBalance - buyIn), so we don't need to store them in the database

ALTER TABLE "huffle-shuffle_game" DROP COLUMN "sidePots";

