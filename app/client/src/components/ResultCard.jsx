import React from 'react';
import { Link } from 'react-router-dom';

const ResultCard = ({ item }) => {
  const {
    content_type,
    id,
    title: itemTitle, // Renamed to avoid conflict with component's own title if any
    text_snippet,
    celex_number, // Present for legislation, case_law, and joined for article, operative_part
    article_number_text, // For article
    case_law_id, // For operative_part
    part_number, // For operative_part
    simplified_text,
    is_simplified_available,
  } = item;

  let displayTitle = itemTitle;
  let linkTo = '/';

  switch (content_type) {
    case 'legislation':
      displayTitle = itemTitle || celex_number || 'Legislation';
      linkTo = `/legislations/${id}`;
      break;
    case 'article':
      displayTitle = itemTitle || `Article ${article_number_text || id}`;
      if (celex_number) {
        displayTitle += ` (of ${celex_number})`;
      }
      linkTo = `/articles/${id}`;
      break;
    case 'case_law':
      displayTitle = itemTitle || celex_number || 'Case Law';
      linkTo = `/case-laws/${id}`;
      break;
    case 'operative_part':
      const parentCaseCelex = celex_number || item.parent_celex_number; // from search.js logic
      displayTitle = `Part ${part_number} (of Case ${parentCaseCelex || case_law_id})`;
      linkTo = `/case-laws/${case_law_id}#op-${id}`; // Link to parent case law, hash to specific OP
      break;
    default:
      displayTitle = itemTitle || 'Result';
      linkTo = `/search?q=${encodeURIComponent(itemTitle || '')}`; // Fallback link
  }

  const getContentTypeBadge = (type) => {
    switch (type) {
      case 'legislation': return 'Legislation';
      case 'article': return 'Article';
      case 'case_law': return 'Case Law';
      case 'operative_part': return 'Operative Part';
      default: return 'Result';
    }
  };

  return (
    <div style={{ border: '1px solid #eee', padding: '15px', marginBottom: '15px', borderRadius: '5px', textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <Link to={linkTo} style={{ textDecoration: 'none', color: '#333' }}>
          <h4 style={{ margin: 0 }}>{displayTitle}</h4>
        </Link>
        <span style={{ backgroundColor: '#007bff', color: 'white', padding: '3px 7px', borderRadius: '3px', fontSize: '0.8em' }}>
          {getContentTypeBadge(content_type)}
        </span>
      </div>
      {text_snippet && (
        <p
          style={{ fontSize: '0.9em', color: '#555' }}
          dangerouslySetInnerHTML={{ __html: text_snippet }} // Assuming backend sends safe HTML
        />
      )}
      {content_type === 'operative_part' && (
        <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#f9f9f9', border: '1px solid #eee' }}>
          {is_simplified_available && simplified_text && (
            <>
              <p style={{ fontSize: '0.85em', fontWeight: 'bold', margin: '0 0 5px 0' }}>Simplified Text:</p>
              <p style={{ fontSize: '0.85em', margin: '0 0 5px 0' }}>{simplified_text}</p>
            </>
          )}
          <button disabled style={{fontSize: '0.8em', padding: '3px 5px'}}>
            Toggle Simplified/Verbatim (placeholder)
          </button>
        </div>
      )}
      {celex_number && (content_type === 'legislation' || content_type === 'case_law') && (
         <p style={{fontSize: '0.8em', color: '#777', marginTop: '5px'}}>CELEX: {celex_number}</p>
      )}
       {content_type === 'article' && article_number_text && (
         <p style={{fontSize: '0.8em', color: '#777', marginTop: '5px'}}>Article No: {article_number_text}</p>
      )}
    </div>
  );
};

export default ResultCard;
