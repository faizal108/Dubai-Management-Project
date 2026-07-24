-- Receipt builder: the foundation's active receipt template + its per-template
-- options (accent color, font, editable text blocks, field toggles). The
-- template id maps to a code-defined template registry on the client; settings
-- is an opaque JSON bag. Both editable by ADMIN via /foundations/me.

ALTER TABLE "Foundation" ADD COLUMN "receiptTemplateId" TEXT NOT NULL DEFAULT 'classic';
ALTER TABLE "Foundation" ADD COLUMN "receiptSettings" JSONB;
