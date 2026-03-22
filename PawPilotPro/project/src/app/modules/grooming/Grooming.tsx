import React from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { GroomingDashboard } from './pages/GroomingDashboard';
import { GroomingAppointments } from './pages/GroomingAppointments';
import { NewGroomingAppointment } from './pages/NewGroomingAppointment';
import { GroomingAppointmentDetail } from './pages/GroomingAppointmentDetail';
import { GroomingCheckIn } from './pages/GroomingCheckIn';

export function Grooming() {
  return (
    <Routes>
      <Route index element={<GroomingDashboard />} />
      <Route path="appointments" element={<GroomingAppointments />} />
      <Route path="appointments/new" element={<NewGroomingAppointment />} />
      <Route path="appointments/:id" element={<GroomingAppointmentDetail />} />
      <Route path="check-in/:id" element={<GroomingCheckIn />} />
      <Route path="queue" element={<GroomingDashboard />} />
      <Route path="*" element={<Navigate to="/grooming" replace />} />
    </Routes>
  );
}
