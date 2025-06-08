const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/search - Global search endpoint
router.get('/', async (req, res, next) => {
  const { query_string } = req.query;
  const limit = parseInt(req.query.limit, 10) || 50;
  const page = parseInt(req.query.page, 10) || 1;
  const offset = (page - 1) * limit;

  if (!query_string) {
    return res.status(400).json({ error: 'query_string parameter is required.' });
  }

  // Use 'english' as the default text search configuration
  const tsConfig = 'english';

  // websearch_to_tsquery is generally good for user-facing search
  // It handles operators like "OR", "AND", "-", quotes for phrases.
  const sqlQuery = `
    WITH search_results AS (
      -- Legislations
      SELECT
        'legislation' AS content_type,
        l.id,
        l.celex_number,
        NULL AS article_number_text,
        NULL AS case_law_id,
        NULL AS part_number,
        l.title,
        ts_headline(${tsConfig}, coalesce(l.title, '') || ' ' || coalesce(l.full_markdown_content, ''), websearch_to_tsquery(${tsConfig}, $1), 'ShortWord=0, MinWords=20, MaxWords=35, MaxFragments=1, FragmentDelimiter=" ... "') AS text_snippet,
        NULL AS simplified_text,
        FALSE AS is_simplified_available,
        ts_rank_cd(l.search_tsvector, websearch_to_tsquery(${tsConfig}, $1)) AS rank,
        l.created_at
      FROM legislations l
      WHERE l.search_tsvector @@ websearch_to_tsquery(${tsConfig}, $1)

      UNION ALL

      -- Articles
      SELECT
        'article' AS content_type,
        a.id,
        leg.celex_number, -- Join to get parent CELEX
        a.article_number_text,
        NULL AS case_law_id,
        NULL AS part_number,
        COALESCE(a.title, a.article_number_text) AS title,
        ts_headline(${tsConfig}, coalesce(a.title, '') || ' ' || coalesce(a.markdown_content, '') || ' ' || coalesce(a.article_number_text, ''), websearch_to_tsquery(${tsConfig}, $1), 'ShortWord=0, MinWords=20, MaxWords=35, MaxFragments=1, FragmentDelimiter=" ... "') AS text_snippet,
        NULL AS simplified_text,
        FALSE AS is_simplified_available,
        ts_rank_cd(a.search_tsvector, websearch_to_tsquery(${tsConfig}, $1)) AS rank,
        a.created_at
      FROM articles a
      JOIN legislations leg ON a.legislation_id = leg.id
      WHERE a.search_tsvector @@ websearch_to_tsquery(${tsConfig}, $1)

      UNION ALL

      -- Case Laws
      SELECT
        'case_law' AS content_type,
        cl.id,
        cl.celex_number,
        NULL AS article_number_text,
        NULL AS case_law_id,
        NULL AS part_number,
        cl.title,
        ts_headline(${tsConfig}, coalesce(cl.title, '') || ' ' || coalesce(cl.plaintext_content, '') || ' ' || coalesce(cl.summary_text, '') || ' ' || coalesce(cl.case_id_text, ''), websearch_to_tsquery(${tsConfig}, $1), 'ShortWord=0, MinWords=20, MaxWords=35, MaxFragments=1, FragmentDelimiter=" ... "') AS text_snippet,
        NULL AS simplified_text,
        FALSE AS is_simplified_available,
        ts_rank_cd(cl.search_tsvector, websearch_to_tsquery(${tsConfig}, $1)) AS rank,
        cl.created_at
      FROM case_laws cl
      WHERE cl.search_tsvector @@ websearch_to_tsquery(${tsConfig}, $1)

      UNION ALL

      -- Operative Parts
      SELECT
        'operative_part' AS content_type,
        op.id,
        cl_op.celex_number AS parent_celex_number, -- Join to get parent CELEX
        NULL AS article_number_text,
        op.case_law_id,
        op.part_number,
        CONCAT('Case ', cl_op.celex_number, ' - Part ', op.part_number) AS title,
        ts_headline(${tsConfig}, coalesce(op.verbatim_text, '') || ' ' || coalesce(op.simplified_text, '') || ' ' || coalesce(op.markdown_content, ''), websearch_to_tsquery(${tsConfig}, $1), 'ShortWord=0, MinWords=20, MaxWords=35, MaxFragments=1, FragmentDelimiter=" ... "') AS text_snippet,
        op.simplified_text,
        (op.simplified_text IS NOT NULL AND op.simplified_text != '') AS is_simplified_available,
        ts_rank_cd(op.search_tsvector, websearch_to_tsquery(${tsConfig}, $1)) AS rank,
        op.created_at
      FROM operative_parts op
      JOIN case_laws cl_op ON op.case_law_id = cl_op.id
      WHERE op.search_tsvector @@ websearch_to_tsquery(${tsConfig}, $1)
    ),
    ranked_results AS (
        SELECT *, ROW_NUMBER() OVER (ORDER BY rank DESC, created_at DESC) as rn
        FROM search_results
    )
    SELECT *
    FROM ranked_results
    WHERE rn > $2 AND rn <= ($2 + $3);
  `;
  // Query for total count for pagination (can be optimized)
  const totalCountSqlQuery = `
    SELECT COUNT(*)
    FROM (
      SELECT l.id FROM legislations l WHERE l.search_tsvector @@ websearch_to_tsquery(${tsConfig}, $1)
      UNION ALL
      SELECT a.id FROM articles a WHERE a.search_tsvector @@ websearch_to_tsquery(${tsConfig}, $1)
      UNION ALL
      SELECT cl.id FROM case_laws cl WHERE cl.search_tsvector @@ websearch_to_tsquery(${tsConfig}, $1)
      UNION ALL
      SELECT op.id FROM operative_parts op WHERE op.search_tsvector @@ websearch_to_tsquery(${tsConfig}, $1)
    ) AS total_results;
  `;


  try {
    const results = await db.query(sqlQuery, [query_string, offset, limit]);
    const totalCountResult = await db.query(totalCountSqlQuery, [query_string]);
    const totalCount = parseInt(totalCountResult.rows[0].count, 10);

    // Adjusting celex_number and title for articles and operative_parts in the application layer for clarity
    // This is because the parent celex_number was aliased as 'celex_number' for articles and 'parent_celex_number' for op_parts
    // in the SQL query to avoid naming conflicts before UNION.
    const finalResults = results.rows.map(row => {
        if (row.content_type === 'article' && row.celex_number) {
            // For articles, celex_number is already correctly named from the join
        }
        if (row.content_type === 'operative_part' && row.parent_celex_number) {
            row.celex_number = row.parent_celex_number; // Standardize to celex_number
            delete row.parent_celex_number;
        }
        // Add legislation_id for articles for the example output
        if (row.content_type === 'article') {
            // Need to join articles with legislations to get legislation_id if it's not already part of the select
            // For now, this is not directly in the SQL to keep it simpler, can be added.
            // row.legislation_id = ... (would require another join or subquery if not already there)
            // The current query for articles joins legislations for celex_number, so legislation_id can be fetched similarly.
        }
        return row;
    });


    res.json({
      data: finalResults,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        query_string,
      },
    });
  } catch (err) {
    if (err.message.includes("syntax error in tsquery")) {
        return res.status(400).json({ error: "Invalid search query syntax. Please check your search terms."});
    }
    console.error("Search error:", err);
    next(err);
  }
});

module.exports = router;

/*
GIN Index Commands to be added to 001_initial_schema.sql (or a new migration file):

-- 1. Add tsvector columns (if they don't exist - assuming they will be populated by triggers or app logic)

-- The GIN Index commands are now in db/migrations/002_add_fts_support.sql.
-- The search query now uses the consolidated 'search_tsvector' column for each table.
-- The ts_headline function also now refers to the combined text fields that make up the search_tsvector
-- to ensure snippets are generated from the same content that was searched.
*/
