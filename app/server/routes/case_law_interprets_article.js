const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /api/case_law_interprets_article - Create a new relationship
router.post('/', async (req, res, next) => {
  const { case_law_id, article_id } = req.body;

  if (case_law_id === undefined || article_id === undefined) {
    return res.status(400).json({ error: 'Both case_law_id and article_id are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if case_law_id exists
    const caseLawExists = await client.query('SELECT id FROM case_laws WHERE id = $1', [case_law_id]);
    if (caseLawExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Case law with id ${case_law_id} not found.` });
    }

    // Check if article_id exists
    const articleExists = await client.query('SELECT id FROM articles WHERE id = $1', [article_id]);
    if (articleExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Article with id ${article_id} not found.` });
    }

    // Unique constraint (case_law_id, article_id) is handled by DB.
    // We'll catch the error if it occurs.
    const result = await client.query(
      'INSERT INTO case_law_interprets_article (case_law_id, article_id) VALUES ($1, $2) RETURNING *',
      [case_law_id, article_id]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505' && err.constraint === 'case_law_interprets_article_case_law_id_article_id_key') {
      return res.status(409).json({ error: `Relationship between case law ID ${case_law_id} and article ID ${article_id} already exists.` });
    }
    // Foreign key constraints might also fire if IDs are invalid, though checked above.
    if (err.code === '23503') { // Foreign key violation
        if (err.constraint === 'case_law_interprets_article_case_law_id_fkey') {
             return res.status(404).json({ error: `Case law with id ${case_law_id} not found.` });
        }
        if (err.constraint === 'case_law_interprets_article_article_id_fkey') {
             return res.status(404).json({ error: `Article with id ${article_id} not found.` });
        }
    }
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/case_law_interprets_article - List relationships with filtering and pagination
router.get('/', async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = (page - 1) * limit;
  const { case_law_id, article_id } = req.query;

  let query = 'SELECT * FROM case_law_interprets_article';
  let countQuery = 'SELECT COUNT(*) FROM case_law_interprets_article';
  const whereClauses = [];
  const queryParams = [];
  const countQueryParams = [];

  if (case_law_id) {
    queryParams.push(case_law_id);
    countQueryParams.push(case_law_id);
    whereClauses.push(`case_law_id = $${queryParams.length}`);
  }
  if (article_id) {
    queryParams.push(article_id);
    countQueryParams.push(article_id);
    whereClauses.push(`article_id = $${queryParams.length}`);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
    countQuery += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
  queryParams.push(limit, offset);

  try {
    const result = await db.query(query, queryParams);
    const totalCountResult = await db.query(countQuery, countQueryParams);
    const totalCount = parseInt(totalCountResult.rows[0].count, 10);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        ...(case_law_id && { case_law_id_filter: parseInt(case_law_id, 10) }),
        ...(article_id && { article_id_filter: parseInt(article_id, 10) })
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/case_law_interprets_article - Delete a relationship by composite key
router.delete('/', async (req, res, next) => {
  const { case_law_id, article_id } = req.query; // Using query parameters for DELETE

  if (case_law_id === undefined || article_id === undefined) {
    return res.status(400).json({ error: 'Both case_law_id and article_id query parameters are required.' });
  }

  try {
    const result = await db.query(
      'DELETE FROM case_law_interprets_article WHERE case_law_id = $1 AND article_id = $2 RETURNING *',
      [case_law_id, article_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Relationship not found or already deleted.' });
    }
    res.status(200).json({ message: 'Relationship deleted successfully', deletedRelationship: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
