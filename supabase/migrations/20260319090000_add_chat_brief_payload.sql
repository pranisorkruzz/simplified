CREATE OR REPLACE FUNCTION safe_parse_jsonb(value text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN value::jsonb;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

ALTER TABLE chats
ADD COLUMN IF NOT EXISTS brief_payload jsonb;

UPDATE chats
SET brief_payload = safe_parse_jsonb(message)
WHERE role = 'assistant'
  AND brief_payload IS NULL;

DROP FUNCTION safe_parse_jsonb(text);
