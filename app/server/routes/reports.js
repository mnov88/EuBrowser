const express = require('express');
const db = require('../db');
const csv = require('fast-csv');

const router = express.Router();

router.post('/generate', async (req, res, next) => {
  const {
    targetScope, // 'entire_legislation', 'specific_articles'
    selectedLegislationId,
    selectedArticleIds, // array
    filters, // { dateStart, dateEnd, court }
    exportFormat, // Only 'CSV' for now
    exportContentOption, // 'simplified_operative_parts', 'full_operative_parts', 'case_links_only', 'complete_case_text'
  } = req.body;

  if (exportFormat !== 'CSV') {
    return res.status(400).json({ error: 'Invalid exportFormat. Only CSV is supported in this version.' });
  }

  try {
    let relevantCaseLawIds = new Set();

    // 1. Determine relevant case_law_ids based on targetScope
    if (targetScope === 'entire_legislation' && selectedLegislationId) {
      // Find all articles for the legislation
      const articlesInLegislation = await db.query(
        'SELECT id FROM articles WHERE legislation_id = $1',
        [selectedLegislationId]
      );
      const articleIdsInLegislation = articlesInLegislation.rows.map(a => a.id);

      if (articleIdsInLegislation.length > 0) {
        // Find case laws interpreting these articles (direct interpretation)
        const clInterpretsArticle = await db.query(
          `SELECT DISTINCT case_law_id FROM case_law_interprets_article WHERE article_id = ANY($1::int[])`,
          [articleIdsInLegislation]
        );
        clInterpretsArticle.rows.forEach(r => relevantCaseLawIds.add(r.case_law_id));

        // Find case laws via operative parts interpreting these articles
        const opInterpretsArticle = await db.query(
          `SELECT DISTINCT op.case_law_id
           FROM operative_part_interprets_article opia
           JOIN operative_parts op ON opia.operative_part_id = op.id
           WHERE opia.article_id = ANY($1::int[])`,
          [articleIdsInLegislation]
        );
        opInterpretsArticle.rows.forEach(r => relevantCaseLawIds.add(r.case_law_id));
      }
    } else if (targetScope === 'specific_articles' && selectedArticleIds && selectedArticleIds.length > 0) {
      const articleIds = selectedArticleIds.map(id => parseInt(id,10)).filter(id => !isNaN(id));
      if (articleIds.length > 0) {
         // Find case laws interpreting these articles (direct interpretation)
        const clInterpretsArticle = await db.query(
          `SELECT DISTINCT case_law_id FROM case_law_interprets_article WHERE article_id = ANY($1::int[])`,
          [articleIds]
        );
        clInterpretsArticle.rows.forEach(r => relevantCaseLawIds.add(r.case_law_id));

        // Find case laws via operative parts interpreting these articles
        const opInterpretsArticle = await db.query(
          `SELECT DISTINCT op.case_law_id
           FROM operative_part_interprets_article opia
           JOIN operative_parts op ON opia.operative_part_id = op.id
           WHERE opia.article_id = ANY($1::int[])`,
          [articleIds]
        );
        opInterpretsArticle.rows.forEach(r => relevantCaseLawIds.add(r.case_law_id));
      }
    } else {
      // If no specific scope that yields case laws (e.g. "all case laws" - not a current option)
      // or invalid scope, this will result in an empty report or an error.
      // For now, let's assume if no case laws are found by scope, the report is empty.
    }

    if (relevantCaseLawIds.size === 0) {
      // If no case laws identified by scope, send an empty CSV or a message
      // For now, let's allow proceeding to filters, which might also apply if no initial scope applied.
      // However, the current logic implies scope always narrows down case laws first.
      // If targetScope is not one of the above, or IDs are missing, this will be empty.
      // Consider if a report on *all* case laws (just subject to filters) is a valid use case.
      // Based on UI, it seems selection of legislation/articles is primary.
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
        return csv.write([], { headers: true }).pipe(res);
    }

    // 2. Build dynamic query for case_laws table with filters
    let caseLawQuery = `SELECT * FROM case_laws WHERE id = ANY($1::int[])`;
    const queryParams = [Array.from(relevantCaseLawIds)];
    let paramIndex = 2;

    if (filters) {
      if (filters.dateStart) {
        caseLawQuery += ` AND date_of_judgment >= $${paramIndex++}`;
        queryParams.push(filters.dateStart);
      }
      if (filters.dateEnd) {
        caseLawQuery += ` AND date_of_judgment <= $${paramIndex++}`;
        queryParams.push(filters.dateEnd);
      }
      if (filters.court) {
        caseLawQuery += ` AND court ILIKE $${paramIndex++}`;
        queryParams.push(`%${filters.court}%`);
      }
    }
    caseLawQuery += ` ORDER BY date_of_judgment DESC`; // Default sort

    const filteredCaseLawsResult = await db.query(caseLawQuery, queryParams);
    const filteredCaseLaws = filteredCaseLawsResult.rows;

    if (filteredCaseLaws.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
      return csv.write([], { headers: true }).pipe(res);
    }

    // 3. Prepare data for CSV based on exportContentOption
    const csvData = [];
    const headers = ['case_celex_number', 'case_title', 'parties', 'court', 'date_of_judgment'];

    if (exportContentOption === 'simplified_operative_parts' || exportContentOption === 'full_operative_parts') {
      headers.push('operative_part_number', 'operative_part_text');
      for (const cl of filteredCaseLaws) {
        const opsResult = await db.query(
          `SELECT part_number, verbatim_text, simplified_text FROM operative_parts WHERE case_law_id = $1 ORDER BY part_number ASC`,
          [cl.id]
        );
        if (opsResult.rows.length > 0) {
          opsResult.rows.forEach(op => {
            let opText = '';
            if (exportContentOption === 'simplified_operative_parts') {
              opText = op.simplified_text || op.verbatim_text; // Fallback to verbatim
            } else { // full_operative_parts
              opText = op.verbatim_text;
            }
            csvData.push({
              case_celex_number: cl.celex_number,
              case_title: cl.title,
              parties: cl.parties,
              court: cl.court,
              date_of_judgment: cl.date_of_judgment ? new Date(cl.date_of_judgment).toISOString().split('T')[0] : '',
              operative_part_number: op.part_number,
              operative_part_text: opText,
            });
          });
        } else { // Case law has no operative parts, still include the case law once
          csvData.push({
            case_celex_number: cl.celex_number,
            case_title: cl.title,
            parties: cl.parties,
            court: cl.court,
            date_of_judgment: cl.date_of_judgment ? new Date(cl.date_of_judgment).toISOString().split('T')[0] : '',
            operative_part_number: '',
            operative_part_text: '',
          });
        }
      }
    } else if (exportContentOption === 'complete_case_text') {
      headers.push('complete_case_text');
      filteredCaseLaws.forEach(cl => {
        csvData.push({
          case_celex_number: cl.celex_number,
          case_title: cl.title,
          parties: cl.parties,
          court: cl.court,
          date_of_judgment: cl.date_of_judgment ? new Date(cl.date_of_judgment).toISOString().split('T')[0] : '',
          complete_case_text: cl.plaintext_content,
        });
      });
    } else if (exportContentOption === 'case_links_only') {
      // Headers are already fine, just case law metadata
      filteredCaseLaws.forEach(cl => {
        csvData.push({
          case_celex_number: cl.celex_number,
          case_title: cl.title,
          parties: cl.parties,
          court: cl.court,
          date_of_judgment: cl.date_of_judgment ? new Date(cl.date_of_judgment).toISOString().split('T')[0] : '',
        });
      });
    } else {
        return res.status(400).json({ error: 'Invalid exportContentOption.' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="eu_law_report_${new Date().toISOString().split('T')[0]}.csv"`);
    // Explicitly pass the headers array to ensure column order
    csv.write(csvData, { headers: headers }).pipe(res);

  } catch (err) {
    console.error("Error generating report:", err);
    next(err); // Pass to global error handler
  }
});

module.exports = router;
