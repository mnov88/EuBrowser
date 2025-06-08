const request = require('supertest');
const express = require('express');
const reportsRouter = require('./reports'); // The router itself
const db = require('../db'); // To mock its query method

// Mock the db module
jest.mock('../db', () => ({
  query: jest.fn(),
}));

// Set up a minimal express app to test the router
const app = express();
app.use(express.json()); // Important for POST body parsing
app.use('/reports', reportsRouter);

describe('POST /api/reports/generate', () => {
  beforeEach(() => {
    // Clear all previous mock calls and implementations before each test
    db.query.mockReset();
  });

  it('should return CSV for case_links_only with correct headers and data', async () => {
    const mockReportConfig = {
      targetScope: 'specific_articles',
      selectedArticleIds: ['1'],
      filters: null,
      exportFormat: 'CSV',
      exportContentOption: 'case_links_only',
    };

    // Mock DB responses
    // 1. Initial query to get case_law_ids from case_law_interprets_article
    db.query.mockResolvedValueOnce({
      rows: [{ case_law_id: 101 }, { case_law_id: 102 }],
    });
    // 2. Second query for operative_part_interprets_article (even if not directly used by case_links_only, the code path might call it)
    // For 'case_links_only', this might not be strictly necessary if we optimize the SUT, but follow current SUT logic.
     db.query.mockResolvedValueOnce({
      rows: [], // No case laws via operative parts for this test
    });
    // 3. Query to fetch case_laws details
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 101, celex_number: 'C-101/23', title: 'Case 101', parties: 'A v B', court: 'CJEU', date_of_judgment: '2023-01-01' },
        { id: 102, celex_number: 'C-102/23', title: 'Case 102', parties: 'X v Y', court: 'GC', date_of_judgment: '2023-02-01' },
      ],
    });

    const response = await request(app)
      .post('/reports/generate')
      .send(mockReportConfig);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv');
    expect(response.headers['content-disposition']).toMatch(/^attachment; filename="eu_law_report_\d{4}-\d{2}-\d{2}\.csv"$/);

    // Check CSV content
    const expectedCsvHeader = 'case_celex_number,case_title,parties,court,date_of_judgment';
    const expectedCsvRow1 = 'C-101/23,Case 101,A v B,CJEU,2023-01-01';
    const expectedCsvRow2 = 'C-102/23,Case 102,X v Y,GC,2023-02-01';

    expect(response.text).toContain(expectedCsvHeader);
    expect(response.text).toContain(expectedCsvRow1);
    expect(response.text).toContain(expectedCsvRow2);

    // Verify db.query calls (optional, for more specific behavior verification)
    // Example: Check the query for fetching case_laws details
    expect(db.query).toHaveBeenNthCalledWith(3,
      expect.stringContaining('SELECT * FROM case_laws WHERE id = ANY($1::int[])'),
      [[101, 102]] // Ensure correct IDs were passed
    );
  });

  it('should return CSV for simplified_operative_parts with fallback', async () => {
    const mockReportConfig = {
      targetScope: 'specific_articles',
      selectedArticleIds: ['1'],
      filters: null,
      exportFormat: 'CSV',
      exportContentOption: 'simplified_operative_parts',
    };

    // Mock DB: article to case_law_ids
    db.query.mockResolvedValueOnce({ rows: [{ case_law_id: 201 }] }); // via case_law_interprets_article
    db.query.mockResolvedValueOnce({ rows: [] }); // via operative_part_interprets_article

    // Mock DB: case_law details
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 201, celex_number: 'C-201/23', title: 'Case 201', parties: 'P v Q', court: 'CJEU', date_of_judgment: '2023-03-01' },
      ],
    });
    // Mock DB: operative_parts for case_law_id 201
    db.query.mockResolvedValueOnce({
      rows: [
        { part_number: 1, simplified_text: 'Simplified OP1', verbatim_text: 'Verbatim OP1' },
        { part_number: 2, simplified_text: null, verbatim_text: 'Verbatim OP2 (no simplified)' },
      ],
    });

    const response = await request(app)
      .post('/reports/generate')
      .send(mockReportConfig);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv');

    const expectedCsvHeader = 'case_celex_number,case_title,parties,court,date_of_judgment,operative_part_number,operative_part_text';
    const expectedCsvRow1Data = 'C-201/23,Case 201,P v Q,CJEU,2023-03-01,1,"Simplified OP1"'; // fast-csv quotes fields with commas or quotes
    const expectedCsvRow2Data = 'C-201/23,Case 201,P v Q,CJEU,2023-03-01,2,"Verbatim OP2 (no simplified)"';

    expect(response.text).toContain(expectedCsvHeader);
    expect(response.text).toContain(expectedCsvRow1Data);
    expect(response.text).toContain(expectedCsvRow2Data);

    // Check that the operative parts query was made for case_law_id 201
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT part_number, verbatim_text, simplified_text FROM operative_parts WHERE case_law_id = $1'),
      [201]
    );
  });

  it('should apply court filter correctly', async () => {
    const mockReportConfig = {
      targetScope: 'specific_articles',
      selectedArticleIds: ['1'],
      filters: { court: 'CJEU' }, // Filter by CJEU
      exportFormat: 'CSV',
      exportContentOption: 'case_links_only',
    };

    db.query.mockResolvedValueOnce({ rows: [{ case_law_id: 101 }, { case_law_id: 102 }] }); // article -> case_law_ids
    db.query.mockResolvedValueOnce({ rows: [] }); // article -> op -> case_law_ids

    // Mock case_law details where only one matches the filter
    // The actual filtering happens in the SQL query; the mock for this query result should reflect that.
    db.query.mockResolvedValueOnce({
      rows: [ // This is the result *after* SQL filtering
        { id: 101, celex_number: 'C-101/23', title: 'Case 101', parties: 'A v B', court: 'CJEU', date_of_judgment: '2023-01-01' },
        // Case 102 from GC is implicitly filtered out by the SQL query itself
      ],
    });

    const response = await request(app)
      .post('/reports/generate')
      .send(mockReportConfig);

    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('C-101/23,Case 101,A v B,CJEU,2023-01-01');
    expect(response.text).not.toContain('C-102/23'); // Ensure the GC case is not present

    // Check that the case_laws query included the court filter
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM case_laws WHERE id = ANY($1::int[]) AND court ILIKE $2'),
      [[101, 102], '%CJEU%']
    );
  });

  // Add more tests:
  // - targetScope: 'entire_legislation'
  // - exportContentOption: 'full_operative_parts'
  // - exportContentOption: 'complete_case_text'
  // - Filtering by date range
  // - Edge case: No case laws found after filtering
  // - Edge case: Case law with no operative parts when operative part text is requested
});
