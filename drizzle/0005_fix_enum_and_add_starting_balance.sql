-- First, ensure all enum values exist
DO $$ 
BEGIN
    -- Add INITIAL if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'INITIAL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'game_state')) THEN
        ALTER TYPE game_state ADD VALUE 'INITIAL';
    END IF;
    
    -- Add GAME_START if it doesn't exist  
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'GAME_START' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'game_state')) THEN
        ALTER TYPE game_state ADD VALUE 'GAME_START';
    END IF;
END $$;

-- Convert the state column to use the enum with proper casting
ALTER TABLE "huffle-shuffle_game" ALTER COLUMN "state" SET DATA TYPE game_state USING 
  CASE 
    WHEN state = 'INITIAL' THEN 'INITIAL'::game_state
    WHEN state = 'GAME_START' THEN 'GAME_START'::game_state
    WHEN state = 'DEAL_HOLE_CARDS' THEN 'DEAL_HOLE_CARDS'::game_state
    WHEN state = 'BETTING' THEN 'BETTING'::game_state
    WHEN state = 'DEAL_FLOP' THEN 'DEAL_FLOP'::game_state
    WHEN state = 'DEAL_TURN' THEN 'DEAL_TURN'::game_state
    WHEN state = 'DEAL_RIVER' THEN 'DEAL_RIVER'::game_state
    WHEN state = 'SHOWDOWN' THEN 'SHOWDOWN'::game_state
    WHEN state = 'RESET_TABLE' THEN 'RESET_TABLE'::game_state
    ELSE 'DEAL_HOLE_CARDS'::game_state
  END;