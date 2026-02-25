import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Layout } from '@/components/layout/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import ProjectList from '@/pages/ProjectList';
import ProjectDetail from '@/pages/ProjectDetail';
import Drawings from '@/pages/Drawings';
import BillOfQuantities from '@/pages/BillOfQuantities';
import InterimSituations from '@/pages/InterimSituations';
import ConstructionDiary from '@/pages/ConstructionDiary';
import Expenses from '@/pages/Expenses';
import Contracts from '@/pages/Contracts';
import Tasks from '@/pages/Tasks';
import MaterialOrders from '@/pages/MaterialOrders';
import PhotoGallery from '@/pages/PhotoGallery';
import Users from '@/pages/Users';
import { Loader2 } from 'lucide-react';

function App() {
  const { user, initialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isElectron = !!(window as any).electronAPI?.isElectron;
  const Router = isElectron ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        {!user ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/:projectId" element={<ProjectDetail />}>
              <Route path="drawings" element={<Drawings />} />
              <Route path="bill" element={<BillOfQuantities />} />
              <Route path="situations" element={<InterimSituations />} />
              <Route path="diary" element={<ConstructionDiary />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="contracts" element={<Contracts />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="orders" element={<MaterialOrders />} />
              <Route path="photos" element={<PhotoGallery />} />
            </Route>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}

export default App;
