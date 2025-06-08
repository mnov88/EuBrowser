import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GlobalSearchPage from './GlobalSearchPage'; // Adjust path as necessary
import * as api from '../services/api'; // To mock searchGlobal

// Mock the api module
jest.mock('../services/api');

// Mock react-router-dom's useSearchParams and useNavigate
// It's often easier to test components that use these by wrapping them in MemoryRouter
// and controlling the initialEntries and inspecting navigation changes if needed.
// For useSearchParams, we can provide initial search params via MemoryRouter's initialEntries.
// The component's internal setSearchParams will update its own state and URL within MemoryRouter.

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'), // use actual for all components like Link, MemoryRouter
  useNavigate: () => mockNavigate,
  // useSearchParams will be implicitly tested by MemoryRouter's effect on location.search
}));


const renderWithRouter = (ui, { route = '/search', initialEntries = [route] } = {}) => {
  window.history.pushState({}, 'Test page', route); // Set initial URL for useSearchParams
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/search" element={ui} />
        {/* Add other routes if your component links to them and you want to test navigation clicks */}
      </Routes>
    </MemoryRouter>
  );
};


describe('GlobalSearchPage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    api.searchGlobal.mockReset();
    mockNavigate.mockReset();
  });

  test('renders search input and button initially', () => {
    renderWithRouter(<GlobalSearchPage />);
    expect(screen.getByPlaceholderText(/search across all content/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  test('user input updates search field, and submitting calls API', async () => {
    api.searchGlobal.mockResolvedValue({ data: [], pagination: { totalPages: 0, totalCount: 0, page: 1 } });
    renderWithRouter(<GlobalSearchPage />);

    const searchInput = screen.getByPlaceholderText(/search across all content/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    await userEvent.type(searchInput, 'test query');
    expect(searchInput).toHaveValue('test query');

    await userEvent.click(searchButton);

    expect(api.searchGlobal).toHaveBeenCalledTimes(1);
    expect(api.searchGlobal).toHaveBeenCalledWith('test query', 1, 10); // query, page, limit
  });

  test('displays search results when API returns data', async () => {
    const mockResults = {
      data: [
        { content_type: 'legislation', id: 1, title: 'Legislation Title 1', text_snippet: 'Snippet 1' },
        { content_type: 'article', id: 2, title: 'Article Title 2', article_number_text: 'Art. 1', text_snippet: 'Snippet 2' },
      ],
      pagination: { totalPages: 1, totalCount: 2, page: 1 },
    };
    api.searchGlobal.mockResolvedValue(mockResults);

    renderWithRouter(<GlobalSearchPage />);

    const searchInput = screen.getByPlaceholderText(/search across all content/i);
    await userEvent.type(searchInput, 'find these');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    // Wait for results to appear (ResultCard titles/snippets)
    expect(await screen.findByText(/Legislation Title 1/i)).toBeInTheDocument();
    expect(await screen.findByText(/Snippet 1/i)).toBeInTheDocument();
    expect(await screen.findByText(/Article Title 2/i)).toBeInTheDocument(); // Or how ResultCard formats it
    expect(await screen.findByText(/Snippet 2/i)).toBeInTheDocument();
    expect(screen.getByText(/showing 2 of 2 results for "find these"/i)).toBeInTheDocument();
  });

  test('displays loading state while fetching results', async () => {
    api.searchGlobal.mockReturnValue(new Promise(() => {})); // Promise that never resolves for loading state

    renderWithRouter(<GlobalSearchPage />);

    await userEvent.type(screen.getByPlaceholderText(/search across all content/i), 'loading test');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(screen.getByText(/loading results\.\.\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /searching\.\.\./i})).toBeDisabled();
  });

  test('displays error message when API call fails', async () => {
    api.searchGlobal.mockRejectedValue(new Error('API Error: Something went wrong'));
    renderWithRouter(<GlobalSearchPage />);

    await userEvent.type(screen.getByPlaceholderText(/search across all content/i), 'error test');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(await screen.findByText(/error: API Error: Something went wrong/i)).toBeInTheDocument();
  });

  test('displays "No results found" message for empty results', async () => {
    api.searchGlobal.mockResolvedValue({ data: [], pagination: { totalPages: 0, totalCount: 0, page: 1 } });
    renderWithRouter(<GlobalSearchPage />);

    await userEvent.type(screen.getByPlaceholderText(/search across all content/i), 'no results test');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    // The error state is used for "No results found" in the current implementation
    expect(await screen.findByText(/error: No results found/i)).toBeInTheDocument();
    // Also check that the "showing X of Y results" message is not there
    expect(screen.queryByText(/showing 0 of 0 results/i)).not.toBeInTheDocument();
  });

  test('pagination controls appear and function correctly', async () => {
    const initialResults = {
      data: Array(10).fill(null).map((_, i) => ({ content_type: 'article', id: i, title: `Article ${i+1}`, text_snippet: `Snippet ${i+1}` })),
      pagination: { totalPages: 3, totalCount: 30, page: 1 },
    };
    api.searchGlobal.mockResolvedValue(initialResults);
    renderWithRouter(<GlobalSearchPage />);

    await userEvent.type(screen.getByPlaceholderText(/search across all content/i), 'pagination test');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeEnabled();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();

    // Mock response for page 2
    const page2Results = {
      data: Array(10).fill(null).map((_, i) => ({ content_type: 'article', id: i + 10, title: `Article ${i+11}`, text_snippet: `Snippet ${i+11}` })),
      pagination: { totalPages: 3, totalCount: 30, page: 2 },
    };
    api.searchGlobal.mockResolvedValueOnce(page2Results); // For the next call

    await userEvent.click(nextButton);

    expect(api.searchGlobal).toHaveBeenCalledWith('pagination test', 2, 10); // page 2
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeEnabled();
  });

  test('performs search automatically if "q" URL parameter is present on load', async () => {
    api.searchGlobal.mockResolvedValue({ data: [], pagination: { totalPages: 0, totalCount: 0, page: 1 } });

    renderWithRouter(<GlobalSearchPage />, { route: '/search?q=initialQuery&page=1' });

    // Wait for API call triggered by useEffect
    await waitFor(() => {
      expect(api.searchGlobal).toHaveBeenCalledTimes(1);
    });
    expect(api.searchGlobal).toHaveBeenCalledWith('initialQuery', 1, 10);
    expect(screen.getByPlaceholderText(/search across all content/i)).toHaveValue('initialQuery');
  });

});
