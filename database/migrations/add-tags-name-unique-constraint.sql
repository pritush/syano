-- Migration: Add unique constraint to tags.name
-- This ensures tag names cannot be duplicated
-- Safe for both new installations and existing databases

-- Check if constraint already exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tags_name_unique'
    ) THEN
        RAISE NOTICE 'Unique constraint already exists on tags.name';
    ELSE
        -- First, check for and remove any duplicate tag names
        -- Keep the oldest tag for each duplicate name
        DECLARE
            duplicate_count INTEGER;
        BEGIN
            -- Count duplicates
            SELECT COUNT(*) INTO duplicate_count
            FROM (
                SELECT name, COUNT(*) as count
                FROM tags
                GROUP BY name
                HAVING COUNT(*) > 1
            ) AS duplicates;
            
            IF duplicate_count > 0 THEN
                RAISE NOTICE 'Found % duplicate tag names, cleaning up...', duplicate_count;
                
                -- Delete duplicates, keeping the oldest one
                DELETE FROM tags
                WHERE id IN (
                    SELECT id
                    FROM (
                        SELECT 
                            id,
                            name,
                            ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) as rn
                        FROM tags
                    ) t
                    WHERE rn > 1
                );
                
                RAISE NOTICE 'Duplicates removed';
            ELSE
                RAISE NOTICE 'No duplicate tag names found';
            END IF;
        END;

        -- Add unique constraint
        ALTER TABLE tags
        ADD CONSTRAINT tags_name_unique UNIQUE (name);
        
        RAISE NOTICE 'Unique constraint successfully added to tags.name';
    END IF;
END $$;
