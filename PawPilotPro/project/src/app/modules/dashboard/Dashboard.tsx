import React, { useState } from 'react';
import { DashboardHeader } from './components/DashboardHeader';
import { WidgetGrid } from './components/WidgetGrid';
import { PoliciesAlertBanner } from './components/PoliciesAlertBanner';
import { QuickActionsBar } from './components/QuickActionsBar';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useRealtimeDashboard } from '../../hooks/useRealtimeDashboard';

export function Dashboard() {
  const [isCustomizing, setIsCustomizing] = useState(false);
  useRealtimeDashboard();

  return (
    <div className="min-h-full flex flex-col bg-background">
      <DashboardHeader 
        isCustomizing={isCustomizing} 
        setIsCustomizing={setIsCustomizing} 
      />
      
      <main className="flex-1 px-4 py-5 md:px-6 md:py-6 w-full">
        <PoliciesAlertBanner />
        <QuickActionsBar />
        
        <DndProvider backend={HTML5Backend}>
          <WidgetGrid isCustomizing={isCustomizing} />
        </DndProvider>
      </main>
    </div>
  );
}
