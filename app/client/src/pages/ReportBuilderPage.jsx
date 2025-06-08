import React, { useState, useEffect, useCallback } from 'react';
import { getAllLegislations, getArticlesByLegislationId, generateReport } from '../services/api';

// Helper function to extract filename
function getFilenameFromContentDisposition(header) {
  if (!header) return `report_${new Date().toISOString().split('T')[0]}.csv`; // Default filename
  const filenameMatch = header.match(/filename="?([^"]+)"?/);
  return filenameMatch && filenameMatch[1] ? filenameMatch[1] : `report_${new Date().toISOString().split('T')[0]}.csv`;
}

const ReportBuilderPage = () => {
  // State for selections
  const [targetScope, setTargetScope] = useState('entire_legislation');
  const [selectedLegislationId, setSelectedLegislationId] = useState('');
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);

  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterCourt, setFilterCourt] = useState('');
  const [filterCaseOutcome, setFilterCaseOutcome] = useState(''); // Placeholder

  const [exportFormat, setExportFormat] = useState('CSV');
  const [exportContentOption, setExportContentOption] = useState('simplified_operative_parts');

  // State for populating selectors
  const [legislationsList, setLegislationsList] = useState([]);
  const [articlesList, setArticlesList] = useState([]);
  const [isLoadingLegislations, setIsLoadingLegislations] = useState(false);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);

  // State for report generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportError, setReportError] = useState(null);

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

  const fetchArticlesForLegislation = useCallback(async (legislationId) => {
    if (!legislationId || targetScope !== 'specific_articles') {
      setArticlesList([]);
      setSelectedArticleIds([]);
      return;
    }
    setIsLoadingArticles(true);
    try {
      const response = await getArticlesByLegislationId(legislationId, 1, 1000);
      setArticlesList(response.data || []);
    } catch (error) {
      console.error(`Failed to fetch articles for legislation ${legislationId}`, error);
      setArticlesList([]);
    } finally {
      setIsLoadingArticles(false);
    }
  }, [targetScope]);

  useEffect(() => {
    if (selectedLegislationId && targetScope === 'specific_articles') {
      fetchArticlesForLegislation(selectedLegislationId);
    } else {
      setArticlesList([]);
      setSelectedArticleIds([]);
    }
  }, [selectedLegislationId, targetScope, fetchArticlesForLegislation]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setReportError(null);

    const reportConfig = {
      targetScope,
      selectedLegislationId: (targetScope === 'entire_legislation' || targetScope === 'specific_articles') && selectedLegislationId ? selectedLegislationId : null,
      selectedArticleIds: targetScope === 'specific_articles' ? selectedArticleIds.map(id => String(id)) : [], // Ensure IDs are strings if needed by backend
      filters: {
        dateStart: filterDateStart || null,
        dateEnd: filterDateEnd || null,
        court: filterCourt || null,
        // caseOutcome: filterCaseOutcome || null, // Placeholder
      },
      exportFormat, // CSV for now
      exportContentOption,
    };

    // Basic validation
    if ((targetScope === 'entire_legislation' || targetScope === 'specific_articles') && !reportConfig.selectedLegislationId) {
        setReportError("Please select a legislation for the chosen target scope.");
        setIsGenerating(false);
        return;
    }
    if (targetScope === 'specific_articles' && reportConfig.selectedArticleIds.length === 0) {
        setReportError("Please select at least one article for the 'Specific Articles' scope.");
        setIsGenerating(false);
        return;
    }

    try {
      const response = await generateReport(reportConfig);

      const filename = getFilenameFromContentDisposition(response.headers['content-disposition']);
      const blob = new Blob([response.data], { type: response.headers['content-type'] || 'text/csv' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Report generation failed:", error);
      setReportError(error.message || 'An unknown error occurred during report generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleArticleSelection = (articleId) => {
    const stringArticleId = String(articleId); // Ensure consistent type for comparison
    setSelectedArticleIds(prev =>
      prev.includes(stringArticleId)
        ? prev.filter(id => id !== stringArticleId)
        : [...prev, stringArticleId]
    );
  };

  const commonSelectStyle = { padding: '8px', margin: '5px 0', width: '100%', boxSizing: 'border-box', height: '40px'};
  const commonInputStyle = { padding: '8px', margin: '5px 0', width: 'calc(100% - 16px)', boxSizing: 'border-box', height: '40px' };
  const dateInputStyle = { padding: '7px', margin: '5px 0', width: 'calc(50% - 12px)', boxSizing: 'border-box', height: '40px' };
  const sectionStyle = { border: '1px solid #ccc', padding: '15px', marginBottom: '20px', borderRadius: '5px' };
  const labelStyle = { display: 'block', margin: '10px 0 5px 0', fontWeight: 'bold' };
  const fieldsetDisabled = isGenerating; // Disable form elements while generating

  return (
    <div style={{textAlign: 'left', maxWidth: '700px', margin: 'auto'}}>
      <h2>Report Builder</h2>

      <fieldset disabled={fieldsetDisabled} style={{border: 'none', padding: 0, margin: 0}}>
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
                        checked={selectedArticleIds.includes(String(article.id))}
                        onChange={() => handleArticleSelection(article.id)}
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
            <input type="date" id="filterDateStart" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} style={dateInputStyle} />
            <span style={{margin: '0 10px'}}>to</span>
            <input type="date" id="filterDateEnd" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} style={dateInputStyle} />
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
              <option value="CSV">CSV</option>
              {/* <option value="HTML">HTML</option>
              <option value="Word">Word (DOCX)</option>
              <option value="PDF">PDF</option> */}
            </select>
            <small><i>Only CSV is currently supported.</i></small>
          </div>
          <div>
            <label style={labelStyle}>Content Options:</label>
            <label style={{display: 'block', marginBottom: '5px'}}><input type="radio" name="exportContentOption" value="simplified_operative_parts" checked={exportContentOption === 'simplified_operative_parts'} onChange={e => setExportContentOption(e.target.value)} /> Simplified Operative Parts</label>
            <label style={{display: 'block', marginBottom: '5px'}}><input type="radio" name="exportContentOption" value="full_operative_parts" checked={exportContentOption === 'full_operative_parts'} onChange={e => setExportContentOption(e.target.value)} /> Full (Verbatim) Operative Parts</label>
            <label style={{display: 'block', marginBottom: '5px'}}><input type="radio" name="exportContentOption" value="complete_case_text" checked={exportContentOption === 'complete_case_text'} onChange={e => setExportContentOption(e.target.value)} /> Complete Case Text (if available)</label>
            <label style={{display: 'block'}}><input type="radio" name="exportContentOption" value="case_links_only" checked={exportContentOption === 'case_links_only'} onChange={e => setExportContentOption(e.target.value)} /> Case Links Only</label>
          </div>
        </div>
      </fieldset>

      {reportError && <p style={{ color: 'red', marginTop: '10px' }}>Error: {reportError}</p>}

      <button
        onClick={handleGenerateReport}
        disabled={isGenerating}
        style={{padding: '12px 20px', fontSize: '1.1em', width: '100%', boxSizing: 'border-box', backgroundColor: isGenerating ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: isGenerating ? 'not-allowed' : 'pointer', marginTop: '10px' }}
      >
        {isGenerating ? 'Generating...' : 'Generate Report'}
      </button>
    </div>
  );
};

export default ReportBuilderPage;
