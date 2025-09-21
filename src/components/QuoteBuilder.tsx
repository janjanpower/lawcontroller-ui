import React, { useState, useRef, useCallback } from 'react';
import { FileText, X, Download, Edit3 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface CaseData {
  client_name: string;
  court: string;
  case_number: string;
  lawyer: string;
}

interface FirmInfo {
  name: string;
  address: string;
  tel: string;
  fax: string;
  email: string;
}

interface QuoteItem {
  case_content: string;
  fee: string;
  note?: string;
}

interface QuoteBuilderProps {
  caseData: CaseData;
  firmInfo: FirmInfo;
  items: QuoteItem[];
}

export default function QuoteBuilder({ caseData, firmInfo, items }: QuoteBuilderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customText, setCustomText] = useState(
    `委任人 {client_name} 於 {court} 第 {case_number} 號案件，委任律師 {lawyer} 處理相關法律事務。\n\n茲提供本案件之律師費用報價如下：`
  );
  const [isExporting, setIsExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // 替換標籤為實際數據
  const replaceLabels = useCallback((text: string): string => {
    return text
      .replace(/{client_name}/g, caseData.client_name || '[委任人]')
      .replace(/{court}/g, caseData.court || '[法院]')
      .replace(/{case_number}/g, caseData.case_number || '[案號]')
      .replace(/{lawyer}/g, caseData.lawyer || '[律師]');
  }, [caseData]);

  // 計算總費用
  const totalFee = items.reduce((sum, item) => {
    const fee = parseFloat(item.fee.replace(/[^\d.-]/g, '')) || 0;
    return sum + fee;
  }, 0);

  // 格式化金額
  const formatCurrency = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^\d.-]/g, '')) : amount;
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  // 匯出 PDF
  const handleExportPDF = async () => {
    if (!previewRef.current) return;

    setIsExporting(true);
    try {
      // 使用 html2canvas 截圖
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: previewRef.current.scrollWidth,
        height: previewRef.current.scrollHeight,
      });

      // 創建 PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 寬度
      const pageHeight = 295; // A4 高度
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // 添加第一頁
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // 如果內容超過一頁，添加更多頁面
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // 生成檔案名稱
      const fileName = `報價單_${caseData.client_name || '客戶'}_${caseData.case_number || new Date().toISOString().split('T')[0]}.pdf`;

      // 下載 PDF
      pdf.save(fileName);

    } catch (error) {
      console.error('匯出 PDF 失敗:', error);
      alert('匯出 PDF 失敗，請稍後再試');
    } finally {
      setIsExporting(false);
    }
  };

  // 處理文字編輯器的變更
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomText(e.target.value);
  };

  // 插入標籤到游標位置
  const insertLabel = (label: string) => {
    const textarea = document.querySelector('#quote-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = customText.substring(0, start) + label + customText.substring(end);

    setCustomText(newText);

    // 設置新的游標位置
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + label.length, start + label.length);
    }, 0);
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setCustomText(`委任人 {client_name} 於 {court} 第 {case_number} 號案件，委任律師 {lawyer} 處理相關法律事務。\n\n茲提供本案件之律師費用報價如下：`);
  };

  return (
    <>
      {/* 觸發按鈕 */}
      <button
        onClick={openModal}
        className="bg-[#334d6d] text-white px-4 py-2 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-2 font-medium"
      >
        <FileText className="w-4 h-4" />
        <span>建立報價單</span>
      </button>

      {/* 模態對話框 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
            {/* 標題列 */}
            <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                建立報價單
              </h2>
              <button
                onClick={closeModal}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 主要內容區域 */}
            <div className="flex flex-col lg:flex-row h-[calc(95vh-80px)]">
              {/* 左側編輯器 */}
              <div className="w-full lg:w-1/2 border-r border-gray-200 flex flex-col">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900 flex items-center">
                    <Edit3 className="w-4 h-4 mr-2" />
                    文字編輯器
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    編輯報價單內容，使用標籤插入案件資訊
                  </p>
                </div>

                {/* 標籤按鈕 */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => insertLabel('{client_name}')}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors text-sm"
                    >
                      委任人
                    </button>
                    <button
                      onClick={() => insertLabel('{court}')}
                      className="px-3 py-1 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors text-sm"
                    >
                      法院
                    </button>
                    <button
                      onClick={() => insertLabel('{case_number}')}
                      className="px-3 py-1 bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200 transition-colors text-sm"
                    >
                      案號
                    </button>
                    <button
                      onClick={() => insertLabel('{lawyer}')}
                      className="px-3 py-1 bg-orange-100 text-orange-800 rounded-md hover:bg-orange-200 transition-colors text-sm"
                    >
                      律師
                    </button>
                  </div>
                </div>

                {/* 文字編輯區域 */}
                <div className="flex-1 p-4">
                  <textarea
                    id="quote-editor"
                    value={customText}
                    onChange={handleTextChange}
                    className="w-full h-full resize-none border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none font-mono text-sm leading-relaxed"
                    placeholder="在此編輯報價單內容，使用上方按鈕插入標籤..."
                  />
                </div>
              </div>

              {/* 右側預覽 */}
              <div className="w-full lg:w-1/2 flex flex-col">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900">即時預覽</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    報價單預覽效果
                  </p>
                </div>

                {/* 預覽區域 */}
                <div className="flex-1 overflow-auto p-4 bg-gray-50">
                  <div
                    ref={previewRef}
                    className="bg-white shadow-lg rounded-lg p-8 max-w-2xl mx-auto"
                    style={{ minHeight: '297mm', width: '210mm' }}
                  >
                    {/* 事務所資訊 */}
                    <div className="text-center border-b-2 border-[#334d6d] pb-6 mb-8">
                      <h1 className="text-2xl font-bold text-[#334d6d] mb-2">
                        {firmInfo.name}
                      </h1>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>{firmInfo.address}</p>
                        <p>電話：{firmInfo.tel} | 傳真：{firmInfo.fax}</p>
                        <p>Email：{firmInfo.email}</p>
                      </div>
                    </div>

                    {/* 報價單標題 */}
                    <div className="text-center mb-8">
                      <h2 className="text-xl font-bold text-gray-900 mb-2">
                        律師費用報價單
                      </h2>
                      <p className="text-sm text-gray-500">
                        日期：{new Date().toLocaleDateString('zh-TW')}
                      </p>
                    </div>

                    {/* 自訂內容 */}
                    <div className="mb-8">
                      <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {replaceLabels(customText)}
                      </div>
                    </div>

                    {/* 費用明細表 */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">費用明細</h3>
                      <div className="overflow-hidden border border-gray-300 rounded-lg">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-300">
                                項目
                              </th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 border-b border-gray-300">
                                費用
                              </th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-300">
                                備註
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {items.map((item, index) => (
                              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                                  {item.case_content}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right border-b border-gray-200 font-medium">
                                  {formatCurrency(item.fee)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">
                                  {item.note || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-100">
                            <tr>
                              <td className="px-4 py-4 text-sm font-bold text-gray-900 border-t-2 border-gray-300">
                                總計
                              </td>
                              <td className="px-4 py-4 text-sm font-bold text-gray-900 text-right border-t-2 border-gray-300">
                                {formatCurrency(totalFee)}
                              </td>
                              <td className="px-4 py-4 border-t-2 border-gray-300"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* 備註說明 */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">備註事項</h3>
                      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
                        <ul className="space-y-2">
                          <li>• 本報價單有效期限為 30 天</li>
                          <li>• 費用不含相關規費及雜支</li>
                          <li>• 如有疑問請隨時與本所聯繫</li>
                          <li>• 正式委任後將另行簽署委任契約</li>
                        </ul>
                      </div>
                    </div>

                    {/* 簽名區域 */}
                    <div className="flex justify-between items-end pt-8 border-t border-gray-200">
                      <div>
                        <p className="text-sm text-gray-600 mb-2">承辦律師</p>
                        <div className="border-b border-gray-400 w-32 pb-1">
                          <p className="text-center font-medium">{caseData.lawyer}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 mb-2">事務所印章</p>
                        <div className="w-20 h-20 border-2 border-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-xs text-gray-400">印章</span>
                        </div>
                      </div>
                    </div>

                    {/* 頁尾 */}
                    <div className="text-center mt-8 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        本報價單由 {firmInfo.name} 提供 | 列印日期：{new Date().toLocaleDateString('zh-TW')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 底部按鈕 */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                disabled={isExporting}
              >
                取消
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="px-6 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>匯出中...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>匯出 PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}