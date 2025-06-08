import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import GlobalSearchPage from './pages/GlobalSearchPage';
import LegislationViewPage from './pages/LegislationViewPage';
import ArticleViewPage from './pages/ArticleViewPage';
import CaseLawViewPage from './pages/CaseLawViewPage';
import ReportBuilderPage from './pages/ReportBuilderPage';
import './App.css'; // Another basic CSS file

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<GlobalSearchPage />} />
        <Route path="legislations/:id" element={<LegislationViewPage />} />
        <Route path="articles/:id" element={<ArticleViewPage />} />
        <Route path="case-laws/:id" element={<CaseLawViewPage />} />
        <Route path="reports" element={<ReportBuilderPage />} />
        {/* Add other routes here as needed */}
      </Route>
    </Routes>
  );
}

export default App;
