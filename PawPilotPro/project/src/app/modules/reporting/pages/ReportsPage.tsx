import React from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ChartBar, PawPrint, UsersThree, CalendarCheck, Stack, ArrowRight, ShieldSlash } from '@phosphor-icons/react';
import {
  REPORT_DEFINITIONS,
  REPORT_CATEGORY_LABELS,
  REPORT_CATEGORY_COLOURS,
  type ReportDefinition,
  type ReportCategory,
} from '../types';

const CATEGORY_ICONS: Record<ReportCategory, React.ElementType> = {
  pets: PawPrint,
  customers: UsersThree,
  daycare: CalendarCheck,
  services: Stack,
};

function canAccess(report: ReportDefinition, role: string): boolean {
  return report.requiredRole.includes(role as any);
}

export function ReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || 'staff';

  const categories = Array.from(new Set(REPORT_DEFINITIONS.map((r) => r.category))) as ReportCategory[];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-blue-100 rounded-xl">
            <ChartBar className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
            <p className="text-slate-500 text-sm">Operational and commercial insights powered by live data</p>
          </div>
        </div>

        {(role === 'staff' || role === 'assistant_manager') && (
          <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            <ShieldSlash className="h-4 w-4 flex-shrink-0" />
            Some reports require Manager or Admin access. Contact your administrator to request access.
          </div>
        )}
      </div>

      {/* Report Groups */}
      {categories.map((category) => {
        const reports = REPORT_DEFINITIONS.filter((r) => r.category === category);
        const Icon = CATEGORY_ICONS[category];

        return (
          <div key={category} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Icon className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-800">
                {REPORT_CATEGORY_LABELS[category]}
              </h2>
              <span className="text-xs text-slate-400 font-normal">({reports.length} reports)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.map((report) => {
                const accessible = canAccess(report, role);
                return (
                  <Card
                    key={report.id}
                    className={`relative transition-shadow ${accessible ? 'hover:shadow-md cursor-pointer' : 'opacity-60'}`}
                    onClick={accessible ? () => navigate(`/reports/${report.id}`) : undefined}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-semibold text-slate-900">
                          {report.title}
                        </CardTitle>
                        <Badge className={`text-xs shrink-0 ${REPORT_CATEGORY_COLOURS[report.category]}`}>
                          {REPORT_CATEGORY_LABELS[report.category]}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm text-slate-500 mt-1 leading-relaxed">
                        {report.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {report.tags?.map((tag) => (
                            <span key={tag} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                              {tag}
                            </span>
                          ))}
                          {report.requiresDateRange && (
                            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                              Date range
                            </span>
                          )}
                          {!accessible && (
                            <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full">
                              Restricted
                            </span>
                          )}
                        </div>
                        {accessible && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 shrink-0"
                            onClick={(e) => { e.stopPropagation(); navigate(`/reports/${report.id}`); }}
                          >
                            Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
