import React, { useState } from 'react';
import { ViewState } from './types';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Farmers } from './components/Farmers';
import { Pesticides } from './components/Pesticides';
import { PrescriptionForm } from './components/Prescription';
import { VisitLogForm } from './components/Visits';
import { NewsScreen } from './components/News';
import { AppProvider } from './context/AppContext';

function MainApp() {
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [prescriptionFarmerId, setPrescriptionFarmerId] = useState<string | undefined>(undefined);
  const [isPrescriptionMode, setIsPrescriptionMode] = useState(false);
  const [isVisitMode, setIsVisitMode] = useState(false);

  const handleNavigate = (view: string) => {
    setIsPrescriptionMode(false);
    setIsVisitMode(false);
    setPrescriptionFarmerId(undefined);

    if (view === 'PRESCRIPTION_NEW') {
        setIsPrescriptionMode(true);
        setCurrentView('PRESCRIPTIONS' as ViewState);
    } else if (view === 'VISIT_NEW') {
        setIsVisitMode(true);
        setCurrentView('VISITS' as ViewState);
    } else {
        setCurrentView(view as ViewState);
    }
  };

  const handleStartPrescription = (farmerId: string) => {
      setPrescriptionFarmerId(farmerId);
      setIsPrescriptionMode(true);
      setCurrentView('PRESCRIPTIONS' as ViewState);
  };

  const renderContent = () => {
    if (isPrescriptionMode) {
        return <PrescriptionForm onBack={() => handleNavigate('DASHBOARD')} initialFarmerId={prescriptionFarmerId} />;
    }
    if (currentView === 'VISITS' && isVisitMode) { // Logic check
        return <VisitLogForm onBack={() => handleNavigate('DASHBOARD')} />;
    }

    switch (currentView) {
        case 'DASHBOARD':
            return <Dashboard onNavigate={handleNavigate} />;
        case 'FARMERS':
            return <Farmers onBack={() => handleNavigate('DASHBOARD')} onNavigateToPrescription={handleStartPrescription} />;
        case 'PESTICIDES':
            return <Pesticides />;
        case 'PRESCRIPTIONS':
             // If navigating from sidebar, show empty form or list (For MVP we show form)
            return <PrescriptionForm onBack={() => handleNavigate('DASHBOARD')} />;
        case 'VISITS':
            return <VisitLogForm onBack={() => handleNavigate('DASHBOARD')} />;
        case 'NEWS':
            return <NewsScreen onBackToDashboard={() => handleNavigate('DASHBOARD')} />;
        default:
            return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={(v) => handleNavigate(v)}>
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  )
}