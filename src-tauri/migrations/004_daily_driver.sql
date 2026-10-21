ALTER TABLE projects ADD COLUMN color TEXT NOT NULL DEFAULT '#6d8c80'
  CHECK (length(color) = 7 AND substr(color, 1, 1) = '#' AND substr(color, 2) NOT GLOB '*[^0-9a-fA-F]*');

CREATE TABLE preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  theme TEXT NOT NULL CHECK (theme IN ('system', 'dark', 'light')),
  horizon_days INTEGER NOT NULL CHECK (horizon_days BETWEEN 1 AND 90)
);
INSERT INTO preferences VALUES (1, 'system', 42);
CREATE TRIGGER preferences_revision AFTER UPDATE ON preferences
WHEN OLD.horizon_days != NEW.horizon_days BEGIN
  UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1;
END;
