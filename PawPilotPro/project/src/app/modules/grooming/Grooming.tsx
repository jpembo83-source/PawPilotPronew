// Grooming Module Router - MDC Operations Centre

import React from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { GroomingDashboard } from './pages/GroomingDashboard';
import { GroomingAppointments } from './pages/GroomingAppointments';
import { NewGroomingAppointment } from './pages/NewGroomingAppointment';

export function Grooming() {
  return (
    <Routes>
      <Route index element={<GroomingDashboard />} />
      <Route path="new" element={<NewGroomingAppointment />} />
      <Route path="appointments" element={<GroomingAppointments />} />
      <Route path="appointments/:id" element={<GroomingAppointments />} />
      <Route path="queue" element={<GroomingDashboard />} />
      <Route path="check-in/:id" element={<GroomingAppointments />} />
      <Route path="*" element={<Navigate to="/grooming" replace />} />
    </Routes>
  );
}
