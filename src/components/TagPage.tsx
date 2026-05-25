import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePageState } from '../hooks/usePageState';
import { ArrowLeft, Tag } from 'lucide-react';
import { useBookmarkStore } from '../store/index';
import { formatTagPath } from '../utils/tagPath';
import PaginatedBookmarkList from './common/PaginatedBookmarkList';

const TagPage: React.FC = () => {
  usePageState();
  const { tagName } = useParams<{ tagName: string }>();
  const bookmarks = useBookmarkStore(s => s.bookmarks);
  const tags = useBookmarkStore(s => s.tags);

  const decodedTagName = decodeURIComponent(tagName || '');
  const targetTag = tags.find(t => t.name === decodedTagName || t.id === decodedTagName);
  const targetTagId = targetTag?.id;
  const tagBookmarks = targetTagId
    ? bookmarks.filter(bookmark => bookmark.tagIds?.includes(targetTagId))
    : [];

  const displayTitle = useMemo(() => {
    if (targetTag) return formatTagPath(targetTag.id, tags);
    return decodedTagName;
  }, [targetTag, tags, decodedTagName]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回所有书签
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <Tag className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              #{displayTitle}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              共 {tagBookmarks.length} 个书签使用此标签
            </p>
          </div>
        </div>
      </div>

      {/* Bookmarks */}
      {tagBookmarks.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600">
            <Tag className="w-full h-full" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            没有找到书签
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            暂时没有使用 "{decodedTagName}" 标签的书签
          </p>
        </div>
      ) : (
        <PaginatedBookmarkList bookmarks={tagBookmarks} />
      )}
    </div>
  );
};

export default TagPage;
