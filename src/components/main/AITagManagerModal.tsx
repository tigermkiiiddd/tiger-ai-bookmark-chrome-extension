import React from 'react';
import { useBookmarkStore } from '../../store';
import { AITagManager } from '../AITagManager';

interface AITagManagerModalProps {
  onClose: () => void;
}

const AITagManagerModal: React.FC<AITagManagerModalProps> = ({ onClose }) => {
  const tags = useBookmarkStore(s => s.tags);
  const bookmarks = useBookmarkStore(s => s.bookmarks);
  const categories = useBookmarkStore(s => s.categories);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <AITagManager
          onClose={onClose}
          tags={tags}
          bookmarks={bookmarks}
          categories={categories}
        />
      </div>
    </div>
  );
};

export default AITagManagerModal;
