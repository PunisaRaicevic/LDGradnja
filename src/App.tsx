import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
