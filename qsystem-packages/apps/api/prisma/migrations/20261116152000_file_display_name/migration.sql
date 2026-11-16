ALTER TABLE "files" ADD COLUMN "display_name" TEXT;
UPDATE "files" SET "display_name" = split_part("key", '/', array_length(string_to_array("key", '/'), 1));
