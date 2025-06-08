import React from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';

const RelatedItemsSidebar = ({ data }) => { // Accept data prop
  const location = useLocation();
  const params = useParams();
  const { id: entityId } = params;

  // Determine context from data prop first, then fallback to URL
  let context = data?.contextType || null;
  let contextTitle = data?.contextTitle || entityId;

  if (!context) {
    const pathname = location.pathname;
    if (pathname.startsWith('/legislations/') && entityId) {
      context = 'legislation_view';
    } else if (pathname.startsWith('/articles/') && entityId) {
      context = 'article_view';
    } else if (pathname.startsWith('/case-laws/') && entityId) {
      context = 'case_law_view';
    }
  }

  const renderPlaceholderSection = (title, items = []) => (
    <div style={{ marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
      <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '0.9em', color: '#333' }}>{title}</h4>
      {items.length > 0 ? (
        <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0, fontSize: '0.85em' }}>
          {items.map((item, index) => (
            <li key={index} style={{ marginBottom: '5px' }}>
              {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: '0.8em', color: '#777', fontStyle: 'italic' }}>
          List of related items... (API call needed or data to be passed).
        </p>
      )}
    </div>
  );

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.1em', borderBottom: '2px solid #007bff', paddingBottom: '5px' }}>Related Items</h3>

      {!context && <p style={{fontSize: '0.85em', color: '#555'}}>No specific context for related items.</p>}

      {context === 'legislation_view' && (
        <>
          {/* Assuming data.contextTitle would be legislation title if passed */}
          {renderPlaceholderSection(`Cases Interpreting Legislation: ${contextTitle}`)}
        </>
      )}

      {context === 'article_view' && (
        <>
          {renderPlaceholderSection(`Other Articles in this Legislation`)}
          {data?.relatedCaseLawsForArticle && data.relatedCaseLawsForArticle.length > 0 ?
            renderPlaceholderSection(`Cases Interpreting: ${contextTitle}`, data.relatedCaseLawsForArticle.map(cl => ({
              label: cl.title || cl.celex_number || `Case ID: ${cl.id}`,
              to: `/case-laws/${cl.id}`
            })))
            : renderPlaceholderSection(`Cases Interpreting: ${contextTitle}`)
          }
          {renderPlaceholderSection(`Operative Parts Interpreting: ${contextTitle}`)}
        </>
      )}

      {context === 'case_law_view' && (
        <>
          {data?.referencedArticlesForCaseLaw && data.referencedArticlesForCaseLaw.length > 0 ?
            renderPlaceholderSection(`Articles Referenced by: ${contextTitle}`, data.referencedArticlesForCaseLaw.map(art => ({
              label: art.article_number_text ? `${art.article_number_text}: ${art.title || ''}` : art.title || `Article ID: ${art.id}`,
              to: `/articles/${art.id}`
            })))
            : renderPlaceholderSection(`Articles Referenced by: ${contextTitle}`)
          }
          {renderPlaceholderSection(`Legislations Mentioned in Operative Parts of: ${contextTitle}`)}
        </>
      )}

      {/* Example of a more generic related item, could be based on tags, keywords etc. later */}
      {/* {renderPlaceholderSection("General Related Documents")} */}
    </div>
  );
};

export default RelatedItemsSidebar;
