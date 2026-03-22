// Packages Module - Routing and layout
import React from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { PackagesDashboard } from './pages/PackagesDashboard';

export function Packages() {
  return (
    <Routes>
      <Route index element={<PackagesDashboard />} />
      <Route path="*" element={<Navigate to="/packages" replace />} />
    </Routes>
  );
}

export default Packages;
