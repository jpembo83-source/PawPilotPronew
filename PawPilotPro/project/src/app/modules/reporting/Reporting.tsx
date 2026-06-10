import React from 'react';
import { Routes, Route } from 'react-router';
import { ReportsPage } from './pages/ReportsPage';
import { ReportViewerPage } from './pages/ReportViewerPage';

export function Reporting() {
  return (
    <Routes>
      <Route index element={<ReportsPage />} />
      <Route path=":reportId" element={<ReportViewerPage />} />
    </Routes>
  );
}
