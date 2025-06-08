const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /articles - Create a new article
router.post('/', async (req, res, next) => {
  const { legislation_id, article_number_text, title, filename, markdown_content } = req.body;

  if (!legislation_id || !article_number_text) {
    return res.status(400).json({ error: 'Legislation ID and article number text are required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO articles (legislation_id, article_number_text, title, filename, markdown_content) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [legislation_id, article_number_text, title, filename, markdown_content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    // Check for foreign key violation (e.g., legislation_id does not exist)
    if (err.code === '23503' && err.constraint === 'articles_legislation_id_fkey') {
        return res.status(400).json({ error: `Legislation with id ${legislation_id} not found.` });
    }
    next(err);
  }
});

// GET /articles - Get all articles with pagination and optional filtering by legislation_id
router.get('/', async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = (page - 1) * limit;
  const { legislation_id } = req.query;

  let query = 'SELECT * FROM articles';
  let countQuery = 'SELECT COUNT(*) FROM articles';
  const queryParams = [];
  const countQueryParams = [];

  if (legislation_id) {
    query += ' WHERE legislation_id = $1';
    countQuery += ' WHERE legislation_id = $1';
    queryParams.push(legislation_id);
    countQueryParams.push(legislation_id);
    query += ` ORDER BY article_number_text ASC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);
  } else {
    query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);
  }


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
        ...(legislation_id && { legislation_id_filter: parseInt(legislation_id, 10) })
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /articles/:id - Get a single article by ID
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM articles WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /articles/:id - Update an article
router.put('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { article_number_text, title, filename, markdown_content } = req.body;

  // legislation_id is not updatable through this endpoint.

  const updateFields = [];
  const values = [];
  let queryIndex = 1;

  if (article_number_text !== undefined) {
    updateFields.push(`article_number_text = $${queryIndex++}`);
    values.push(article_number_text);
  }
  if (title !== undefined) {
    updateFields.push(`title = $${queryIndex++}`);
    values.push(title);
  }
  if (filename !== undefined) {
    updateFields.push(`filename = $${queryIndex++}`);
    values.push(filename);
  }
  if (markdown_content !== undefined) {
    updateFields.push(`markdown_content = $${queryIndex++}`);
    values.push(markdown_content);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update provided' });
  }

  values.push(id); // For the WHERE clause
  const queryString = `UPDATE articles SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${queryIndex} RETURNING *`;

  try {
    const result = await db.query(queryString, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /articles/:id - Delete an article
router.delete('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    // Check if article is referenced by case_law_interprets_article or operative_part_interprets_article
    const referencingCaseLaws = await db.query('SELECT id FROM case_law_interprets_article WHERE article_id = $1 LIMIT 1', [id]);
    if (referencingCaseLaws.rows.length > 0) {
        return res.status(400).json({ error: 'Cannot delete article: It is referenced by one or more case laws.' });
    }
    const referencingOpParts = await db.query('SELECT id FROM operative_part_interprets_article WHERE article_id = $1 LIMIT 1', [id]);
     if (referencingOpParts.rows.length > 0) {
        return res.status(400).json({ error: 'Cannot delete article: It is referenced by one or more operative parts.' });
    }

    const result = await db.query('DELETE FROM articles WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.status(200).json({ message: 'Article deleted successfully', deletedArticle: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
