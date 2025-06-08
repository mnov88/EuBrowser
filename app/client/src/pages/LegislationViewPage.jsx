import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLegislationById, getArticlesByLegislationId } from '../services/api';
import { marked } from 'marked'; // For rendering Markdown

const ARTICLES_PER_PAGE = 20;

const LegislationViewPage = () => {
  const { id: legislationId } = useParams(); // Get legislation ID from route

  const [legislation, setLegislation] = useState(null);
  const [articles, setArticles] = useState([]);
  const [isLoadingLegislation, setIsLoadingLegislation] = useState(true);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [errorLegislation, setErrorLegislation] = useState(null);
  const [errorArticles, setErrorArticles] = useState(null);

  const [articlesCurrentPage, setArticlesCurrentPage] = useState(1);
  const [articlesTotalPages, setArticlesTotalPages] = useState(0);

  // Fetch legislation details
  useEffect(() => {
    const fetchLegislation = async () => {
      setIsLoadingLegislation(true);
      setErrorLegislation(null);
      try {
        const data = await getLegislationById(legislationId);
        setLegislation(data);
      } catch (err) {
        setErrorLegislation(err.response?.data?.error || err.message || `Failed to load legislation ${legislationId}.`);
        setLegislation(null);
      } finally {
        setIsLoadingLegislation(false);
      }
    };
    fetchLegislation();
  }, [legislationId]);

  // Fetch articles for the current legislation and page
  const fetchArticles = useCallback(async (page) => {
    setIsLoadingArticles(true);
    setErrorArticles(null);
    try {
      const response = await getArticlesByLegislationId(legislationId, page, ARTICLES_PER_PAGE);
      setArticles(response.data || []);
      setArticlesTotalPages(response.pagination?.totalPages || 0);
      setArticlesCurrentPage(response.pagination?.page || page);
      if(!response.data || response.data.length === 0) {
        // setErrorArticles("No articles found for this legislation."); // Or just let it be an empty list
      }
    } catch (err) {
      setErrorArticles(err.response?.data?.error || err.message || 'Failed to load articles.');
      setArticles([]);
      setArticlesTotalPages(0);
    } finally {
      setIsLoadingArticles(false);
    }
  }, [legislationId]);

  useEffect(() => {
    // Reset page to 1 when legislationId changes
    setArticlesCurrentPage(1);
    // Fetch articles will be triggered by the change in legislationId or articlesCurrentPage in the next effect
  }, [legislationId]);

  useEffect(() => {
    if (legislationId) { // Only fetch articles if legislationId is valid
        fetchArticles(articlesCurrentPage);
    }
  }, [legislationId, articlesCurrentPage, fetchArticles]);


  const handleArticlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= articlesTotalPages) {
      setArticlesCurrentPage(newPage);
      // The useEffect for articlesCurrentPage will trigger fetchArticles
    }
  };

  const renderMarkdown = (mdContent) => {
    if (!mdContent) return null;
    // For trusted content. If sanitization is needed, configure marked options.
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
      {/* Add other metadata as needed, e.g., dates */}
      <p><strong>Created At:</strong> {new Date(legislation.created_at).toLocaleDateString()}</p>
      <p><strong>Last Updated:</strong> {new Date(legislation.updated_at).toLocaleDateString()}</p>

      <h3 style={{marginTop: '30px'}}>Full Text Content</h3>
      {legislation.full_markdown_content ? (
        renderMarkdown(legislation.full_markdown_content)
      ) : (
        <p>No full text content available.</p>
      )}

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
