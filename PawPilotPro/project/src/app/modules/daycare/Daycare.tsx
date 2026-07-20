// Daycare Module Router - MDC Operations Centre

import React from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { DaycareDashboard } from './pages/DaycareDashboard';
import { DaycareCheckIn } from './pages/DaycareCheckIn';
import { DaycareCheckOut } from './pages/DaycareCheckOut';
import { DaycareAttendance } from './pages/DaycareAttendance';
import { DaycareBookings } from './pages/DaycareBookings';
import { DaycarePhotoReview } from './pages/DaycarePhotoReview';
import { DaycarePhotoUpload } from './pages/DaycarePhotoUpload';
import { DaycarePaperImport } from './pages/DaycarePaperImport';

export function Daycare() {
  return (
    <Routes>
      <Route index element={<DaycareDashboard />} />
      <Route path="check-in" element={<DaycareCheckIn />} />
      <Route path="check-out" element={<DaycareCheckOut />} />
      <Route path="attendance" element={<DaycareAttendance />} />
      <Route path="bookings" element={<DaycareBookings />} />
      <Route path="photo-review" element={<DaycarePhotoReview />} />
      <Route path="photo-upload" element={<DaycarePhotoUpload />} />
      <Route path="paper-import" element={<DaycarePaperImport />} />
      <Route path="*" element={<Navigate to="/daycare" replace />} />
    </Routes>
  );
}