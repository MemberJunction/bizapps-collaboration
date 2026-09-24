-- The Collaboration Share notification type lives in metadata/user-notification-types.
-- Push it with mj sync push. This version stays in the chain so databases that
-- already applied the old insert keep their history. A new database gets the row
-- from the metadata push, not from this file.
GO
