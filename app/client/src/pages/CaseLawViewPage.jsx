import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, Link, useOutletContext } from 'react-router-dom';
import { getCaseLawById, getOperativePartsByCaseLawId, getArticlesReferencedByCaseLaw } from '../services/api';
import { setBreadcrumbTitle, clearBreadcrumbTitle } from '../components/Breadcrumbs';
// import { marked } from 'marked'; // Not typically used for direct HTML content

const OP_PARTS_PER_PAGE = 50;
const SIDEBAR_ITEMS_LIMIT = 5;

// Slugify utility for generating DOM-friendly IDs
const slugify = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-'); // Replace multiple - with single -
};

const generateToCFromHtml = (htmlString) => {
  if (!htmlString) return { tocItems: [], processedHtml: '' };

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;

  const headings = tempDiv.querySelectorAll('h1, h2, h3');
  const tocItems = [];
  let headingIndex = 0; // To ensure unique IDs if text is the same

  headings.forEach((heading) => {
    const text = heading.textContent || '';
    let slug = slugify(text);
    if (!slug) { // Handle empty text or text that slugs to empty
        slug = `heading-${headingIndex}`;
    }
    // Ensure uniqueness if multiple headings have same text
    let uniqueSlug = slug;
    let i = 1;
    while (tocItems.find(item => item.id === uniqueSlug) || tempDiv.querySelector(`#${uniqueSlug}`)) {
        uniqueSlug = `${slug}-${i}`;
        i++;
    }
    slug = uniqueSlug;
    headingIndex++;

    heading.id = slug; // Add ID to the heading element in the temporary DOM

    tocItems.push({
      id: slug,
      level: parseInt(heading.tagName.substring(1), 10),
      text: text,
    });
  });

  return { tocItems, processedHtml: tempDiv.innerHTML };
};


