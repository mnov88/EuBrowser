import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useLocation, useOutletContext } from 'react-router-dom'; // Import useOutletContext
import {
  getArticleById,
  getCaseLawsInterpretingArticle,
  getOperativePartsInterpretingArticle
} from '../services/api';
import { marked } from 'marked';
import { setBreadcrumbTitle, clearBreadcrumbTitle } from '../components/Breadcrumbs';

const RELATED_ITEMS_PER_PAGE = 50; // For main page content pagination
const SIDEBAR_ITEMS_LIMIT = 5; // For sidebar display - this remains small

const ArticleViewPage = () => {
  const { id: articleId } = useParams();
  const location = useLocation();
  const { setSidebarData } = useOutletContext(); // Get setSidebarData from layout

  const [article, setArticle] = useState(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(true);
  const [errorArticle, setErrorArticle] = useState(null);

  const [relatedCaseLaws, setRelatedCaseLaws] = useState([]);
  const [isLoadingCaseLaws, setIsLoadingCaseLaws] = useState(false);
  const [errorCaseLaws, setErrorCaseLaws] = useState(null);
  const [caseLawsCurrentPage, setCaseLawsCurrentPage] = useState(1);
  const [caseLawsTotalPages, setCaseLawsTotalPages] = useState(0);

  const [relatedOperativeParts, setRelatedOperativeParts] = useState([]);
  const [isLoadingOperativeParts, setIsLoadingOperativeParts] = useState(false);
  const [errorOperativeParts, setErrorOperativeParts] = useState(null);
  const [operativePartsCurrentPage, setOperativePartsCurrentPage] = useState(1);
  const [operativePartsTotalPages, setOperativePartsTotalPages] = useState(0);

  // Fetch Article Details
  useEffect(() => {
    const fetchArticle = async () => {
      setIsLoadingArticle(true);
      setErrorArticle(null);
      // Reset related items when article changes
      setRelatedCaseLaws([]);
      setCaseLawsCurrentPage(1);
      setCaseLawsTotalPages(0);
      setRelatedOperativeParts([]);
      setOperativePartsCurrentPage(1);
      setOperativePartsTotalPages(0);

      try {
        const data = await getArticleById(articleId);
        setArticle(data);
        if (data) {
          const breadcrumbName = data.title ? `${data.article_number_text}: ${data.title}` : `${data.article_number_text || 'Article ' + data.id}`;
          setBreadcrumbTitle(location.pathname, breadcrumbName);
        }
      } catch (err) {
        setErrorArticle(err.response?.data?.error || err.message || `Failed to load article ${articleId}.`);
        setArticle(null);
        clearBreadcrumbTitle(location.pathname);
      } finally {
        setIsLoadingArticle(false);
      }
    };
    fetchArticle();
    return () => {
      clearBreadcrumbTitle(location.pathname);
      if (setSidebarData) setSidebarData(null); // Clear sidebar on unmount
    };
  }, [articleId, location.pathname, setSidebarData]);

  // Fetch Related Case Laws
  const fetchCaseLaws = useCallback(async (page) => {
    setIsLoadingCaseLaws(true);
    setErrorCaseLaws(null);
    try {
      const response = await getCaseLawsInterpretingArticle(articleId, page, RELATED_ITEMS_PER_PAGE);
      const caseLawsData = response.data || [];
      setRelatedCaseLaws(caseLawsData);
      setCaseLawsTotalPages(response.pagination?.totalPages || 0);
      setCaseLawsCurrentPage(response.pagination?.page || page);

      // Update sidebar data with the fetched case laws (limited items)
      // Ensure case_law object exists and has necessary fields
      if (setSidebarData) {
        const sidebarCaseLaws = caseLawsData
          .map(item => item.case_law) // Extract the case_law object
          .filter(Boolean) // Filter out any undefined/null case_law objects
          .slice(0, SIDEBAR_ITEMS_LIMIT);
        const currentArticleTitle = article ? (article.title || article.article_number_text) : `Article ${articleId}`;
        setSidebarData({
          contextType: 'article',
          contextTitle: currentArticleTitle,
          relatedCaseLawsForArticle: sidebarCaseLaws
        });
      }

    } catch (err) {
      setErrorCaseLaws(err.response?.data?.error || err.message || 'Failed to load related case laws.');
      setRelatedCaseLaws([]);
      setCaseLawsTotalPages(0);
      if (setSidebarData) setSidebarData({ contextType: 'article', relatedCaseLawsForArticle: [] }); // Clear on error
    } finally {
      setIsLoadingCaseLaws(false);
    }
  }, [articleId, setSidebarData]);

  useEffect(() => {
    if (article) { // Only fetch if article has been loaded
      fetchCaseLaws(caseLawsCurrentPage); // Fetch for main page content
    }
     // Clear sidebar data if article is not loaded or changes
    if (!article && setSidebarData) {
        setSidebarData(null);
    }
  }, [article, caseLawsCurrentPage, fetchCaseLaws, setSidebarData]);

  // Fetch Related Operative Parts
  const fetchOperativeParts = useCallback(async (page) => {
    setIsLoadingOperativeParts(true);
    setErrorOperativeParts(null);
    try {
      const response = await getOperativePartsInterpretingArticle(articleId, page, RELATED_ITEMS_PER_PAGE);
      // Assuming response.data contains the array of { id (junction_id), operative_part_id, article_id, operative_part: { id, part_number, case_law_id, case_law: { celex_number } } }
      setRelatedOperativeParts(response.data || []);
      setOperativePartsTotalPages(response.pagination?.totalPages || 0);
      setOperativePartsCurrentPage(response.pagination?.page || page);
    } catch (err) {
      setErrorOperativeParts(err.response?.data?.error || err.message || 'Failed to load related operative parts.');
      setRelatedOperativeParts([]);
      setOperativePartsTotalPages(0);
    } finally {
      setIsLoadingOperativeParts(false);
    }
  }, [articleId]);

  useEffect(() => {
    if (article) { // Only fetch if article has been loaded
      fetchOperativeParts(operativePartsCurrentPage);
    }
  }, [article, operativePartsCurrentPage, fetchOperativeParts]);


  const handlePageChange = (setter, newPage, totalPages) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setter(newPage);
    }
  };

  const renderMarkdown = (mdContent) => {
    if (!mdContent) return null;
    const htmlContent = marked(mdContent);
    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} style={{textAlign: 'left', padding: '10px', border: '1px solid #eee', background: '#f9f9f9'}} />;
  };

  if (isLoadingArticle) return <p>Loading article details...</p>;
  if (errorArticle) return <p style={{ color: 'red' }}>Error: {errorArticle}</p>;
  if (!article) return <p>Article not found.</p>;

  return (
    <div style={{textAlign: 'left'}}>
      <h2>{article.article_number_text || 'Article Details'}{article.title ? `: ${article.title}` : ''}</h2>
      {article.legislation_id && (
        <p><Link to={`/legislations/${article.legislation_id}`}>Back to Legislation (ID: {article.legislation_id})</Link></p>
      )}
      <p><strong>ID:</strong> {article.id}</p>

      <h3 style={{marginTop: '30px'}}>Article Content</h3>
      {article.markdown_content ? renderMarkdown(article.markdown_content) : <p>No content available.</p>}

      {/* Related Case Laws Section */}
      <section style={{marginTop: '30px'}}>
        <h3>Case Laws Interpreting this Article</h3>
        {isLoadingCaseLaws ? <p>Loading related case laws...</p> : null}
        {errorCaseLaws && <p style={{ color: 'red' }}>Error: {errorCaseLaws}</p>}
        {!isLoadingCaseLaws && !errorCaseLaws && relatedCaseLaws.length === 0 && <p>No case laws found interpreting this article.</p>}
        {!isLoadingCaseLaws && !errorCaseLaws && relatedCaseLaws.length > 0 && (
          <>
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
              {relatedCaseLaws.map(item => (
                // Assuming item.case_law contains the details due to backend join
                item.case_law ? (
                   <li key={item.id /* junction id */} style={{ marginBottom: '10px', padding: '8px', border: '1px solid #ddd' }}>
                    <Link to={`/case-laws/${item.case_law.id}`}>
                      {item.case_law.title || item.case_law.celex_number || `Case Law ID: ${item.case_law.id}`}
                    </Link>
                  </li>
                ) : (
                  <li key={item.id}>Related Case Law ID: {item.case_law_id} (Details unavailable)</li>
                )
              ))}
            </ul>
            {caseLawsTotalPages > 1 && (
              <div>
                <button onClick={() => handlePageChange(setCaseLawsCurrentPage, caseLawsCurrentPage - 1, caseLawsTotalPages)} disabled={caseLawsCurrentPage === 1}>Previous</button>
                <span> Page {caseLawsCurrentPage} of {caseLawsTotalPages} </span>
                <button onClick={() => handlePageChange(setCaseLawsCurrentPage, caseLawsCurrentPage + 1, caseLawsTotalPages)} disabled={caseLawsCurrentPage === caseLawsTotalPages}>Next</button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Related Operative Parts Section */}
      <section style={{marginTop: '30px'}}>
        <h3>Operative Parts Interpreting this Article</h3>
        {isLoadingOperativeParts ? <p>Loading related operative parts...</p> : null}
        {errorOperativeParts && <p style={{ color: 'red' }}>Error: {errorOperativeParts}</p>}
        {!isLoadingOperativeParts && !errorOperativeParts && relatedOperativeParts.length === 0 && <p>No operative parts found interpreting this article.</p>}
        {!isLoadingOperativeParts && !errorOperativeParts && relatedOperativeParts.length > 0 && (
          <>
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
              {relatedOperativeParts.map(item => (
                // Assuming item.operative_part contains the details
                item.operative_part ? (
                  <li key={item.id /* junction id */} style={{ marginBottom: '10px', padding: '8px', border: '1px solid #ddd' }}>
                    <Link to={`/case-laws/${item.operative_part.case_law_id}#op-${item.operative_part.id}`}>
                      Part {item.operative_part.part_number} of Case Law {item.operative_part.case_law?.celex_number || `ID: ${item.operative_part.case_law_id}`}
                    </Link>
                  </li>
                ) : (
                   <li key={item.id}>Related Operative Part ID: {item.operative_part_id} (Details unavailable)</li>
                )
              ))}
            </ul>
            {operativePartsTotalPages > 1 && (
              <div>
                <button onClick={() => handlePageChange(setOperativePartsCurrentPage, operativePartsCurrentPage - 1, operativePartsTotalPages)} disabled={operativePartsCurrentPage === 1}>Previous</button>
                <span> Page {operativePartsCurrentPage} of {operativePartsTotalPages} </span>
                <button onClick={() => handlePageChange(setOperativePartsCurrentPage, operativePartsCurrentPage + 1, operativePartsTotalPages)} disabled={operativePartsCurrentPage === operativePartsTotalPages}>Next</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default ArticleViewPage;
