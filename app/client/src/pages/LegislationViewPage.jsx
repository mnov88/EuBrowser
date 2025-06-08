import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
    getLegislationById,
    getArticlesByLegislationId,
    getLegislationFullText // Import new function
} from '../services/api';
import { marked } from 'marked';
import { setBreadcrumbTitle, clearBreadcrumbTitle } from '../components/Breadcrumbs';

const ARTICLES_PER_PAGE = 50;

const LegislationViewPage = () => {
  const { id: legislationId } = useParams();
  const location = useLocation();

  const [legislation, setLegislation] = useState(null); // Will store metadata initially
  const [fullText, setFullText] = useState('');
  const [isLoadingFullText, setIsLoadingFullText] = useState(false);
  const [fullTextError, setFullTextError] = useState(null);

  const [articles, setArticles] = useState([]);
  const [isLoadingLegislation, setIsLoadingLegislation] = useState(true); // For metadata
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [errorLegislation, setErrorLegislation] = useState(null);
  const [errorArticles, setErrorArticles] = useState(null);

  const [articlesCurrentPage, setArticlesCurrentPage] = useState(1);
  const [articlesTotalPages, setArticlesTotalPages] = useState(0);

  // Fetch legislation metadata
  useEffect(() => {
    const fetchLegislationMetadata = async () => {
      setIsLoadingLegislation(true);
      setErrorLegislation(null);
      setFullText(''); // Clear previous full text when legislation changes
      setFullTextError(null);
      try {
        const data = await getLegislationById(legislationId);
        setLegislation(data);
        if (data && data.title) {
          setBreadcrumbTitle(location.pathname, data.title);
        } else if (data) {
          setBreadcrumbTitle(location.pathname, `Legislation ID: ${data.id}`);
        }
        // Note: full_markdown_content is NOT expected here initially
      } catch (err) {
        setErrorLegislation(err.response?.data?.error || err.message || `Failed to load legislation ${legislationId}.`);
        setLegislation(null);
        clearBreadcrumbTitle(location.pathname);
      } finally {
        setIsLoadingLegislation(false);
      }
    };
    fetchLegislationMetadata();
    return () => clearBreadcrumbTitle(location.pathname);
  }, [legislationId, location.pathname]);

  // Function to load full text content
  const handleLoadFullText = async () => {
    setIsLoadingFullText(true);
    setFullTextError(null);
    try {
      const data = await getLegislationFullText(legislationId);
      setFullText(data.full_markdown_content || 'No full text content provided.');
    } catch (err) {
      setFullTextError(err.response?.data?.error || err.message || 'Failed to load full text.');
      setFullText('');
    } finally {
      setIsLoadingFullText(false);
    }
  };

  // Fetch articles (remains the same)
  const fetchArticles = useCallback(async (page) => {
    setIsLoadingArticles(true);
    setErrorArticles(null);
    try {
      const response = await getArticlesByLegislationId(legislationId, page, ARTICLES_PER_PAGE);
      setArticles(response.data || []);
      setArticlesTotalPages(response.pagination?.totalPages || 0);
      setArticlesCurrentPage(response.pagination?.page || page);
    } catch (err) {
      setErrorArticles(err.response?.data?.error || err.message || 'Failed to load articles.');
      setArticles([]);
      setArticlesTotalPages(0);
    } finally {
      setIsLoadingArticles(false);
    }
  }, [legislationId]);

  useEffect(() => {
    setArticlesCurrentPage(1);
  }, [legislationId]);

  useEffect(() => {
    if (legislationId) {
        fetchArticles(articlesCurrentPage);
    }
  }, [legislationId, articlesCurrentPage, fetchArticles]);

  const handleArticlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= articlesTotalPages) {
      setArticlesCurrentPage(newPage);
    }
  };

  const renderMarkdown = (mdContent) => {
    if (!mdContent) return null;
    const htmlContent = marked(mdContent);
    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} style={{textAlign: 'left', padding: '10px', border: '1px solid #eee', background: '#f9f9f9'}}/>;
  };

  if (isLoadingLegislation) {
    return <p>Loading legislation details...</p>;
  }
  if (errorLegislation) {
    return <p style={{ color: 'red' }}>Error: {errorLegislation}</p>;
  }
  if (!legislation) {
    return <p>Legislation not found.</p>;
  }

  return (
    <div style={{textAlign: 'left'}}>
      <h2>{legislation.title || 'Legislation Details'}</h2>
      <p><strong>CELEX Number:</strong> {legislation.celex_number}</p>
      <p><strong>ID:</strong> {legislation.id}</p>
      <p><strong>Created At:</strong> {new Date(legislation.created_at).toLocaleDateString()}</p>
      <p><strong>Last Updated:</strong> {new Date(legislation.updated_at).toLocaleDateString()}</p>

      <h3 style={{marginTop: '30px'}}>Full Text Content</h3>
      {fullText ? (
        renderMarkdown(fullText)
      ) : isLoadingFullText ? (
        <p>Loading full text...</p>
      ) : fullTextError ? (
        <p style={{ color: 'red' }}>Error loading full text: {fullTextError} <button onClick={handleLoadFullText}>Retry</button></p>
      ) : (
        <button onClick={handleLoadFullText} style={{padding: '8px 12px', cursor: 'pointer'}}>
          Load Full Text
        </button>
      )}

      {/* Articles Section remains the same */}
      <h3 style={{marginTop: '30px'}}>Articles in this Legislation</h3>
      {isLoadingArticles ? (
        <p>Loading articles...</p>
      ) : errorArticles ? (
        <p style={{ color: 'red' }}>Error loading articles: {errorArticles}</p>
      ) : articles.length > 0 ? (
        <>
          <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
            {articles.map(article => (
              <li key={article.id} style={{ marginBottom: '10px', padding: '8px', border: '1px solid #ddd' }}>
                <Link to={`/articles/${article.id}`} style={{textDecoration: 'none', color: '#007bff'}}>
                  <strong>{article.article_number_text || `Article ID ${article.id}`}:</strong> {article.title || 'No title'}
                </Link>
              </li>
            ))}
          </ul>
          {articlesTotalPages > 1 && (
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <button
                onClick={() => handleArticlePageChange(articlesCurrentPage - 1)}
                disabled={articlesCurrentPage === 1 || isLoadingArticles}
                style={{marginRight: '10px'}}
              >
                Previous Articles
              </button>
              <span>Page {articlesCurrentPage} of {articlesTotalPages}</span>
              <button
                onClick={() => handleArticlePageChange(articlesCurrentPage + 1)}
                disabled={articlesCurrentPage === articlesTotalPages || isLoadingArticles}
                style={{marginLeft: '10px'}}
              >
                Next Articles
              </button>
            </div>
          )}
        </>
      ) : (
        <p>No articles found for this legislation.</p>
      )}
    </div>
  );
};

export default LegislationViewPage;
