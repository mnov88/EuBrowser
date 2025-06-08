import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api', // This will be proxied by Vite dev server to the backend
  headers: {
    'Content-Type': 'application/json',
  },
});

// Example function (can be expanded)
export const searchGlobal = async (query, page = 1, limit = 10) => { // Default limit to 10 for frontend
  try {
    const response = await apiClient.get('/search', {
      params: {
        query_string: query,
        page: page,
        limit: limit,
      },
    });
    // The backend is expected to return data in the shape: { data: items[], pagination: { totalCount, totalPages, ...} }
    return response.data;
  } catch (error) {
    console.error('Error during global search:', error);
    // Rethrow or handle error as appropriate for your app's error handling strategy
    throw error;
  }
};

export const getAllLegislations = async () => {
  // This might need to handle pagination if the number of legislations is very large.
  // For now, assume a single request or a request with a large limit.
  // Example: Fetching with a limit of 1000, assuming this covers most cases for a dropdown.
  try {
    const response = await apiClient.get('/legislations', { params: { limit: 1000, page: 1 } });
    // The backend for /legislations returns { data: items[], pagination: {...} }
    return response.data.data; // Return just the array of legislations
  } catch (error) {
    console.error('Error fetching all legislations:', error);
    throw error;
  }
};

export const getCaseLawById = async (id) => {
  try {
    const response = await apiClient.get(`/case_laws/${id}`);
    return response.data; // Expects a single case law object
  } catch (error) {
    console.error(`Error fetching case law with id ${id}:`, error);
    throw error;
  }
};

export const getOperativePartsByCaseLawId = async (caseLawId, page = 1, limit = 10) => {
  try {
    const response = await apiClient.get('/operative_parts', {
      params: {
        case_law_id: caseLawId,
        page: page,
        limit: limit,
        // The backend for GET /operative_parts should sort by part_number when case_law_id is provided
      },
    });
    // Expects backend to return { data: items[], pagination: { ... } }
    return response.data;
  } catch (error) {
    console.error(`Error fetching operative parts for case law id ${caseLawId}:`, error);
    throw error;
  }
};

export const getLegislationById = async (id) => {
  try {
    const response = await apiClient.get(`/legislations/${id}`);
    return response.data; // Expects a single legislation object
  } catch (error) {
    console.error(`Error fetching legislation with id ${id}:`, error);
    throw error;
  }
};

export const getArticlesByLegislationId = async (legislationId, page = 1, limit = 20) => {
  try {
    const response = await apiClient.get('/articles', {
      params: {
        legislation_id: legislationId,
        page: page,
        limit: limit,
      },
    });
    // Expects backend to return { data: items[], pagination: { ... } }
    return response.data;
  } catch (error) {
    console.error(`Error fetching articles for legislation id ${legislationId}:`, error);
    throw error;
  }
};

export const getArticleById = async (id) => {
  try {
    const response = await apiClient.get(`/articles/${id}`);
    // Expected to return article data, including legislation_id
    return response.data;
  } catch (error) {
    console.error(`Error fetching article with id ${id}:`, error);
    throw error;
  }
};

export const getCaseLawsInterpretingArticle = async (articleId, page = 1, limit = 10) => {
  try {
    const response = await apiClient.get('/case_law_interprets_article', {
      params: {
        article_id: articleId,
        page: page,
        limit: limit,
      },
    });
    // Assuming backend returns { data: items[], pagination: { ... } }
    // And items contain { id (junction_id), case_law_id, article_id, case_law: { id, title, celex_number } ... }
    return response.data;
  } catch (error) {
    console.error(`Error fetching case laws interpreting article ${articleId}:`, error);
    throw error;
  }
};

export const getOperativePartsInterpretingArticle = async (articleId, page = 1, limit = 10) => {
  try {
    const response = await apiClient.get('/operative_part_interprets_article', {
      params: {
        article_id: articleId,
        page: page,
        limit: limit,
      },
    });
    // Assuming backend returns { data: items[], pagination: { ... } }
    // And items contain { id (junction_id), operative_part_id, article_id, operative_part: { id, part_number, case_law_id, case_law: { celex_number } } ... }
    return response.data;
  } catch (error) {
    console.error(`Error fetching operative parts interpreting article ${articleId}:`, error);
    throw error;
  }
};

// Add other API functions here as needed for legislations, articles, etc.

export default apiClient;
