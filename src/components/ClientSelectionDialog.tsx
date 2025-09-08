import React, { useState, useEffect } from 'react';
import { X, User, Phone, CreditCard, Calendar } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  id_number?: string;
  birth_date?: string;
  client_type: 'individual' | 'company';
}

interface ClientSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (client: Client) => void;
  firmCode: string;
}

export default function ClientSelectionDialog({ 
  isOpen, 
  onClose, 
  onSelect, 
  firmCode 
}: ClientSelectionDialogProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  // 載入客戶列表
  const loadClients = async () => {
    if (!firmCode) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/clients?firm_code=${firmCode}&page_size=100`);
      const data = await response.json();
      
      if (response.ok) {
        setClients(data.items || []);
      } else {
        console.error('載入客戶列表失敗:', data.detail);
      }
    } catch (error) {
      console.error('載入客戶列表錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen, firmCode]);

  // 搜尋過濾
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredClients(clients);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = clients.filter(client =>
      client.name.toLowerCase().includes(term) ||
      (client.phone && client.phone.includes(term)) ||
      (client.id_number && client.id_number.includes(term))
    );
    setFilteredClients(filtered);
  }, [searchTerm, clients]);

  const formatClientDisplay = (client: Client) => {
    const parts = [client.name];
    
    if (client.id_number) {
      parts.push(`(${client.id_number})`);
    } else if (client.phone) {
      parts.push(`(${client.phone})`);
    }
    
    return parts.join(' ');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center">
            <User className="w-5 h-5 mr-2" />
            選擇客戶
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 搜尋區域 */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="搜尋客戶姓名、電話或身份證號..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
          />
        </div>

        {/* 客戶列表 */}
        <div className="overflow-y-auto max-h-96">
          {loading ? (
            <div className="p-4 text-center text-gray-500">載入中...</div>
          ) : filteredClients.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? '找不到符合條件的客戶' : '尚無客戶資料'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => onSelect(client)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {formatClientDisplay(client)}
                      </div>
                      <div className="text-sm text-gray-500 space-y-1 mt-1">
                        {client.phone && (
                          <div className="flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {client.phone}
                          </div>
                        )}
                        {client.id_number && (
                          <div className="flex items-center">
                            <CreditCard className="w-3 h-3 mr-1" />
                            {client.id_number}
                          </div>
                        )}
                        {client.birth_date && (
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {client.birth_date}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {client.client_type === 'company' ? '公司' : '個人'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}