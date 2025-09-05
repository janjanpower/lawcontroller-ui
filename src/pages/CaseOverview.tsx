import { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Upload,
  Download,
  Filter,
  Calendar,
  FileText,
  User,
  Building,
  Clock,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';

interface CaseData {
  id: string;
  caseNumber: string;
  client: string;
  caseType: string;
  lawyer: string;
  legalAffairs: string;
  caseReason: string;
  opposingParty: string;
  court: string;
  division: string;
  progress: string;
  progressDate: string;
  status: 'active' | 'pending' | 'completed' | 'urgent';
  stages: {
    name: string;
    date: string;
    completed: boolean;
    note?: string;
  }[];
}

// 模擬案件資料
const mockCaseData: CaseData[] = [
  {
    id: '1',
    caseNumber: '112年度民訴字第1234號',
    client: '張三',
    caseType: '民事',
    lawyer: '李律師',
    legalAffairs: '王法務',
    caseReason: '債務糾紛',
    opposingParty: '李四',
    court: '台北地方法院',
    division: '民事庭',
    progress: '起訴',
    progressDate: '2024-01-15',
    status: 'active',
    stages: [
      { name: '委任', date: '2024-01-10', completed: true },
      { name: '起訴', date: '2024-01-15', completed: true },
      { name: '開庭', date: '2024-02-20', completed: false },
      { name: '判決', date: '2024-03-15', completed: false }
    ]
  },
  {
    id: '2',
    caseNumber: '112年度刑訴字第5678號',
    client: '王五',
    caseType: '刑事',
    lawyer: '陳律師',
    legalAffairs: '林法務',
    caseReason: '詐欺案件',
    opposingParty: '檢察官',
    court: '新北地方法院',
    division: '刑事庭',
    progress: '偵查',
    progressDate: '2024-01-20',
    status: 'urgent',
    stages: [
      { name: '委任', date: '2024-01-05', completed: true },
      { name: '偵查', date: '2024-01-20', completed: true },
      { name: '起訴', date: '2024-02-10', completed: false }
    ]
  },
  {
    id: '3',
    caseNumber: '112年度行訴字第9012號',
    client: '趙六',
    caseType: '行政',
    lawyer: '黃律師',
    legalAffairs: '吳法務',
    caseReason: '行政處分撤銷',
    opposingParty: '市政府',
    court: '台北高等行政法院',
    division: '行政庭',
    progress: '已結案',
    progressDate: '2024-01-25',
    status: 'completed',
    stages: [
      { name: '委任', date: '2023-12-01', completed: true },
      { name: '起訴', date: '2023-12-15', completed: true },
      { name: '開庭', date: '2024-01-10', completed: true },
      { name: '判決', date: '2024-01-20', completed: true },
      { name: '已結案', date: '2024-01-25', completed: true }
    ]
  }
];

export default function CaseOverview() {
  const [cases] = useState<CaseData[]>(mockCaseData);
  const [filteredCases, setFilteredCases] = useState<CaseData[]>(mockCaseData);
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    caseNumber: true,
    client: true,
    caseType: true,
    lawyer: true,
    legalAffairs: true,
    progress: true,
    progressDate: true,
    court: false,
    division: false
  });

  // 搜尋功能
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCases(cases);
      return;
    }

    const filtered = cases.filter(caseItem =>
      Object.values(caseItem).some(value =>
        value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    setFilteredCases(filtered);
  }, [searchTerm, cases]);

  // 取得狀態顏色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

    // 修改 → 定義明確型別
  interface Stage {
    name: string;
    date: string;
    completed: boolean;
    note?: string;
  }

  const getStageColor = (stage: Stage): string => {
    if (!stage.date) return 'bg-gray-200 text-gray-600';

    const stageDate = new Date(stage.date);
    const today = new Date();
    const diffDays = Math.ceil((stageDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (stage.completed) return 'bg-green-500 text-white';
    if (diffDays < 0) return 'bg-red-500 text-white';
    if (diffDays <= 3) return 'bg-yellow-400 text-black';
    return 'bg-blue-500 text-white';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導航欄 */}
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
        {/* 左側導航 */}
        <nav className="w-48 bg-[#2c3e50] text-white">
          <div className="p-4">
            <div className="space-y-2">
              <div className="text-xs text-gray-300 uppercase tracking-wider mb-3">主選單</div>

              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-300 hover:bg-[#34495e] hover:text-white transition-colors">
                <FileText className="w-4 h-4" />
                <span className="text-sm">案件</span>
              </a>

              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-300 hover:bg-[#34495e] hover:text-white transition-colors">
                <User className="w-4 h-4" />
                <span className="text-sm">社員</span>
              </a>

              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-300 hover:bg-[#34495e] hover:text-white transition-colors">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">行事曆</span>
              </a>

              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-300 hover:bg-[#34495e] hover:text-white transition-colors">
                <Building className="w-4 h-4" />
                <span className="text-sm">部門</span>
              </a>

              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-300 hover:bg-[#34495e] hover:text-white transition-colors">
                <FileText className="w-4 h-4" />
                <span className="text-sm">成果</span>
              </a>

              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-300 hover:bg-[#34495e] hover:text-white transition-colors">
                <User className="w-4 h-4" />
                <span className="text-sm">雇用形態</span>
              </a>

              <div className="bg-[#3498db] rounded-md">
                <a href="#" className="flex items-center space-x-3 px-3 py-2 text-white">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">案件區分</span>
                </a>
              </div>

              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-300 hover:bg-[#34495e] hover:text-white transition-colors">
                <Building className="w-4 h-4" />
                <span className="text-sm">市區區分</span>
              </a>

              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-300 hover:bg-[#34495e] hover:text-white transition-colors">
                <FileText className="w-4 h-4" />
                <span className="text-sm">體驗區分</span>
              </a>

              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-300 hover:bg-[#34495e] hover:text-white transition-colors">
                <User className="w-4 h-4" />
                <span className="text-sm">體驗設定</span>
              </a>
            </div>
          </div>
        </nav>

        {/* 主要內容區域 */}
        <main className="flex-1 flex flex-col">
          {/* 頂部工具欄 */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-gray-900">案件區分</h2>
                <div className="flex items-center space-x-2">
                  <button className="bg-[#3498db] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>新增案件</span>
                  </button>
                  <button className="bg-[#27ae60] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#229954] transition-colors flex items-center space-x-2">
                    <Upload className="w-4 h-4" />
                    <span>上傳資料</span>
                  </button>
                  <button className="bg-[#8e44ad] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#7d3c98] transition-colors flex items-center space-x-2">
                    <Download className="w-4 h-4" />
                    <span>匯入資料</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="搜尋案件..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none text-sm w-64"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 搜尋結果統計 */}
            {searchTerm && (
              <div className="mt-2 text-sm text-green-600">
                找到 {filteredCases.length}/{cases.length} 個案件
              </div>
            )}
          </div>

          {/* 欄位控制區域 */}
          {showFilters && (
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">顯示欄位：</span>
                {Object.entries(visibleColumns).map(([key, visible]) => (
                  <label key={key} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(e) => setVisibleColumns(prev => ({
                        ...prev,
                        [key]: e.target.checked
                      }))}
                      className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                    />
                    <span className="text-gray-600">
                      {key === 'caseNumber' ? '案號' :
                       key === 'client' ? '當事人' :
                       key === 'caseType' ? '案件類型' :
                       key === 'lawyer' ? '律師' :
                       key === 'legalAffairs' ? '法務' :
                       key === 'progress' ? '進度' :
                       key === 'progressDate' ? '進度日期' :
                       key === 'court' ? '法院' :
                       key === 'division' ? '股別' : key}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 案件列表 */}
          <div className="flex-1 flex">
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                        選擇
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        ID
                      </th>
                      {visibleColumns.caseNumber && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          案號
                        </th>
                      )}
                      {visibleColumns.client && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          當事人
                        </th>
                      )}
                      {visibleColumns.caseType && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          案件類型
                        </th>
                      )}
                      {visibleColumns.lawyer && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          律師
                        </th>
                      )}
                      {visibleColumns.legalAffairs && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          法務
                        </th>
                      )}
                      {visibleColumns.progress && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          進度
                        </th>
                      )}
                      {visibleColumns.progressDate && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          進度日期
                        </th>
                      )}
                      {visibleColumns.court && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          法院
                        </th>
                      )}
                      {visibleColumns.division && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          股別
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCases.map((caseItem, index) => (
                      <tr
                        key={caseItem.id}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          selectedCase?.id === caseItem.id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                        } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                        onClick={() => setSelectedCase(caseItem)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {caseItem.id}
                        </td>
                        {visibleColumns.caseNumber && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {caseItem.caseNumber}
                          </td>
                        )}
                        {visibleColumns.client && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {caseItem.client}
                          </td>
                        )}
                        {visibleColumns.caseType && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(caseItem.status)}`}>
                              {caseItem.caseType}
                            </span>
                          </td>
                        )}
                        {visibleColumns.lawyer && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {caseItem.lawyer}
                          </td>
                        )}
                        {visibleColumns.legalAffairs && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {caseItem.legalAffairs}
                          </td>
                        )}
                        {visibleColumns.progress && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {caseItem.progress}
                          </td>
                        )}
                        {visibleColumns.progressDate && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {caseItem.progressDate}
                          </td>
                        )}
                        {visibleColumns.court && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {caseItem.court}
                          </td>
                        )}
                        {visibleColumns.division && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {caseItem.division}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center space-x-2">
                            <button className="text-gray-400 hover:text-[#334d6d] transition-colors">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="text-gray-400 hover:text-[#334d6d] transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button className="text-gray-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 右側案件詳情 */}
            {selectedCase && (
              <div className="w-96 bg-white border-l border-gray-200 overflow-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">案件詳情</h3>
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>

                  {/* 案件基本資訊 */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500">案號</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedCase.caseNumber}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">案由</label>
                        <p className="text-sm text-gray-900 mt-1">{selectedCase.caseReason}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">對造</label>
                        <p className="text-sm text-gray-900 mt-1">{selectedCase.opposingParty}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">負責法院</label>
                        <p className="text-sm text-gray-900 mt-1">{selectedCase.court}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">負責股別</label>
                        <p className="text-sm text-gray-900 mt-1">{selectedCase.division}</p>
                      </div>
                    </div>
                  </div>

                  <hr className="my-6" />

                  {/* 進度階段 */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-gray-900">案件進度</h4>
                      <button className="bg-[#27ae60] text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-[#229954] transition-colors flex items-center space-x-1">
                        <Plus className="w-3 h-3" />
                        <span>新增階段</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {selectedCase.stages.map((stage, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getStageColor(stage)}`}>
                            {stage.name.slice(0, 2)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">{stage.name}</span>
                              {stage.completed ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : stage.name === selectedCase.progress ? (
                                <Clock className="w-4 h-4 text-blue-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-gray-300" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{stage.date}</p>
                            {stage.note && (
                              <p className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                                📄 {stage.note}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </main>
        </div>
      </div>
  );
}