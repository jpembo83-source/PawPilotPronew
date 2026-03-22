import React from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { OvernightsPage } from './OvernightsPage';
import { OvernightCheckIn } from './OvernightCheckIn';
import { OvernightCheckOut } from './OvernightCheckOut';
import { OvernightPlanningBoard } from './OvernightPlanningBoard';
import { OvernightCareLogsPage } from './OvernightCareLogsPage';
import { OvernightCapacityPage } from './OvernightCapacityPage';
import { OvernightReservationsPage } from './OvernightReservationsPage';

export function Overnights() {
  return (
    <Routes>
      <Route index element={<OvernightsPage />} />
      <Route path="check-in" element={<OvernightCheckIn />} />
      <Route path="check-out" element={<OvernightCheckOut />} />
      <Route path="planning" element={<OvernightPlanningBoard />} />
      <Route path="care-logs" element={<OvernightCareLogsPage />} />
      <Route path="capacity" element={<OvernightCapacityPage />} />
      <Route path="reservations" element={<OvernightReservationsPage />} />
      <Route path="*" element={<Navigate to="/overnights" replace />} />
    </Routes>
  );
}
