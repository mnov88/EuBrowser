const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /operative_parts - Create a new operative part
router.post('/', async (req, res, next) => {
  const { case_law_id, part_number, verbatim_text, simplified_text, markdown_content } = req.body;

  if (case_law_id === undefined || part_number === undefined) {
    return res.status(400).json({ error: 'Case law ID and part number are required' });
  }
  if (typeof part_number !== 'number' || part_number <= 0) {
    return res.status(400).json({ error: 'Part number must be a positive integer' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if case_law_id exists
    const caseLawExists = await client.query('SELECT id FROM case_laws WHERE id = $1', [case_law_id]);
    if (caseLawExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Case law with id ${case_law_id} not found.` });
    }

    // Check uniqueness of (case_law_id, part_number) is handled by DB constraint,
    // but we can provide a clearer error message if caught.

    const result = await client.query(
      `INSERT INTO operative_parts (case_law_id, part_number, verbatim_text, simplified_text, markdown_content)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [case_law_id, part_number, verbatim_text, simplified_text, markdown_content]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23503' && err.constraint === 'operative_parts_case_law_id_fkey') {
        // This check is somewhat redundant due to the explicit check above, but good for safety.
        return res.status(400).json({ error: `Case law with id ${case_law_id} not found.` });
    }
    if (err.code === '23505' && err.constraint === 'operative_parts_case_law_id_part_number_key') {
      return res.status(409).json({ error: `Operative part with number ${part_number} already exists for case law ID ${case_law_id}.` });
    }
    next(err);
  } finally {
    client.release();
  }
});

// GET /operative_parts - Get all operative parts with pagination and optional filtering
router.get('/', async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = (page - 1) * limit;
  const { case_law_id } = req.query;

  let query = 'SELECT * FROM operative_parts';
  let countQuery = 'SELECT COUNT(*) FROM operative_parts';
  const queryParams = [];
  const countQueryParams = [];

  let orderByClause = 'ORDER BY created_at DESC';

  if (case_law_id) {
    query += ' WHERE case_law_id = $1';
    countQuery += ' WHERE case_law_id = $1';
    queryParams.push(case_law_id);
    countQueryParams.push(case_law_id);
    orderByClause = `ORDER BY part_number ASC`; // Sort by part_number when filtering by case_law_id
  }

  query += ` ${orderByClause} LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
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
        ...(case_law_id && { case_law_id_filter: parseInt(case_law_id, 10) })
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /operative_parts/:id - Get a single operative part by ID
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM operative_parts WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Operative part not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /operative_parts/:id - Update an operative part
router.put('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { part_number, verbatim_text, simplified_text, markdown_content } = req.body;
  // case_law_id is not updatable directly.

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'No fields to update provided.' });
  }
  if (part_number !== undefined && (typeof part_number !== 'number' || part_number <= 0)) {
    return res.status(400).json({ error: 'Part number must be a positive integer if provided' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // If part_number is being updated, we need to ensure uniqueness with its existing case_law_id
    if (part_number !== undefined) {
      const currentOpPart = await client.query('SELECT case_law_id FROM operative_parts WHERE id = $1', [id]);
      if (currentOpPart.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Operative part not found' });
      }
      // The unique constraint operative_parts_case_law_id_part_number_key will handle the check.
      // We just need to catch the specific error.
    }

    const updateFields = [];
    const values = [];
    let queryIndex = 1;

    const updatableFields = { part_number, verbatim_text, simplified_text, markdown_content };

    for (const [key, value] of Object.entries(updatableFields)) {
      if (value !== undefined) {
        updateFields.push(`${key} = $${queryIndex++}`);
        values.push(value);
      }
    }

    if (updateFields.length === 0) {
      await client.query('ROLLBACK'); // Though this state might be hard to reach given initial check
      return res.status(400).json({ error: 'No valid fields to update actually provided.' });
    }

    values.push(id); // For the WHERE clause
    const queryString = `UPDATE operative_parts SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${queryIndex} RETURNING *`;

    const result = await client.query(queryString, values);

    if (result.rows.length === 0) {
      // This should ideally be caught by the check for currentOpPart if part_number was updated,
      // or means the ID itself was not found if only other fields were updated.
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Operative part not found during update.' });
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505' && err.constraint === 'operative_parts_case_law_id_part_number_key') {
      // This means the new part_number conflicts with an existing one for the same case_law_id
      return res.status(409).json({ error: `An operative part with the specified part number already exists for this case law.` });
    }
    next(err);
  } finally {
    client.release();
  }
});

// DELETE /operative_parts/:id - Delete an operative part
router.delete('/:id', async (req, res, next) => {
  const { id } = req.params;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Remove related entries from operative_part_interprets_article
    await client.query('DELETE FROM operative_part_interprets_article WHERE operative_part_id = $1', [id]);

    // 2. Remove related entries from operative_part_mentions_legislation
    await client.query('DELETE FROM operative_part_mentions_legislation WHERE operative_part_id = $1', [id]);

    // 3. Delete the operative part itself
    const result = await client.query('DELETE FROM operative_parts WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Operative part not found' });
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Operative part and associated references deleted successfully', deletedOperativePart: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
