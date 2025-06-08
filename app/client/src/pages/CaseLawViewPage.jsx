import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { getCaseLawById, getOperativePartsByCaseLawId } from '../services/api';
// import { marked } from 'marked'; // Uncomment if summary_text or other fields are markdown

const OP_PARTS_PER_PAGE = 10;

const CaseLawViewPage = () => {
  const { id: caseLawId } = useParams();
  const location = useLocation(); // For URL hash

  const [caseLaw, setCaseLaw] = useState(null);
  const [isLoadingCaseLaw, setIsLoadingCaseLaw] = useState(true);
  const [errorCaseLaw, setErrorCaseLaw] = useState(null);

  const [operativeParts, setOperativeParts] = useState([]);
  const [isLoadingOperativeParts, setIsLoadingOperativeParts] = useState(true);
  const [errorOperativeParts, setErrorOperativeParts] = useState(null);
  const [opCurrentPage, setOpCurrentPage] = useState(1);
  const [opTotalPages, setOpTotalPages] = useState(0);

  const [showSimplifiedText, setShowSimplifiedText] = useState(true);

  const operativePartRefs = useRef({}); // To store refs for scrolling

  // Fetch Case Law Details
  useEffect(() => {
    const fetchCaseLaw = async () => {
      setIsLoadingCaseLaw(true);
      setErrorCaseLaw(null);
      setOperativeParts([]); // Reset operative parts when case law changes
      setOpCurrentPage(1);
      setOpTotalPages(0);
      try {
        const data = await getCaseLawById(caseLawId);
        setCaseLaw(data);
      } catch (err) {
        setErrorCaseLaw(err.response?.data?.error || err.message || `Failed to load case law ${caseLawId}.`);
        setCaseLaw(null);
      } finally {
        setIsLoadingCaseLaw(false);
      }
    };
    fetchCaseLaw();
  }, [caseLawId]);

  // Fetch Operative Parts
  const fetchOperativeParts = useCallback(async (page) => {
    setIsLoadingOperativeParts(true);
    setErrorOperativeParts(null);
    try {
      const response = await getOperativePartsByCaseLawId(caseLawId, page, OP_PARTS_PER_PAGE);
      setOperativeParts(response.data || []);
      setOpTotalPages(response.pagination?.totalPages || 0);
      setOpCurrentPage(response.pagination?.page || page);
    } catch (err) {
      setErrorOperativeParts(err.response?.data?.error || err.message || 'Failed to load operative parts.');
      setOperativeParts([]);
      setOpTotalPages(0);
    } finally {
      setIsLoadingOperativeParts(false);
    }
  }, [caseLawId]);

  useEffect(() => {
    if (caseLaw) { // Only fetch if caseLaw has been loaded
      fetchOperativeParts(opCurrentPage);
    }
  }, [caseLaw, opCurrentPage, fetchOperativeParts]);

  // Scrolling to Operative Part based on Hash
  useEffect(() => {
    if (location.hash && operativeParts.length > 0) {
      const elementId = location.hash.substring(1); // Remove #
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [location.hash, operativeParts]); // Rerun when hash changes or OPs are loaded

  const handleOpPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= opTotalPages) {
      setOpCurrentPage(newPage);
    }
  };

  // const renderMarkdown = (mdContent) => { // If using marked for summary_text
  //   if (!mdContent) return null;
  //   return <div dangerouslySetInnerHTML={{ __html: marked(mdContent) }} />;
  // };

  if (isLoadingCaseLaw) return <p>Loading case law details...</p>;
  if (errorCaseLaw) return <p style={{ color: 'red' }}>Error: {errorCaseLaw}</p>;
  if (!caseLaw) return <p>Case law not found.</p>;

  return (
    <div style={{textAlign: 'left'}}>
      <h2>{caseLaw.title || 'Case Law Details'}</h2>
      <p><strong>CELEX Number:</strong> {caseLaw.celex_number}</p>
      <p><strong>ID:</strong> {caseLaw.id}</p>
      <p><strong>Court:</strong> {caseLaw.court || 'N/A'}</p>
      <p><strong>Date of Judgment:</strong> {caseLaw.date_of_judgment ? new Date(caseLaw.date_of_judgment).toLocaleDateString() : 'N/A'}</p>
      <p><strong>Parties:</strong> {caseLaw.parties || 'N/A'}</p>

      <h3 style={{marginTop: '30px'}}>Summary</h3>
      {caseLaw.summary_text ? (
        <div style={{whiteSpace: 'pre-wrap', padding: '10px', border: '1px solid #eee', background: '#f9f9f9'}}>{caseLaw.summary_text}</div>
      ) : <p>No summary available.</p>}

      <div style={{margin: '20px 0'}}>
        {/* Placeholder for Table of Contents */}
        <div style={{padding: '10px', border: '1px dashed #ccc', backgroundColor: '#fafafa'}}>
            Table of Contents will be here. (Based on headings in full text content)
        </div>
      </div>


      <h3 style={{marginTop: '30px'}}>Operative Parts</h3>
      <button onClick={() => setShowSimplifiedText(!showSimplifiedText)} style={{marginBottom: '15px', padding: '8px 12px'}}>
        Show {showSimplifiedText ? 'Verbatim Text' : 'Simplified Text'}
      </button>

      {isLoadingOperativeParts ? <p>Loading operative parts...</p> : null}
      {errorOperativeParts && <p style={{ color: 'red' }}>Error: {errorOperativeParts}</p>}
      {!isLoadingOperativeParts && !errorOperativeParts && operativeParts.length === 0 && <p>No operative parts found for this case law.</p>}

      {!isLoadingOperativeParts && !errorOperativeParts && operativeParts.length > 0 && (
        <>
          {operativeParts.map(op => {
            const displayText = (showSimplifiedText && op.simplified_text) ? op.simplified_text : op.verbatim_text;
            const displayType = (showSimplifiedText && op.simplified_text) ? "(Simplified)" : "(Verbatim)";
            return (
              <div key={op.id} id={`op-${op.id}`} ref={el => operativePartRefs.current[`op-${op.id}`] = el}
                   style={{ marginBottom: '15px', padding: '10px', border: '1px solid #ddd', scrollMarginTop: '20px' /* For scroll targeting */ }}>
                <h4 style={{marginTop: 0}}>
                  Part {op.part_number}
                  <span style={{fontSize: '0.8em', fontWeight: 'normal', marginLeft: '10px'}}>{displayType}</span>
                </h4>
                <div style={{whiteSpace: 'pre-wrap'}}>{displayText || 'No text available for this version.'}</div>
                {/* Link to Article if this OP interprets one - requires more data from backend or another fetch */}
                {/* Example: op.interprets_article_id && <Link to={`/articles/${op.interprets_article_id}`}>Interprets Article ID: {op.interprets_article_id}</Link> */}
              </div>
            );
          })}

          {opTotalPages > 1 && (
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <button onClick={() => handleOpPageChange(opCurrentPage - 1)} disabled={opCurrentPage === 1 || isLoadingOperativeParts} style={{marginRight: '10px'}}>
                Previous Parts
              </button>
              <span>Page {opCurrentPage} of {opTotalPages}</span>
              <button onClick={() => handleOpPageChange(opCurrentPage + 1)} disabled={opCurrentPage === opTotalPages || isLoadingOperativeParts} style={{marginLeft: '10px'}}>
                Next Parts
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CaseLawViewPage;
