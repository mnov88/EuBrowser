import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { searchGlobal } from '../services/api';
import ResultCard from '../components/ResultCard';

const ITEMS_PER_PAGE = 10; // Or get from backend if it's configurable there

const GlobalSearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page'), 10) || 1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);

  const performSearch = useCallback(async (currentQuery, page) => {
    if (!currentQuery.trim()) {
      setResults([]);
      setTotalPages(0);
      setTotalResults(0);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Update URL params before fetching
      setSearchParams({ q: currentQuery, page: page.toString() }, { replace: true });

      const response = await searchGlobal(currentQuery, page, ITEMS_PER_PAGE);
      setResults(response.data || []);
      setTotalPages(response.pagination?.totalPages || 0);
      setTotalResults(response.pagination?.totalCount || 0);
      setCurrentPage(response.pagination?.page || page);
      if (!response.data || response.data.length === 0) {
        setError('No results found.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch search results.');
      setResults([]);
      setTotalPages(0);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  }, [setSearchParams]);

  // Effect to perform search when 'q' or 'page' in URL changes
  useEffect(() => {
    const currentQueryFromUrl = searchParams.get('q');
    const currentPageFromUrl = parseInt(searchParams.get('page'), 10) || 1;

    if (currentQueryFromUrl) {
      setQuery(currentQueryFromUrl);
      setSearchTerm(currentQueryFromUrl); // Keep track of the term that fetched current results
      setCurrentPage(currentPageFromUrl);
      performSearch(currentQueryFromUrl, currentPageFromUrl);
    } else {
      // Clear results if no query
      setResults([]);
      setTotalPages(0);
      setTotalResults(0);
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Rerun when searchParams object itself changes

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setCurrentPage(1); // Reset to first page for new search term
      setSearchTerm(query);
      // This will trigger the useEffect due to searchParams change
      setSearchParams({ q: query, page: '1' });
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // This will trigger the useEffect due to searchParams change
      setSearchParams({ q: searchTerm, page: newPage.toString() });
    }
  };

  return (
    <div>
      <h2>Global Search</h2>
      <form onSubmit={handleSearchSubmit} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search across all content..."
          style={{ width: '70%', padding: '10px', marginRight: '10px' }}
        />
        <button type="submit" disabled={isLoading} style={{ padding: '10px 15px' }}>
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {isLoading && <p>Loading results...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {!isLoading && !error && searchTerm && totalResults > 0 && (
        <p>Showing {results.length} of {totalResults} results for "<strong>{searchTerm}</strong>"</p>
      )}

      <div>
        {results.map((item) => (
          <ResultCard key={`${item.content_type}-${item.id}`} item={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            style={{marginRight: '10px'}}
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            style={{marginLeft: '10px'}}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default GlobalSearchPage;
