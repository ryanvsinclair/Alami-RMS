ALTER TABLE "receipt_line_items"
ADD COLUMN "parse_confidence_score" DECIMAL(4, 3),
ADD COLUMN "parse_confidence_band" "MatchConfidence",
ADD COLUMN "parse_flags" JSONB,
ADD COLUMN "parse_corrections" JSONB;
