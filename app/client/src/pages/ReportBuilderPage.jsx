import React, { useState, useEffect, useCallback } from 'react';
import { getAllLegislations, getArticlesByLegislationId } from '../services/api';

const ReportBuilderPage = () => {
  // State for selections
  const [targetScope, setTargetScope] = useState('entire_legislation'); // 'entire_legislation' or 'specific_articles'
  const [selectedLegislationId, setSelectedLegislationId] = useState('');
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);

  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterCourt, setFilterCourt] = useState('');
  const [filterCaseOutcome, setFilterCaseOutcome] = useState(''); // Placeholder

  const [exportFormat, setExportFormat] = useState('HTML');
  const [exportContentOption, setExportContentOption] = useState('simplified_operative_parts');

  // State for populating selectors
  const [legislationsList, setLegislationsList] = useState([]);
  const [articlesList, setArticlesList] = useState([]);
  const [isLoadingLegislations, setIsLoadingLegislations] = useState(false);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);

  // Fetch all legislations for the dropdown
  useEffect(() => {
    const fetchLegislations = async () => {
      setIsLoadingLegislations(true);
      try {
        const data = await getAllLegislations();
        setLegislationsList(data || []);
      } catch (error) {
        console.error("Failed to fetch legislations list", error);
        setLegislationsList([]);
      } finally {
        setIsLoadingLegislations(false);
      }
    };
    fetchLegislations();
  }, []);

  // Fetch articles when selectedLegislationId changes (for 'specific_articles' scope)
  const fetchArticlesForLegislation = useCallback(async (legislationId) => {
    if (!legislationId || targetScope !== 'specific_articles') {
      setArticlesList([]);
      setSelectedArticleIds([]); // Clear selected articles if legislation changes or scope changes
      return;
    }
    setIsLoadingArticles(true);
    try {
      // Fetch all articles for the legislation - might need many pages or a special API endpoint.
      // For now, try fetching with a large limit.
      const response = await getArticlesByLegislationId(legislationId, 1, 1000); // Assuming max 1000 articles
      setArticlesList(response.data || []);
    } catch (error) {
      console.error(`Failed to fetch articles for legislation ${legislationId}`, error);
      setArticlesList([]);
    } finally {
      setIsLoadingArticles(false);
    }
  }, [targetScope]);

  useEffect(() => {
    if (selectedLegislationId) {
      fetchArticlesForLegislation(selectedLegislationId);
    } else {
      setArticlesList([]); // Clear articles if no legislation is selected
      setSelectedArticleIds([]);
    }
  }, [selectedLegislationId, fetchArticlesForLegislation]);


  const handleGenerateReport = () => {
    const reportConfig = {
      targetScope,
      selectedLegislationId: targetScope === 'entire_legislation' || targetScope === 'specific_articles' ? selectedLegislationId : null,
      selectedArticleIds: targetScope === 'specific_articles' ? selectedArticleIds : null,
      filterDateStart,
      filterDateEnd,
      filterCourt,
      filterCaseOutcome,
      exportFormat,
      exportContentOption,
    };
    console.log("Generating Report with Config:", reportConfig);
    alert("Report configuration logged to console. See console for details.");
    // In a real app, this would likely send reportConfig to a backend API endpoint.
  };

  const handleArticleSelection = (articleId) => {
    setSelectedArticleIds(prev =>
      prev.includes(articleId)
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    );
  };

  const commonSelectStyle = { padding: '8px', margin: '5px 0', width: '300px', boxSizing: 'border-box'};
  const commonInputStyle = { padding: '8px', margin: '5px 0', width: '296px', boxSizing: 'border-box' }; // Adjust width for border
  const sectionStyle = { border: '1px solid #ccc', padding: '15px', marginBottom: '20px', borderRadius: '5px' };
  const labelStyle = { display: 'block', margin: '10px 0 5px 0', fontWeight: 'bold' };

  return (
    <div style={{textAlign: 'left', maxWidth: '700px', margin: 'auto'}}>
      <h2>Report Builder</h2>

      {/* Target Scope Selection */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Target Scope:</label>
        <label style={{marginRight: '15px'}}>
          <input
            type="radio"
            name="targetScope"
            value="entire_legislation"
            checked={targetScope === 'entire_legislation'}
            onChange={(e) => { setTargetScope(e.target.value); setSelectedLegislationId(''); setSelectedArticleIds([]); setArticlesList([]);}}
          /> Entire Legislation
        </label>
        <label>
          <input
            type="radio"
            name="targetScope"
            value="specific_articles"
            checked={targetScope === 'specific_articles'}
            onChange={(e) => { setTargetScope(e.target.value); setSelectedLegislationId(''); setSelectedArticleIds([]); setArticlesList([]);}}
          /> Specific Articles
        </label>

        {(targetScope === 'entire_legislation' || targetScope === 'specific_articles') && (
          <div>
            <label htmlFor="legislationSelect" style={labelStyle}>Select Legislation:</label>
            <select
              id="legislationSelect"
              value={selectedLegislationId}
              onChange={(e) => setSelectedLegislationId(e.target.value)}
              disabled={isLoadingLegislations}
              style={commonSelectStyle}
            >
              <option value="">{isLoadingLegislations ? "Loading..." : "Select Legislation"}</option>
              {legislationsList.map(leg => (
                <option key={leg.id} value={leg.id}>{leg.title} ({leg.celex_number})</option>
              ))}
            </select>
          </div>
        )}

        {targetScope === 'specific_articles' && selectedLegislationId && (
          <div>
            <label style={labelStyle}>Select Articles:</label>
            {isLoadingArticles && <p>Loading articles...</p>}
            {!isLoadingArticles && articlesList.length === 0 && <p>No articles found for this legislation or legislation not selected.</p>}
            {!isLoadingArticles && articlesList.length > 0 && (
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', padding: '10px' }}>
                {articlesList.map(article => (
                  <label key={article.id} style={{ display: 'block' }}>
                    <input
                      type="checkbox"
                      value={article.id}
                      checked={selectedArticleIds.includes(article.id.toString())} // Ensure comparison is consistent if IDs are numbers/strings
                      onChange={() => handleArticleSelection(article.id.toString())}
                    /> {article.article_number_text}: {article.title || '(No title)'}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters Section */}
      <div style={sectionStyle}>
        <h3 style={{marginTop: 0}}>Filters</h3>
        <div>
          <label htmlFor="filterDateStart" style={labelStyle}>Date Range (Case Law Judgment):</label>
          <input type="date" id="filterDateStart" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} style={commonInputStyle} />
          <span style={{margin: '0 10px'}}>to</span>
          <input type="date" id="filterDateEnd" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} style={commonInputStyle} />
        </div>
        <div>
          <label htmlFor="filterCourt" style={labelStyle}>Court:</label>
          <input type="text" id="filterCourt" value={filterCourt} onChange={e => setFilterCourt(e.target.value)} placeholder="e.g., Court of Justice" style={commonInputStyle} />
        </div>
        <div>
          <label htmlFor="filterCaseOutcome" style={labelStyle}>Case Outcome (Placeholder):</label>
          <select id="filterCaseOutcome" value={filterCaseOutcome} onChange={e => setFilterCaseOutcome(e.target.value)} style={commonSelectStyle}>
            <option value="">Any</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Export Options Section */}
      <div style={sectionStyle}>
        <h3 style={{marginTop: 0}}>Export Options</h3>
        <div>
          <label htmlFor="exportFormat" style={labelStyle}>Export Format:</label>
          <select id="exportFormat" value={exportFormat} onChange={e => setExportFormat(e.target.value)} style={commonSelectStyle}>
            <option value="HTML">HTML</option>
            <option value="CSV">CSV</option>
            <option value="Word">Word (DOCX)</option>
            <option value="PDF">PDF</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Content Options:</label>
          <label style={{display: 'block', marginBottom: '5px'}}><input type="radio" name="exportContentOption" value="simplified_operative_parts" checked={exportContentOption === 'simplified_operative_parts'} onChange={e => setExportContentOption(e.target.value)} /> Simplified Operative Parts</label>
          <label style={{display: 'block', marginBottom: '5px'}}><input type="radio" name="exportContentOption" value="full_operative_parts" checked={exportContentOption === 'full_operative_parts'} onChange={e => setExportContentOption(e.target.value)} /> Full (Verbatim) Operative Parts</label>
          <label style={{display: 'block', marginBottom: '5px'}}><input type="radio" name="exportContentOption" value="complete_case_text" checked={exportContentOption === 'complete_case_text'} onChange={e => setExportContentOption(e.target.value)} /> Complete Case Text (if available)</label>
          <label style={{display: 'block'}}><input type="radio" name="exportContentOption" value="case_links_only" checked={exportContentOption === 'case_links_only'} onChange={e => setExportContentOption(e.target.value)} /> Case Links Only</label>
        </div>
      </div>

      <button onClick={handleGenerateReport} style={{padding: '12px 20px', fontSize: '1.1em', width: '100%', boxSizing: 'border-box', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
        Generate Report
      </button>
    </div>
  );
};

export default ReportBuilderPage;
