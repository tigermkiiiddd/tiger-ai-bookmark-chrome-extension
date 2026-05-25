import React from 'react';
import { Loader } from 'lucide-react';

interface ImportingStepProps {
  current: number;
  total: number;
}

export const ImportingStep: React.FC<ImportingStepProps> = ({ current, total }) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 mx-auto">
        <Loader className="w-full h-full text-primary animate-spin" />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          正在导入Chrome书签...
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          请耐心等待，大量书签可能需要较长时间
        </p>
      </div>

      {total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>进度: {current} / {total}</span>
            <span>{percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
