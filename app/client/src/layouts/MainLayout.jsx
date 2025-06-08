import React, { useState, useEffect } from 'react'; // Import useState, useEffect
import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'; // Import useNavigate, useLocation, useSearchParams
import Breadcrumbs from '../components/Breadcrumbs';
import RelatedItemsSidebar from '../components/RelatedItemsSidebar';

const MainLayout = () => {
  const [sidebarData, setSidebarData] = useState(null);
  const [persistentQuery, setPersistentQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams(); // To read URL query params

  // Effect to sync persistentQuery with URL if on /search page
  useEffect(() => {
    if (location.pathname === '/search') {
      const queryFromUrl = searchParams.get('q');
      if (queryFromUrl !== null) { // Check if q param exists
        setPersistentQuery(queryFromUrl);
      } else {
        // If on /search but no q param, maybe clear persistent bar or leave as is
        // For now, let's clear it if user navigates to /search without a query
        setPersistentQuery('');
      }
    }
    // No else needed, persistentQuery should retain its value on other pages unless a new search is made
  }, [location.pathname, searchParams]);


  const handlePersistentSearchSubmit = (e) => {
    e.preventDefault();
    if (persistentQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(persistentQuery.trim())}`);
      // Optional: Clear input after submit, but two-way sync will update it if navigating to /search
      // If not navigating to /search immediately (e.g. if already on /search and query changes),
      // then GlobalSearchPage's own logic will handle re-search.
      // The useEffect above will sync the bar if the path becomes /search.
    }
  };

  return (
    <div className="main-layout">
      <header style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <h1>EU Law Platform</h1>
        <form onSubmit={handlePersistentSearchSubmit} style={{ margin: '1rem 0', display: 'flex', justifyContent: 'center' }}>
          <input
            type="search"
            placeholder="Search all content..."
            value={persistentQuery}
            onChange={(e) => setPersistentQuery(e.target.value)}
            style={{ width: '60%', maxWidth: '500px', padding: '8px 12px', marginRight: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <button type="submit" style={{ padding: '8px 15px', border: '1px solid #007bff', backgroundColor: '#007bff', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Search</button>
        </form>
        <nav style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
          <Link to="/">Home</Link> | <Link to="/search">Global Search</Link> | <Link to="/reports">Report Builder</Link>
          {/* Example links to detail pages (normally generated dynamically) */}
          | <Link to="/legislations/123">Legislation (123)</Link>
          | <Link to="/articles/456">Article (456)</Link>
          | <Link to="/case-laws/789">Case Law (789)</Link>
        </nav>
        <Breadcrumbs /> {/* Breadcrumbs now part of the consistent header area */}
      </header>
      <div className="content-wrapper" style={{ display: 'flex' }}>
        <main style={{ flexGrow: 1, padding: '1rem' }}>
          {/* Pass setSidebarData to child routes via Outlet's context prop */}
          <Outlet context={{ setSidebarData }} />
        </main>
        <aside style={{ width: '280px', minWidth: '220px', padding: '1rem', borderLeft: '1px solid #ccc', backgroundColor: '#f9f9f9' }}>
          {/* Pass sidebarData to the RelatedItemsSidebar */}
          <RelatedItemsSidebar data={sidebarData} />
        </aside>
      </div>
      <footer style={{ padding: '1rem', borderTop: '1px solid #ccc', textAlign: 'center', marginTop: '2rem' }}>
        <p>© EU Law Platform {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default MainLayout;
