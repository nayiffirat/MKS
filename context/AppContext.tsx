import React, { createContext, useContext, useEffect, useState } from 'react';
import { dbService } from '../services/db';
import { Farmer } from '../types';

interface DashboardStats {
  totalFarmers: number;
  todayPrescriptions: number;
  pendingVisits: number;
}

interface AppContextType {
  stats: DashboardStats;
  refreshStats: () => Promise<void>;
  addFarmer: (farmer: Omit<Farmer, 'id'>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalFarmers: 0,
    todayPrescriptions: 0,
    pendingVisits: 0
  });

  const refreshStats = async () => {
    const farmers = await dbService.getFarmers();
    const prescriptions = await dbService.getAllPrescriptions();
    const visits = await dbService.getAllVisits();

    // Calculate "Today"
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysPrescriptionsCount = prescriptions.filter(p => p.date.startsWith(todayStr)).length;
    
    // Logic for "Pending Visits" (Mock: random or specific logic)
    // For now, let's say visits in the last 2 days are "recent"
    const recentVisitsCount = visits.length;

    setStats({
      totalFarmers: farmers.length,
      todayPrescriptions: todaysPrescriptionsCount,
      pendingVisits: recentVisitsCount
    });
  };

  const addFarmer = async (farmerData: Omit<Farmer, 'id'>) => {
    const newFarmer: Farmer = {
      ...farmerData,
      id: crypto.randomUUID()
    };
    await dbService.addFarmer(newFarmer);
    await refreshStats();
  };

  useEffect(() => {
    refreshStats();
  }, []);

  return (
    <AppContext.Provider value={{ stats, refreshStats, addFarmer }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppViewModel = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppViewModel must be used within AppProvider');
  return context;
};