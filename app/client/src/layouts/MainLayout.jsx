import React from 'react';
import { Outlet, Link } from 'react-router-dom';

const MainLayout = () => {
  return (
    <div>
      <header>
        <h1>EU Law Platform</h1>
        <div className="search-bar-placeholder">Persistent Search Bar Placeholder</div>
        <nav>
          <Link to="/">Home</Link> | <Link to="/search">Global Search</Link> | <Link to="/reports">Report Builder</Link>
          {/* Example links to detail pages (normally generated dynamically) */}
          | <Link to="/legislations/123">Legislation (123)</Link>
          | <Link to="/articles/456">Article (456)</Link>
          | <Link to="/case-laws/789">Case Law (789)</Link>
        </nav>
      </header>
      <main>
        <div className="breadcrumb-placeholder">Breadcrumb Placeholder</div>
        <div className="page-content">
          <Outlet /> {/* This is where routed components will render */}
        </div>
      </main>
      <footer>
        <p>© EU Law Platform {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default MainLayout;
