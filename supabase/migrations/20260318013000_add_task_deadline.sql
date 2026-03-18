ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS deadline_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_deadline_at ON tasks(deadline_at);
