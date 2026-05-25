import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, BookOpen, RotateCcw, X } from 'lucide-react';
import { useBookmarkStore } from '../store';

interface RecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RecoveryModal: React.FC<RecoveryModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { 
    recoveryInfo, 
    recoverFromCheckpoint, 
    clearCheckpoint,
    showRecoveryModal,
  } = useBookmarkStore();

  if (!isOpen || !showRecoveryModal || !recoveryInfo) {
    return null;
  }

  const handleRecover = async () => {
    await recoverFromCheckpoint();
    onClose();
    navigate('/ai-archive');
  };

  const handleClearAndStart = async () => {
    await clearCheckpoint();
    onClose();
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-100 rounded-full">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              发现未完成的归档任务
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              检测到您有一个未完成的批量归档任务，您可以选择继续之前的进度或重新开始。
            </p>
            
            {/* 任务信息 */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">总书签数</span>
                </div>
                <span className="text-sm text-gray-900">{recoveryInfo.totalBookmarks}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <RotateCcw className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-700">已处理</span>
                </div>
                <span className="text-sm text-gray-900">{recoveryInfo.processedCount}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium text-gray-700">剩余</span>
                </div>
                <span className="text-sm text-gray-900">{recoveryInfo.remainingCount}</span>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">上次保存</span>
                </div>
                <span className="text-sm text-gray-900">
                  {formatTime(recoveryInfo.lastSaveTime)}
                </span>
              </div>
            </div>
            
            {/* 进度条 */}
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>进度</span>
                <span>
                  {Math.round((recoveryInfo.processedCount / recoveryInfo.totalBookmarks) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(recoveryInfo.processedCount / recoveryInfo.totalBookmarks) * 100}%` 
                  }}
                />
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex space-x-3">
            <button
              onClick={handleRecover}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>继续处理</span>
            </button>
            
            <button
              onClick={handleClearAndStart}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              重新开始
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-3 text-center">
            选择"继续处理"将从上次中断的位置继续，选择"重新开始"将清除之前的进度。
          </p>
        </div>
      </div>
    </div>
  );
};

export default RecoveryModal;