import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { FileText, CheckCircle, User, Building } from 'lucide-react';
import CaseOverview from '../pages/CaseOverview';
import ClosedCases from '../pages/ClosedCases';
import CustomerData from '../pages/CustomerData';

export default function MainLayout() {
  const location = useLocation();

  // 根據當前路徑決定頁面標題
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/cases':
        return '案件總覽';
      case '/closed-cases':
        return '結案案件';
      case '/customers':
        return '客戶資料';
      default:
        return '案件管理系統';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導航欄 - 固定不動 */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#334d6d] rounded-full flex items-center justify-center">
                  <Building className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-xl font-semibold text-[#334d6d]">案件管理系統</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>管理員</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* 左側導航 - 固定不動 */}
        <nav className="w-48 bg-[#2c3e50] text-white">
          <div className="p-4">
            <div className="space-y-2">
              <div className="text-xs text-gray-300 uppercase tracking-wider mb-3">
                主選單
              </div>

              {/* 案件總覽 */}
              <NavLink
                to="/cases"
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                    isActive ? 'bg-[#3498db] text-white' : 'text-white hover:bg-[#2980b9]'
                  }`
                }
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">案件總覽</span>
              </NavLink>

              {/* 結案案件 */}
              <NavLink
                to="/closed-cases"
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                    isActive ? 'bg-[#3498db] text-white' : 'text-white hover:bg-[#2980b9]'
                  }`
                }
              >
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">結案案件</span>
              </NavLink>

              {/* 客戶資料 */}
              <NavLink
                to="/customers"
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                    isActive ? 'bg-[#3498db] text-white' : 'text-white hover:bg-[#2980b9]'
                  }`
                }
              >
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">客戶資料</span>
              </NavLink>
            </div>
          </div>
        </nav>

        {/* 主要內容區域 - 只有這裡會切換 */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/cases" element={<CaseOverview />} />
            <Route path="/closed-cases" element={<ClosedCases />} />
            <Route path="/customers" element={<CustomerData />} />
            <Route path="/" element={<CaseOverview />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}