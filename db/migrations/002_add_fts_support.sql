-- Migration: Add Full-Text Search Support

-- 1. Add search_tsvector columns
ALTER TABLE legislations ADD COLUMN IF NOT EXISTS search_tsvector tsvector;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS search_tsvector tsvector;
ALTER TABLE case_laws ADD COLUMN IF NOT EXISTS search_tsvector tsvector;
ALTER TABLE operative_parts ADD COLUMN IF NOT EXISTS search_tsvector tsvector;

-- 2. Trigger functions and Triggers for automatic tsvector updates

-- For legislations table
CREATE OR REPLACE FUNCTION legislations_tsvector_update_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_tsvector :=
    to_tsvector('english',
      coalesce(NEW.title,'') || ' ' ||
      coalesce(NEW.full_markdown_content,'') || ' ' ||
      coalesce(NEW.celex_number,'')
    );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvectorupdate_legislations_trigger
BEFORE INSERT OR UPDATE OF title, full_markdown_content, celex_number ON legislations
FOR EACH ROW EXECUTE FUNCTION legislations_tsvector_update_trigger();

-- For articles table
CREATE OR REPLACE FUNCTION articles_tsvector_update_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_tsvector :=
    to_tsvector('english',
      coalesce(NEW.title,'') || ' ' ||
      coalesce(NEW.markdown_content,'') || ' ' ||
      coalesce(NEW.article_number_text,'')
    );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvectorupdate_articles_trigger
BEFORE INSERT OR UPDATE OF title, markdown_content, article_number_text ON articles
FOR EACH ROW EXECUTE FUNCTION articles_tsvector_update_trigger();

-- For case_laws table
CREATE OR REPLACE FUNCTION case_laws_tsvector_update_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_tsvector :=
    to_tsvector('english',
      coalesce(NEW.title,'') || ' ' ||
      coalesce(NEW.case_id_text,'') || ' ' ||
      coalesce(NEW.parties,'') || ' ' ||
      coalesce(NEW.summary_text,'') || ' ' ||
      coalesce(NEW.plaintext_content,'') || ' ' ||
      coalesce(NEW.celex_number,'')
    );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvectorupdate_case_laws_trigger
BEFORE INSERT OR UPDATE OF title, case_id_text, parties, summary_text, plaintext_content, celex_number ON case_laws
FOR EACH ROW EXECUTE FUNCTION case_laws_tsvector_update_trigger();

-- For operative_parts table
CREATE OR REPLACE FUNCTION operative_parts_tsvector_update_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_tsvector :=
    to_tsvector('english',
      coalesce(NEW.verbatim_text,'') || ' ' ||
      coalesce(NEW.simplified_text,'') || ' ' ||
      coalesce(NEW.markdown_content,'')
      -- Note: operative_parts do not have their own celex_number or title to add here.
      -- Their title for search is constructed dynamically in the search API.
    );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvectorupdate_operative_parts_trigger
BEFORE INSERT OR UPDATE OF verbatim_text, simplified_text, markdown_content ON operative_parts
FOR EACH ROW EXECUTE FUNCTION operative_parts_tsvector_update_trigger();


-- 3. Initial population of search_tsvector columns
-- Note: It's good practice to run these AFTER triggers are created,
-- so the trigger logic is applied to existing data as well, though redundant if fields haven't changed.
-- Or, run before triggers if the trigger logic is complex and you want to ensure one-time population is simpler.
-- Given the triggers are `BEFORE INSERT OR UPDATE`, they won't fire for these UPDATE statements
-- unless we re-set one of the monitored columns, which we are not. So this order is fine.

UPDATE legislations
SET search_tsvector = to_tsvector('english',
    coalesce(title,'') || ' ' ||
    coalesce(full_markdown_content,'') || ' ' ||
    coalesce(celex_number,'')
) WHERE search_tsvector IS NULL; -- Only update if not already populated (e.g. by trigger if run after)

UPDATE articles
SET search_tsvector = to_tsvector('english',
    coalesce(title,'') || ' ' ||
    coalesce(markdown_content,'') || ' ' ||
    coalesce(article_number_text,'')
) WHERE search_tsvector IS NULL;

UPDATE case_laws
SET search_tsvector = to_tsvector('english',
    coalesce(title,'') || ' ' ||
    coalesce(case_id_text,'') || ' ' ||
    coalesce(parties,'') || ' ' ||
    coalesce(summary_text,'') || ' ' ||
    coalesce(plaintext_content,'') || ' ' ||
    coalesce(celex_number,'')
) WHERE search_tsvector IS NULL;

UPDATE operative_parts
SET search_tsvector = to_tsvector('english',
    coalesce(verbatim_text,'') || ' ' ||
    coalesce(simplified_text,'') || ' ' ||
    coalesce(markdown_content,'')
) WHERE search_tsvector IS NULL;


-- 4. Create GIN indexes on search_tsvector columns
CREATE INDEX IF NOT EXISTS legislations_search_tsvector_idx ON legislations USING gin(search_tsvector);
CREATE INDEX IF NOT EXISTS articles_search_tsvector_idx ON articles USING gin(search_tsvector);
CREATE INDEX IF NOT EXISTS case_laws_search_tsvector_idx ON case_laws USING gin(search_tsvector);
CREATE INDEX IF NOT EXISTS operative_parts_search_tsvector_idx ON operative_parts USING gin(search_tsvector);

-- End of Migration
