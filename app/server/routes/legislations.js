const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /legislations - Create a new legislation
router.post('/', async (req, res, next) => {
  const { celex_number, title, full_markdown_content } = req.body;
  if (!celex_number || !title) {
    return res.status(400).json({ error: 'CELEX number and title are required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO legislations (celex_number, title, full_markdown_content) VALUES ($1, $2, $3) RETURNING *',
      [celex_number, title, full_markdown_content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /legislations - Get all legislations with pagination
router.get('/', async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = (page - 1) * limit;

  try {
    const result = await db.query(
      'SELECT * FROM legislations ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    // Also get total count for pagination metadata
    const totalCountResult = await db.query('SELECT COUNT(*) FROM legislations');
    const totalCount = parseInt(totalCountResult.rows[0].count, 10);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /legislations/:id - Get a single legislation by ID
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { include_full_text } = req.query;

  let queryText = 'SELECT id, celex_number, title, created_at, updated_at, search_tsvector'; // search_tsvector is not typically sent to client
  // Let's select specific metadata fields and conditionally full_markdown_content
  queryText = 'SELECT id, celex_number, title, created_at, updated_at';


  if (include_full_text === 'true') {
    queryText += ', full_markdown_content';
  }
  queryText += ' FROM legislations WHERE id = $1';

  try {
    const result = await db.query(queryText, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Legislation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /legislations/:id - Update a legislation
router.put('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { title, full_markdown_content } = req.body; // celex_number is not updatable

  if (!title && !full_markdown_content) {
    return res.status(400).json({ error: 'No fields to update provided' });
  }

  // Build the query dynamically based on provided fields
  const updateFields = [];
  const values = [];
  let queryIndex = 1;

  if (title !== undefined) {
    updateFields.push(`title = $${queryIndex++}`);
    values.push(title);
  }
  if (full_markdown_content !== undefined) {
    updateFields.push(`full_markdown_content = $${queryIndex++}`);
    values.push(full_markdown_content);
  }

  // Add id to values for the WHERE clause
  values.push(id);

  if (updateFields.length === 0) {
      return res.status(400).json({ error: "No valid fields to update provided." });
  }

  const queryString = `UPDATE legislations SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${queryIndex} RETURNING *`;

  try {
    const result = await db.query(queryString, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Legislation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /legislations/:id - Delete a legislation
router.delete('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM legislations WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Legislation not found' });
    }
    res.status(200).json({ message: 'Legislation deleted successfully', deletedLegislation: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
