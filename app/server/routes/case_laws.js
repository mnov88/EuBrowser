const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /case_laws - Create a new case law
router.post('/', async (req, res, next) => {
  const {
    celex_number, title, case_id_text, court, date_of_judgment,
    parties, summary_text, operative_parts_combined,
    operative_parts_individual, html_content, plaintext_content
  } = req.body;

  if (!celex_number || !title) {
    return res.status(400).json({ error: 'CELEX number and title are required' });
  }

  // Basic validation for date_of_judgment
  if (date_of_judgment && isNaN(new Date(date_of_judgment))) {
    return res.status(400).json({ error: 'Invalid date format for date_of_judgment. Please use YYYY-MM-DD or a valid ISO date string.' });
  }
  const formattedDate = date_of_judgment ? new Date(date_of_judgment).toISOString().split('T')[0] : null;


  try {
    const result = await db.query(
      `INSERT INTO case_laws (celex_number, title, case_id_text, court, date_of_judgment,
        parties, summary_text, operative_parts_combined, operative_parts_individual,
        html_content, plaintext_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        celex_number, title, case_id_text, court, formattedDate, parties, summary_text,
        operative_parts_combined, operative_parts_individual, html_content, plaintext_content
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'case_laws_celex_number_key') {
      return res.status(409).json({ error: `Case law with CELEX number ${celex_number} already exists.` });
    }
    next(err);
  }
});

// GET /case_laws - Get all case laws with pagination and sorting
router.get('/', async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = (page - 1) * limit;
  const sort = req.query.sort || 'date_desc'; // Default: date_desc

  let orderByClause = 'ORDER BY created_at DESC'; // Default sort
  if (sort === 'date_desc') {
    orderByClause = 'ORDER BY date_of_judgment DESC NULLS LAST, created_at DESC';
  } else if (sort === 'date_asc') {
    orderByClause = 'ORDER BY date_of_judgment ASC NULLS LAST, created_at ASC';
  }

  try {
    const result = await db.query(
      `SELECT * FROM case_laws ${orderByClause} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const totalCountResult = await db.query('SELECT COUNT(*) FROM case_laws');
    const totalCount = parseInt(totalCountResult.rows[0].count, 10);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        sort,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /case_laws/:id - Get a single case law by ID
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM case_laws WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Case law not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /case_laws/:id - Update a case law
router.put('/:id', async (req, res, next) => {
  const { id } = req.params;
  const {
    title, case_id_text, court, date_of_judgment, parties,
    summary_text, operative_parts_combined, operative_parts_individual,
    html_content, plaintext_content
  } = req.body; // celex_number is not updatable

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'No fields to update provided.' });
  }

  if (date_of_judgment && isNaN(new Date(date_of_judgment))) {
    return res.status(400).json({ error: 'Invalid date format for date_of_judgment. Please use YYYY-MM-DD or a valid ISO date string.' });
  }
  const formattedDate = date_of_judgment ? new Date(date_of_judgment).toISOString().split('T')[0] : undefined;


  const updateFields = [];
  const values = [];
  let queryIndex = 1;

  const updatableFields = {
      title, case_id_text, court, date_of_judgment: formattedDate, parties, summary_text,
      operative_parts_combined, operative_parts_individual, html_content, plaintext_content
  };

  for (const [key, value] of Object.entries(updatableFields)) {
    if (value !== undefined) {
      updateFields.push(`${key} = $${queryIndex++}`);
      values.push(value);
    }
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update provided or fields are empty.' });
  }

  values.push(id); // For the WHERE clause
  const queryString = `UPDATE case_laws SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${queryIndex} RETURNING *`;

  try {
    const result = await db.query(queryString, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Case law not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /case_laws/:id - Delete a case law
router.delete('/:id', async (req, res, next) => {
  const { id } = req.params;
  const client = await db.pool.connect(); // Use a client for transaction

  try {
    await client.query('BEGIN');

    // 1. Check for referencing entries in case_law_interprets_article
    const referencingInterpretations = await client.query(
      'SELECT id FROM case_law_interprets_article WHERE case_law_id = $1 LIMIT 1', [id]
    );
    if (referencingInterpretations.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Cannot delete case law: It is referenced by one or more article interpretations. Please remove those references first.'
      });
    }

    // 2. Delete associated operative_parts (cascade delete)
    // First, get IDs of operative_parts to also remove their dependencies if any (e.g. operative_part_interprets_article)
    const opPartsToDelete = await client.query('SELECT id FROM operative_parts WHERE case_law_id = $1', [id]);
    for (const opPart of opPartsToDelete.rows) {
        await client.query('DELETE FROM operative_part_interprets_article WHERE operative_part_id = $1', [opPart.id]);
        await client.query('DELETE FROM operative_part_mentions_legislation WHERE operative_part_id = $1', [opPart.id]);
    }
    await client.query('DELETE FROM operative_parts WHERE case_law_id = $1', [id]);

    // 3. Delete the case law itself
    const result = await client.query('DELETE FROM case_laws WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Case law not found' });
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Case law and associated operative parts deleted successfully', deletedCaseLaw: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
