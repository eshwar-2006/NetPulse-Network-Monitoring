import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { TargetsPage } from './pages/TargetsPage';
import { LiveProbePage } from './pages/LiveProbePage';
import { AnomaliesPage } from './pages/AnomaliesPage';
import { ForecastPage } from './pages/ForecastPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { OperationsPage } from './pages/OperationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { api } from './api/client';

const AppLayout: React.FC = () => {
  const [anomalyCount, setAnomalyCount] = useState<number>(0);
  const [incidentCount, setIncidentCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const fetchBadgeCounts = async () => {
    try {
      const summary = await api.getDashboardSummary();
      setAnomalyCount(summary.active_anomalies);
      setIncidentCount(summary.open_incidents);
    } catch (e) {
      // quiet fail on transient network disconnect
    }
  };

  useEffect(() => {
    fetchBadgeCounts();
    const interval = setInterval(fetchBadgeCounts, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      const targets = await api.getTargets();
      // Check first 3 targets to quickly trigger fresh probes
      for (const t of targets.slice(0, 3)) {
        await api.checkTargetNow(t.id).catch(() => {});
      }
      await fetchBadgeCounts();
      setRefreshKey((k) => k + 1);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col antialiased">
      <Header onRefreshAll={handleRefreshAll} isRefreshing={isRefreshing} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar anomalyCount={anomalyCount} incidentCount={incidentCount} />
        <main className="flex-1 overflow-y-auto" key={refreshKey}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/targets" element={<TargetsPage />} />
            <Route path="/probes" element={<LiveProbePage />} />
            <Route path="/anomalies" element={<AnomaliesPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}
