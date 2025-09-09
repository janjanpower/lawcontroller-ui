import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, FileText, Calendar, User, Building, Gavel, AlertCircle, Edit, Trash2, Eye } from 'lucide-react';
import CaseForm from '../components/CaseForm';
import StageEditDialog from '../components/StageEditDialog';
import FolderTree from '../components/FolderTree';
import { apiFetch } from '../utils/api';

interface Case {
  id: string;
  case_type: string;
  case_reason?: string;
  case_number?: string;
  opposing_party?: string;
  court?: string;
  division?: string;
  progress: string;
  progress_date?: string;
  is_closed: boolean;
  created_at: string;
  client_name?: string;
  lawyer_name?: string;
  legal_affairs_name?: string;
}

interface Stage {
  id: string;
  case_id: string;
  stage_name: string;
  stage_date: string;
  description?: string;
  is_completed: boolean;
  created_at: string;
}

const CaseOverview: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

  // Load cases on component mount
  useEffect(() => {
    loadCases();
  }, [statusFilter]);

  // Load stages when a case is selected
  useEffect(() => {
    if (selectedCase) {
      loadStages(selectedCase.id);
    }
  }, [selectedCase]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const firmCode = localStorage.getItem('firm_code') || 'default';
      const response = await apiFetch(`/api/cases?firm_code=${firmCode}&status=${statusFilter}`, {
        method: 'GET'
      });
      const data = await response.json();
      setCases(data.items || []);
    } catch (err) {
      setError('Failed to load cases');
      console.error('Error loading cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStages = async (caseId: string) => {
    try {
      const firmCode = localStorage.getItem('firm_code') || 'default';
      const response = await apiFetch(`/api/cases/${caseId}/stages?firm_code=${firmCode}`, {
        method: 'GET'
      });
      const data = await response.json();
      setStages(data.items || []);
    } catch (err) {
      console.error('Error loading stages:', err);
      setStages([]);
    }
  };

  const handleCreateCase = async (caseData: any) => {
    try {
      const firmCode = localStorage.getItem('firm_code') || 'default';
      const response = await apiFetch(`/api/cases?firm_code=${firmCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseData)
      });
      
      if (response.ok) {
        await loadCases();
        setShowCaseForm(false);
      } else {
        throw new Error('Failed to create case');
      }
    } catch (err) {
      setError('Failed to create case');
      console.error('Error creating case:', err);
    }
  };

  const handleUpdateCase = async (caseId: string, caseData: any) => {
    try {
      const firmCode = localStorage.getItem('firm_code') || 'default';
      const response = await apiFetch(`/api/cases/${caseId}?firm_code=${firmCode}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseData)
      });
      
      if (response.ok) {
        await loadCases();
        setEditingCase(null);
      } else {
        throw new Error('Failed to update case');
      }
    } catch (err) {
      setError('Failed to update case');
      console.error('Error updating case:', err);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!confirm('Are you sure you want to delete this case?')) return;
    
    try {
      const firmCode = localStorage.getItem('firm_code') || 'default';
      const response = await apiFetch(`/api/cases/${caseId}?firm_code=${firmCode}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadCases();
        if (selectedCase?.id === caseId) {
          setSelectedCase(null);
          setStages([]);
        }
      } else {
        throw new Error('Failed to delete case');
      }
    } catch (err) {
      setError('Failed to delete case');
      console.error('Error deleting case:', err);
    }
  };

  const handleCreateStage = async (stageData: any) => {
    if (!selectedCase) return;
    
    try {
      const firmCode = localStorage.getItem('firm_code') || 'default';
      const response = await apiFetch(`/api/cases/${selectedCase.id}/stages?firm_code=${firmCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stageData)
      });
      
      if (response.ok) {
        await loadStages(selectedCase.id);
        setShowStageDialog(false);
      } else {
        throw new Error('Failed to create stage');
      }
    } catch (err) {
      setError('Failed to create stage');
      console.error('Error creating stage:', err);
    }
  };

  const handleUpdateStage = async (stageId: string, stageData: any) => {
    try {
      const firmCode = localStorage.getItem('firm_code') || 'default';
      const response = await apiFetch(`/api/stages/${stageId}?firm_code=${firmCode}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stageData)
      });
      
      if (response.ok) {
        if (selectedCase) {
          await loadStages(selectedCase.id);
        }
        setEditingStage(null);
      } else {
        throw new Error('Failed to update stage');
      }
    } catch (err) {
      setError('Failed to update stage');
      console.error('Error updating stage:', err);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Are you sure you want to delete this stage?')) return;
    
    try {
      const firmCode = localStorage.getItem('firm_code') || 'default';
      const response = await apiFetch(`/api/stages/${stageId}?firm_code=${firmCode}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        if (selectedCase) {
          await loadStages(selectedCase.id);
        }
      } else {
        throw new Error('Failed to delete stage');
      }
    } catch (err) {
      setError('Failed to delete stage');
      console.error('Error deleting stage:', err);
    }
  };

  const filteredCases = cases.filter(case_ => {
    const matchesSearch = !searchTerm || 
      case_.case_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      case_.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      case_.case_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Cases List */}
        <div className="lg:w-1/2">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Cases</h2>
                <button
                  onClick={() => setShowCaseForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Case
                </button>
              </div>

              {/* Search and Filter */}
              <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search cases..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'open' | 'closed')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Cases</option>
                  <option value="open">Open Cases</option>
                  <option value="closed">Closed Cases</option>
                </select>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {filteredCases.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No cases found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredCases.map((case_) => (
                    <div
                      key={case_.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedCase?.id === case_.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                      }`}
                      onClick={() => setSelectedCase(case_)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900">{case_.case_type}</h3>
                            {case_.is_closed && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                Closed
                              </span>
                            )}
                          </div>
                          {case_.case_reason && (
                            <p className="text-sm text-gray-600 mb-1">{case_.case_reason}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {case_.client_name && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {case_.client_name}
                              </span>
                            )}
                            {case_.case_number && (
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {case_.case_number}
                              </span>
                            )}
                            {case_.court && (
                              <span className="flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {case_.court}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCase(case_);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCase(case_.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Case Details and Stages */}
        <div className="lg:w-1/2">
          {selectedCase ? (
            <div className="space-y-6">
              {/* Case Details */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Case Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <p className="font-medium">{selectedCase.case_type}</p>
                  </div>
                  {selectedCase.case_reason && (
                    <div>
                      <span className="text-gray-500">Reason:</span>
                      <p className="font-medium">{selectedCase.case_reason}</p>
                    </div>
                  )}
                  {selectedCase.case_number && (
                    <div>
                      <span className="text-gray-500">Case Number:</span>
                      <p className="font-medium">{selectedCase.case_number}</p>
                    </div>
                  )}
                  {selectedCase.court && (
                    <div>
                      <span className="text-gray-500">Court:</span>
                      <p className="font-medium">{selectedCase.court}</p>
                    </div>
                  )}
                  {selectedCase.division && (
                    <div>
                      <span className="text-gray-500">Division:</span>
                      <p className="font-medium">{selectedCase.division}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Progress:</span>
                    <p className="font-medium">{selectedCase.progress}</p>
                  </div>
                  {selectedCase.lawyer_name && (
                    <div>
                      <span className="text-gray-500">Lawyer:</span>
                      <p className="font-medium">{selectedCase.lawyer_name}</p>
                    </div>
                  )}
                  {selectedCase.legal_affairs_name && (
                    <div>
                      <span className="text-gray-500">Legal Affairs:</span>
                      <p className="font-medium">{selectedCase.legal_affairs_name}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Case Stages */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Case Stages</h3>
                  <button
                    onClick={() => setShowStageDialog(true)}
                    className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Stage
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {stages.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No stages added yet</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {stages.map((stage) => (
                        <div key={stage.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-gray-900">{stage.stage_name}</h4>
                                {stage.is_completed && (
                                  <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">
                                    Completed
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                {new Date(stage.stage_date).toLocaleDateString()}
                              </p>
                              {stage.description && (
                                <p className="text-sm text-gray-500">{stage.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                onClick={() => setEditingStage(stage)}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteStage(stage.id)}
                                className="p-1 text-gray-400 hover:text-red-600 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Folder Tree */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Case Files</h3>
                </div>
                <div className="p-4">
                  <FolderTree caseId={selectedCase.id} />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
              <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Select a case to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {showCaseForm && (
        <CaseForm
          onSubmit={handleCreateCase}
          onCancel={() => setShowCaseForm(false)}
        />
      )}

      {editingCase && (
        <CaseForm
          case={editingCase}
          onSubmit={(data) => handleUpdateCase(editingCase.id, data)}
          onCancel={() => setEditingCase(null)}
        />
      )}

      {showStageDialog && (
        <StageEditDialog
          caseId={selectedCase?.id || ''}
          onSubmit={handleCreateStage}
          onCancel={() => setShowStageDialog(false)}
        />
      )}

      {editingStage && (
        <StageEditDialog
          caseId={selectedCase?.id || ''}
          stage={editingStage}
          onSubmit={(data) => handleUpdateStage(editingStage.id, data)}
          onCancel={() => setEditingStage(null)}
        />
      )}
    </div>
  );
};

export default CaseOverview;