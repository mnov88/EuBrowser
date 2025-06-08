require('dotenv').config();
const express = require('express');
const legislationsRouter = require('./routes/legislations');
const articlesRouter = require('./routes/articles');
const caseLawsRouter = require('./routes/case_laws');
const operativePartsRouter = require('./routes/operative_parts');
const caseLawInterpretsArticleRouter = require('./routes/case_law_interprets_article');
const operativePartInterpretsArticleRouter = require('./routes/operative_part_interprets_article');
const operativePartMentionsLegislationRouter = require('./routes/operative_part_mentions_legislation');
const searchRouter = require('./routes/search'); // Import search router

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json()); // Middleware to parse JSON bodies

// Mount API routes
app.use('/api/legislations', legislationsRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/case_laws', caseLawsRouter);
app.use('/api/operative_parts', operativePartsRouter);
app.use('/api/case_law_interprets_article', caseLawInterpretsArticleRouter);
app.use('/api/operative_part_interprets_article', operativePartInterpretsArticleRouter);
app.use('/api/operative_part_mentions_legislation', operativePartMentionsLegislationRouter);
app.use('/api/search', searchRouter); // Mount search router

// Basic Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app; // For potential testing
