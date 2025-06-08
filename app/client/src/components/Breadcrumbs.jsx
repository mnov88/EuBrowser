import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';

// Helper to get stored title for a path segment (e.g., an ID)
const getStoredTitleForPath = (path) => {
  try {
    return sessionStorage.getItem(`breadcrumb_title_${path}`);
  } catch (e) {
    // sessionStorage might not be available (e.g., in SSR or if disabled)
    console.warn("sessionStorage access failed for breadcrumbs:", e);
    return null;
  }
};


const Breadcrumbs = () => {
  const location = useLocation();
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  useEffect(() => {
    const pathnames = location.pathname.split('/').filter(x => x);
    const newBreadcrumbs = [];

    newBreadcrumbs.push({ name: 'Home', path: '/' });

    let currentPath = '';
    const builtBreadcrumbs = pathnames.map((segment, index) => {
      currentPath += `/${segment}`;
      const isLastSegment = index === pathnames.length - 1;

      let nameForCrumb = segment.charAt(0).toUpperCase() + segment.slice(1); // Default capitalization

      // Specific path names
      if (currentPath === '/search') nameForCrumb = 'Search';
      else if (currentPath === '/reports') nameForCrumb = 'Reports';
      else if (currentPath === '/legislations') nameForCrumb = 'Legislations';
      else if (currentPath === '/articles') nameForCrumb = 'Articles';
      else if (currentPath === '/case-laws') nameForCrumb = 'Case Laws';
      // Add more specific names for static parent paths if needed

      // For dynamic segments (IDs), try to use stored title
      const storedTitle = getStoredTitleForPath(currentPath);
      if (storedTitle) {
        nameForCrumb = storedTitle;
      } else {
        // If it's an ID segment and no stored title, keep the ID as nameForCrumb (already capitalized or as is)
        // The previous segment tells us the type.
        const prevSegmentType = pathnames[index-1]?.toLowerCase();
        if (['legislations', 'articles', 'case-laws'].includes(prevSegmentType)) {
            nameForCrumb = segment; // Use the ID itself if no title from session storage
        }
      }
      return { name: nameForCrumb, path: currentPath };
    });

    setBreadcrumbs([ { name: 'Home', path: '/' }, ...builtBreadcrumbs ]);
  }, [location.pathname]);

  if (breadcrumbs.length <= 1 && location.pathname === '/') { // Only "Home" on home page, or no breadcrumbs
    return null;
  }

  return (
    <nav aria-label="breadcrumb" style={{ marginBottom: '20px', padding: '10px', borderBottom: '1px solid #eee' }}>
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        return (
          <span key={crumb.path}>
            {isLast ? (
              <span style={{color: '#555'}}>{crumb.name}</span>
            ) : (
              <Link to={crumb.path} style={{textDecoration: 'none', color: '#007bff'}}>{crumb.name}</Link>
            )}
            {!isLast && <span style={{ margin: '0 8px' }}>&gt;</span>}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;

// Helper function to be used in page components (e.g., LegislationViewPage)
export const setBreadcrumbTitle = (path, title) => {
  try {
    sessionStorage.setItem(`breadcrumb_title_${path}`, title);
  } catch (e) {
    console.warn("sessionStorage access failed for breadcrumbs:", e);
  }
};

// Helper function to clear a breadcrumb title (optional, e.g. on component unmount)
export const clearBreadcrumbTitle = (path) => {
 sessionStorage.removeItem(`breadcrumb_title_${path}`);
};