const CaseLawViewPage = () => {
  const { id: caseLawId } = useParams();
  const location = useLocation();
  const { setSidebarData } = useOutletContext();

  const [caseLaw, setCaseLaw] = useState(null);
  const [isLoadingCaseLaw, setIsLoadingCaseLaw] = useState(true);
  const [errorCaseLaw, setErrorCaseLaw] = useState(null);

  const [operativeParts, setOperativeParts] = useState([]);
  const [isLoadingOperativeParts, setIsLoadingOperativeParts] = useState(true);
  const [errorOperativeParts, setErrorOperativeParts] = useState(null);
  const [opCurrentPage, setOpCurrentPage] = useState(1);
  const [opTotalPages, setOpTotalPages] = useState(0);

  const [showSimplifiedText, setShowSimplifiedText] = useState(true);
  const operativePartRefs = useRef({});

  const [referencedArticlesForSidebar, setReferencedArticlesForSidebar] = useState([]);
  const [isLoadingSidebarArticles, setIsLoadingSidebarArticles] = useState(false);

  const [tocItems, setTocItems] = useState([]);
  const [processedHtmlContent, setProcessedHtmlContent] = useState('');


  // Fetch Case Law Details
  useEffect(() => {
    const fetchCaseLaw = async () => {
      setIsLoadingCaseLaw(true);
      setErrorCaseLaw(null);
      setOperativeParts([]);
      setOpCurrentPage(1);
      setOpTotalPages(0);
      setTocItems([]); // Clear ToC
      setProcessedHtmlContent(''); // Clear processed HTML

      try {
        const data = await getCaseLawById(caseLawId);
        setCaseLaw(data);
        if (data) {
          setBreadcrumbTitle(location.pathname, data.title || `Case Law: ${data.celex_number || data.id}`);
          if (data.html_content) {
            const { tocItems: newTocItems, processedHtml: newHtml } = generateToCFromHtml(data.html_content);
            setTocItems(newTocItems);
            setProcessedHtmlContent(newHtml);
          } else {
            setProcessedHtmlContent(''); // No HTML content to process
          }
        }
      } catch (err) {
        setErrorCaseLaw(err.response?.data?.error || err.message || `Failed to load case law ${caseLawId}.`);
        setCaseLaw(null);
        clearBreadcrumbTitle(location.pathname);
      } finally {
        setIsLoadingCaseLaw(false);
      }
    };
    fetchCaseLaw();
    return () => {
      clearBreadcrumbTitle(location.pathname);
      if (setSidebarData) setSidebarData(null);
    };
  }, [caseLawId, location.pathname, setSidebarData]);

  // Fetch Operative Parts (existing logic)
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

  // Fetch Referenced Articles for Sidebar (existing logic)
  const fetchSidebarArticles = useCallback(async () => {
    if (!caseLawId || !setSidebarData) return;
    setIsLoadingSidebarArticles(true);
    try {
      const articles = await getArticlesReferencedByCaseLaw(caseLawId, SIDEBAR_ITEMS_LIMIT);
      setReferencedArticlesForSidebar(articles || []);
      const currentCaseLawTitle = caseLaw ? (caseLaw.title || caseLaw.celex_number) : `Case ${caseLawId}`;
      setSidebarData({
        contextType: 'case_law',
        contextTitle: currentCaseLawTitle,
        referencedArticlesForCaseLaw: articles || []
      });
    } catch (error) {
      console.error("Error fetching referenced articles for sidebar:", error);
      setSidebarData({ contextType: 'case_law', referencedArticlesForCaseLaw: [] });
    } finally {
      setIsLoadingSidebarArticles(false);
    }
  }, [caseLawId, setSidebarData, caseLaw]); // Added caseLaw to dependencies for currentCaseLawTitle

  useEffect(() => {
    if (caseLaw) {
      fetchOperativeParts(opCurrentPage);
      fetchSidebarArticles();
    }
    if (!caseLaw && setSidebarData) {
        setSidebarData(null);
    }
  }, [caseLaw, opCurrentPage, fetchOperativeParts, fetchSidebarArticles, setSidebarData]);


  // Scrolling to Operative Part or ToC item based on Hash
  useEffect(() => {
    if (location.hash && (operativeParts.length > 0 || tocItems.length > 0)) {
      const elementId = location.hash.substring(1);
      // Delay scroll slightly to allow DOM to update, especially with processed HTML
      setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location.hash, operativeParts, tocItems, processedHtmlContent]); // Re-run if processedHtmlContent changes

  const handleOpPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= opTotalPages) {
      setOpCurrentPage(newPage);
    }
  };

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

      {/* Table of Contents Section */}
      {tocItems.length > 0 && (
        <div style={{margin: '20px 0', padding: '15px', border: '1px solid #e0e0e0', backgroundColor: '#fdfdfd'}}>
          <h4 style={{marginTop:0}}>Table of Contents</h4>
          <ul style={{listStyle: 'none', paddingLeft: 0}}>
            {tocItems.map(item => (
              <li key={item.id} style={{ marginLeft: `${(item.level - 1) * 20}px`, marginBottom: '5px' }}>
                <a href={`#${item.id}`} style={{textDecoration: 'none', color: '#007bff'}}>
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Case Law Content (HTML) */}
      {processedHtmlContent ? (
        <>
          <h3 style={{marginTop: '30px'}}>Full Text Document</h3>
          <div dangerouslySetInnerHTML={{ __html: processedHtmlContent }} />
        </>
      ) : caseLaw.html_content && tocItems.length === 0 ? ( // Fallback if ToC generation failed but HTML content exists
         <>
          <h3 style={{marginTop: '30px'}}>Full Text Document</h3>
          <div dangerouslySetInnerHTML={{ __html: caseLaw.html_content }} />
        </>
      ) : (
        <p style={{marginTop: '20px', fontStyle: 'italic'}}>No full HTML content available for ToC generation or display.</p>
      )}


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
                   style={{ marginBottom: '15px', padding: '10px', border: '1px solid #ddd', scrollMarginTop: '70px' /* For scroll targeting with fixed header */ }}>
                <h4 style={{marginTop: 0}}>
                  Part {op.part_number}
                  <span style={{fontSize: '0.8em', fontWeight: 'normal', marginLeft: '10px'}}>{displayType}</span>
                </h4>
                <div style={{whiteSpace: 'pre-wrap'}}>{displayText || 'No text available for this version.'}</div>
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
