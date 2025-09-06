import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/MainLayout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 統一用 /login 當登入頁 */}
        <Route path="/login" element={<LoginPage />} />

        {/* 其它頁交給 MainLayout */}
        <Route path="/*" element={<MainLayout />} />

        {/* 進站/未知路徑 → 導回 /login，避免空白 */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
