const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /api/operative_part_mentions_legislation - Create a new relationship
router.post('/', async (req, res, next) => {
  const { operative_part_id, legislation_id } = req.body;

  if (operative_part_id === undefined || legislation_id === undefined) {
    return res.status(400).json({ error: 'Both operative_part_id and legislation_id are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if operative_part_id exists
    const opExists = await client.query('SELECT id FROM operative_parts WHERE id = $1', [operative_part_id]);
    if (opExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Operative part with id ${operative_part_id} not found.` });
    }

    // Check if legislation_id exists
    const legislationExists = await client.query('SELECT id FROM legislations WHERE id = $1', [legislation_id]);
    if (legislationExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Legislation with id ${legislation_id} not found.` });
    }

    const result = await client.query(
      'INSERT INTO operative_part_mentions_legislation (operative_part_id, legislation_id) VALUES ($1, $2) RETURNING *',
      [operative_part_id, legislation_id]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    // Use the actual constraint name from your schema if known, or generic 23505
    if (err.code === '23505' && err.constraint === 'operative_part_mentions_legislation_operative_part_id_leg_key') {
      return res.status(409).json({ error: `Relationship between operative part ID ${operative_part_id} and legislation ID ${legislation_id} already exists.` });
    }
     if (err.code === '23503') { // Foreign key violation
        if (err.constraint === 'operative_part_mentions_legislation_operative_part_id_fkey') {
             return res.status(404).json({ error: `Operative part with id ${operative_part_id} not found.` });
        }
        if (err.constraint === 'operative_part_mentions_legislation_legislation_id_fkey') {
             return res.status(404).json({ error: `Legislation with id ${legislation_id} not found.` });
        }
    }
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/operative_part_mentions_legislation - List relationships with filtering and pagination
router.get('/', async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = (page - 1) * limit;
  const { operative_part_id, legislation_id } = req.query;

  let query = 'SELECT * FROM operative_part_mentions_legislation';
  let countQuery = 'SELECT COUNT(*) FROM operative_part_mentions_legislation';
  const whereClauses = [];
  const queryParams = [];
  const countQueryParams = [];

  if (operative_part_id) {
    queryParams.push(operative_part_id);
    countQueryParams.push(operative_part_id);
    whereClauses.push(`operative_part_id = $${queryParams.length}`);
  }
  if (legislation_id) {
    queryParams.push(legislation_id);
    countQueryParams.push(legislation_id);
    whereClauses.push(`legislation_id = $${queryParams.length}`);
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
        ...(operative_part_id && { operative_part_id_filter: parseInt(operative_part_id, 10) }),
        ...(legislation_id && { legislation_id_filter: parseInt(legislation_id, 10) })
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/operative_part_mentions_legislation - Delete a relationship by composite key
router.delete('/', async (req, res, next) => {
  const { operative_part_id, legislation_id } = req.query;

  if (operative_part_id === undefined || legislation_id === undefined) {
    return res.status(400).json({ error: 'Both operative_part_id and legislation_id query parameters are required.' });
  }

  try {
    const result = await db.query(
      'DELETE FROM operative_part_mentions_legislation WHERE operative_part_id = $1 AND legislation_id = $2 RETURNING *',
      [operative_part_id, legislation_id]
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
