import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { FileText, CheckCircle, User, Building, Menu, X, Users } from 'lucide-react';
import { useState } from 'react';
import CaseOverview from '../pages/CaseOverview';
import ClosedCases from '../pages/ClosedCases';
import CustomerData from '../pages/CustomerData';
import UserManagement from '../pages/UserManagement';

export default function MainLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 根據當前路徑決定頁面標題
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/cases':
        return '案件總覽';
      case '/closed-cases':
        return '結案案件';
      case '/customers':
        return '客戶資料';
      case '/users':
        return '人員權限';
      default:
        return '案件管理系統';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 頂部導航欄 - 固定不動 */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* 手機版選單按鈕 */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#334d6d] rounded-full flex items-center justify-center">
                  <Building className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg lg:text-xl font-semibold text-[#334d6d]">
                  {getPageTitle()}
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>管理員</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* 手機版遮罩 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 左側導航 - 固定不動 */}
        <nav className={`
          w-64 bg-[#2c3e50] text-white transition-transform duration-300 ease-in-out z-50
          lg:translate-x-0 lg:static lg:block
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          fixed lg:relative h-full lg:h-auto
        `}>
          <div className="p-4 h-full overflow-y-auto">
            <div className="space-y-2">
              <div className="text-xs text-gray-300 uppercase tracking-wider mb-3">
                主選單
              </div>

              {/* 案件總覽 */}
              <NavLink
                to="/cases"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-md transition-colors text-sm ${
                    isActive ? 'bg-[#3498db] text-white' : 'text-white hover:bg-[#2980b9]'
                  }`
                }
              >
                <FileText className="w-4 h-4" />
                <span className="font-medium">案件總覽</span>
              </NavLink>

              {/* 結案案件 */}
              <NavLink
                to="/closed-cases"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-md transition-colors text-sm ${
                    isActive ? 'bg-[#3498db] text-white' : 'text-white hover:bg-[#2980b9]'
                  }`
                }
              >
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">結案案件</span>
              </NavLink>

              {/* 客戶資料 */}
              <NavLink
                to="/customers"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-md transition-colors text-sm ${
                    isActive ? 'bg-[#3498db] text-white' : 'text-white hover:bg-[#2980b9]'
                  }`
                }
              >
                <User className="w-4 h-4" />
                <span className="font-medium">客戶資料</span>
              </NavLink>

              {/* 人員權限 */}
              <NavLink
                to="/users"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-md transition-colors text-sm ${
                    isActive ? 'bg-[#3498db] text-white' : 'text-white hover:bg-[#2980b9]'
                  }`
                }
              >
                <Users className="w-4 h-4" />
                <span className="font-medium">人員權限</span>
              </NavLink>
            </div>
          </div>
        </nav>

        {/* 主要內容區域 - 只有這裡會切換 */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 lg:ml-0">
          <Routes>
            <Route path="/cases" element={<CaseOverview />} />
            <Route path="/closed-cases" element={<ClosedCases />} />
            <Route path="/customers" element={<CustomerData />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/" element={<CaseOverview />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}