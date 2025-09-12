import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Bell, BellOff, Clock } from 'lucide-react';

interface CaseData {
  case_id: string;
  client: string;
  case_type: string;
  progress_stages?: Record<string, string>;
  progress_times?: Record<string, string>;
  progress_notes?: Record<string, string>;
}

interface StageInfo {
  case: CaseData;
  client: string;
  stage_name: string;
  stage_date: Date;
  stage_time?: string;
  days_until: number;
  is_overdue: boolean;
  is_today: boolean;
}

interface DateReminderWidgetProps {
  caseData: CaseData[];
  onCaseSelect?: (caseData: CaseData) => void;
}

export default function DateReminderWidget({ caseData, onCaseSelect }: DateReminderWidgetProps) {
  const [daysAhead, setDaysAhead] = useState(3);
  const [upcomingStages, setUpcomingStages] = useState<StageInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ✅ 用 useCallback 包裝，避免 missing dependency 警告
  const calculateUpcomingStages = useCallback(() => {
    const stages: StageInfo[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    caseData.forEach(caseItem => {
      if (caseItem.progress_stages) {
        Object.entries(caseItem.progress_stages).forEach(([stageName, dateStr]) => {
          if (dateStr) {
            const stageDate = new Date(dateStr);
            stageDate.setHours(0, 0, 0, 0);

            const diffTime = stageDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= daysAhead) {
              stages.push({
                case: caseItem,
                client: caseItem.client,
                stage_name: stageName,
                stage_date: stageDate,
                stage_time: caseItem.progress_times?.[stageName],
                days_until: diffDays,
                is_overdue: diffDays < 0,
                is_today: diffDays === 0,
              });
            }
          }
        });
      }
    });

    stages.sort((a, b) => a.stage_date.getTime() - b.stage_date.getTime());
    return stages;
  }, [caseData, daysAhead]);

  // 更新即將到期的階段
  useEffect(() => {
    const stages = calculateUpcomingStages();
    setUpcomingStages(stages);
    setCurrentIndex(0);
  }, [calculateUpcomingStages]);

  // 每分鐘更新一次時間計算
  useEffect(() => {
    const interval = setInterval(() => {
      const stages = calculateUpcomingStages();
      setUpcomingStages(stages);
    }, 60000); // 每分鐘更新一次

    return () => clearInterval(interval);
  }, [calculateUpcomingStages]);

  // 自動滾動
  useEffect(() => {
    if (!isExpanded && upcomingStages.length > 1) {
      scrollIntervalRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % upcomingStages.length);
      }, 5000);
    } else {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    }

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [isExpanded, upcomingStages.length]);

  // 檢查明天案件並顯示鈴鐺

  const formatDisplayText = (stage: StageInfo): string => {
    const dateStr = stage.stage_date.toLocaleDateString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
    });
    const clientName = stage.client.length > 6 ? stage.client.substring(0, 6) : stage.client;

    if (stage.stage_time) {
      return `${dateStr} ${stage.stage_time} ${clientName} ${stage.stage_name}`;
    } else {
      return `${dateStr} ${clientName} ${stage.stage_name}`;
    }
  };

  const getStageColor = (stage: StageInfo) => {
    if (stage.is_overdue) {
      return { bg: 'bg-red-100', text: 'text-red-800' };
    } else if (stage.is_today) {
      return { bg: 'bg-orange-100', text: 'text-orange-800' };
    } else if (stage.days_until <= 1) {
      return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
    } else {
      return { bg: 'bg-blue-100', text: 'text-blue-800' };
    }
  };

  const handleStageClick = (stage: StageInfo) => {
    setIsExpanded(false);
    if (onCaseSelect) {
      onCaseSelect(stage.case);
    }
  };

  return (
    <div className="relative ">

      {/* 跑馬燈顯示區域 */}
        <div className="relative">
          <div
            onClick={() => setIsExpanded(true)}
            className="bg-gray-100 border border-gray-300 rounded-md py-2 px-2 cursor-pointer hover:bg-gray-50 transition-colors h-[38px] flex items-center justify-between"
          >
            {/* 左側：控制按鈕 */}
            <div className="flex items-center mr-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setDaysAhead(Math.max(1, daysAhead - 1))}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-xs font-medium w-3 text-center">{daysAhead}</span>
              <button
                onClick={() => setDaysAhead(Math.min(7, daysAhead + 1))}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <ChevronRight className="w-3 h-3" />

              </button>
              <span className="text-sm text-gray-600 px-1">天內的案件</span>
            </div>

            {/* 右側：案件內容 */}
            <div className="flex-1 min-w-0">
              {upcomingStages.length > 0 ? (
                <div
                  className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${
                    getStageColor(upcomingStages[currentIndex]).bg
                  } ${getStageColor(upcomingStages[currentIndex]).text}`}
                >
                  {formatDisplayText(upcomingStages[currentIndex])}
                </div>
              ) : (
                <div className="text-sm text-gray-600 text-sm">無資料</div>
              )}
            </div>
          </div>
        </div>

      {/* 展開詳細列表 */}
      {isExpanded && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-medium text-gray-900"> {daysAhead} 天內案件</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto">
              {upcomingStages.length > 0 ? (
                upcomingStages.map((stage, index) => (
                  <div
                    key={`${stage.case.case_id}-${stage.stage_name}`}
                    onClick={() => handleStageClick(stage)}
                    className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                      index === currentIndex ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              stage.is_overdue
                                ? 'bg-red-500'
                                : stage.is_today
                                ? 'bg-orange-500'
                                : stage.days_until === 1
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                          />
                          <span className="text-sm font-medium text-gray-900">
                            {stage.client.length > 8
                              ? stage.client.substring(0, 8) + '...'
                              : stage.client}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {stage.stage_name.length > 10
                            ? stage.stage_name.substring(0, 10) + '...'
                            : stage.stage_name}
                        </div>
                        {stage.stage_time && (
                          <div className="text-xs text-gray-500 flex items-center mt-1">
                            <Clock className="w-3 h-3 mr-1" />
                            {stage.stage_time}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div
                          className={`stage-tag small ${
                            stage.is_overdue
                              ? 'overdue'
                              : stage.is_today
                              ? 'in-progress'
                              : stage.days_until === 1
                              ? 'pending'
                              : 'default'
                          }`}
                        >
                          {stage.is_overdue
                            ? '逾期'
                            : stage.is_today
                            ? '今日'
                            : stage.days_until === 1
                            ? '明日'
                            : `${stage.days_until}天`}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {stage.stage_date.toLocaleDateString('zh-TW', {
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500 text-sm">無即將到期的案件</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
