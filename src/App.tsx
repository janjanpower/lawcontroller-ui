import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/MainLayout';
import CaseOverview from './pages/CaseOverview';
import ClosedCases from './pages/ClosedCases';
import CustomerData from './pages/CustomerData';
import UserManagement from './pages/UserManagement';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cases" element={<MainLayout><CaseOverview /></MainLayout>} />
        <Route path="/closed-cases" element={<MainLayout><ClosedCases /></MainLayout>} />
        <Route path="/customers" element={<MainLayout><CustomerData /></MainLayout>} />
        <Route path="/users" element={<MainLayout><UserManagement /></MainLayout>} />
        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}
