import React from 'react';
import { Plus, Sparkles, Wand2, Loader, RefreshCw } from 'lucide-react';
import { t } from '@/i18n';

interface PopupStickyActionBarProps {
  isUpdateMode: boolean;
  isAnalyzing: boolean;
  isAdding: boolean;
  canUseAI: boolean;
  hasAnalyzed: boolean;
  onStartAnalysis: () => void;
  onDirectAdd: () => void;
  onSmartAdd: () => void;
}

const PopupStickyActionBar: React.FC<PopupStickyActionBarProps> = ({
  isUpdateMode,
  isAnalyzing,
  isAdding,
  canUseAI,
  hasAnalyzed,
  onStartAnalysis,
  onDirectAdd,
  onSmartAdd,
}) => {
  const busy = isAnalyzing || isAdding;

  return (
    <div className="shrink-0 z-20 bg-white border-b border-gray-200 shadow-sm px-3 py-2.5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onStartAnalysis}
          disabled={busy || !canUseAI}
          title={!canUseAI ? t('actionBarConfigureAiKeyFirst') : undefined}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-sm font-medium border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              {t('actionBarAnalyzing')}
            </>
          ) : hasAnalyzed ? (
            <>
              <RefreshCw className="w-4 h-4" />
              {t('actionBarReanalyze')}
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              {t('actionBarStartAnalysis')}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onDirectAdd}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {isAdding && !isAnalyzing ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              {t('actionBarSaving')}
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              {isUpdateMode ? t('actionBarDirectUpdate') : t('actionBarDirectAdd')}
            </>
          )}
        </button>

        {canUseAI && (
          <button
            type="button"
            onClick={onSmartAdd}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-sm font-medium bg-gradient-to-r from-primary to-primary-hover text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 shadow-sm"
          >
            {isAdding && !isAnalyzing ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                {t('actionBarSubmitting')}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {isUpdateMode ? t('actionBarAiSmartUpdate') : t('actionBarAiSmartAdd')}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default PopupStickyActionBar;
