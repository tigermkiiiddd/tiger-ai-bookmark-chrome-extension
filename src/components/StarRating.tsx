import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value = 0,
  onChange,
  size = 16,
  readOnly = false,
}) => {
  const [hovered, setHovered] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flash, setFlash] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const calculateRating = useCallback((clientX: number): number => {
    if (!containerRef.current || readOnly) return value;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const width = rect.width;
    const ratio = Math.max(0, Math.min(1, x / width));
    const raw = ratio * 5;
    return Math.ceil(raw * 2) / 2;
  }, [readOnly, value]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    const rating = calculateRating(e.clientX);
    setHovered(rating);
    if (isDragging && onChange) {
      onChange(rating);
    }
  }, [calculateRating, isDragging, onChange, readOnly]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly || !onChange) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const rating = calculateRating(e.clientX);
    setHovered(rating);
    onChange(rating);
    // 点击反馈动画
    setFlash(true);
    setTimeout(() => setFlash(false), 250);
  }, [calculateRating, onChange, readOnly]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(0);
    setIsDragging(false);
  }, []);

  const displayValue = hovered || value;

  return (
    <div
      ref={containerRef}
      className={`inline-flex items-center select-none ${readOnly ? '' : 'cursor-pointer'}`}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ touchAction: 'none' }}
    >
      <div className={`flex items-center gap-0.5 relative transition-transform duration-150 ${flash ? 'scale-125' : 'scale-100'}`}>
        {/* 背景灰色星星 */}
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={`bg-${star}`}
              size={size}
              className="fill-transparent text-white/40"
            />
          ))}
        </div>

        {/* 前景金色星星 — 用 clip 控制显示比例 */}
        <div
          className="flex items-center gap-0.5 absolute inset-0 overflow-hidden transition-all duration-75"
          style={{ width: `${(displayValue / 5) * 100}%` }}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={`fg-${star}`}
              size={size}
              className="fill-amber-400 text-amber-400 shrink-0"
            />
          ))}
        </div>
      </div>

      {/* 数字分数 — 固定占位，不随内容变化 */}
      <span
        className="ml-1.5 text-xs font-medium text-amber-400 tabular-nums min-w-[1.5rem] text-right transition-opacity duration-150"
        style={{ opacity: displayValue > 0 ? 1 : 0 }}
      >
        {displayValue.toFixed(1)}
      </span>
    </div>
  );
};

export default StarRating;
