CREATE INDEX IF NOT EXISTS idx_chats_user_created_at_desc
ON chats(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chats_user_role_created_at_desc
ON chats(user_id, role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_user_created_order
ON tasks(user_id, created_at DESC, order_index ASC);

CREATE INDEX IF NOT EXISTS idx_tasks_user_completed_created
ON tasks(user_id, completed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_user_chat_id
ON tasks(user_id, chat_id)
WHERE chat_id IS NOT NULL;
