import { Bookmark } from '../types';
import { ArchiveError } from '../types';

// 检查点数据接口
interface CheckpointData {
  sessionId: string;
  startTime: number;
  totalBookmarks: number;
  processedBookmarks: string[]; // 已处理的书签ID列表
  failedBookmarks: ArchiveError[]; // 失败的书签列表
  currentIndex: number;
  isPaused: boolean;
  lastSaveTime: number;
  bookmarkQueue: Bookmark[]; // 待处理的书签队列
  successCount: number;
  failureCount: number;
  skippedCount: number;
}

// 检查点管理器类
export class CheckpointManager {
  private static readonly STORAGE_KEY = 'ai_archive_checkpoint';
  private static readonly MAX_CHECKPOINT_AGE = 24 * 60 * 60 * 1000; // 24小时
  
  private sessionId: string;
  private autoSaveInterval: number | null = null;
  
  constructor() {
    this.sessionId = this.generateSessionId();
  }
  
  /**
   * 生成唯一的会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 保存检查点数据
   */
  async saveCheckpoint(data: Partial<CheckpointData>): Promise<void> {
    try {
      const checkpoint: CheckpointData = {
        sessionId: this.sessionId,
        startTime: Date.now(),
        totalBookmarks: 0,
        processedBookmarks: [],
        failedBookmarks: [],
        currentIndex: 0,
        isPaused: false,
        lastSaveTime: Date.now(),
        bookmarkQueue: [],
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        ...data
      };
      
      // 保存到localStorage
      localStorage.setItem(CheckpointManager.STORAGE_KEY, JSON.stringify(checkpoint));
      
      console.log('检查点已保存:', checkpoint.sessionId);
    } catch (error) {
      console.error('保存检查点失败:', error);
    }
  }
  
  /**
   * 加载检查点数据
   */
  async loadCheckpoint(): Promise<CheckpointData | null> {
    try {
      const stored = localStorage.getItem(CheckpointManager.STORAGE_KEY);
      if (!stored) return null;
      
      const checkpoint: CheckpointData = JSON.parse(stored);
      
      // 检查检查点是否过期
      const age = Date.now() - checkpoint.lastSaveTime;
      if (age > CheckpointManager.MAX_CHECKPOINT_AGE) {
        console.log('检查点已过期，清除数据');
        await this.clearCheckpoint();
        return null;
      }
      
      console.log('检查点已加载:', checkpoint.sessionId);
      return checkpoint;
    } catch (error) {
      console.error('加载检查点失败:', error);
      return null;
    }
  }
  
  /**
   * 清除检查点数据
   */
  async clearCheckpoint(): Promise<void> {
    try {
      localStorage.removeItem(CheckpointManager.STORAGE_KEY);
      console.log('检查点已清除');
    } catch (error) {
      console.error('清除检查点失败:', error);
    }
  }
  
  /**
   * 检查是否存在有效的检查点
   */
  async hasValidCheckpoint(): Promise<boolean> {
    const checkpoint = await this.loadCheckpoint();
    return checkpoint !== null && checkpoint.bookmarkQueue.length > 0;
  }
  
  /**
   * 获取恢复信息
   */
  async getRecoveryInfo(): Promise<{
    canRecover: boolean;
    totalBookmarks: number;
    processedCount: number;
    remainingCount: number;
    lastSaveTime: number;
  } | null> {
    const checkpoint = await this.loadCheckpoint();
    if (!checkpoint) return null;
    
    return {
      canRecover: true,
      totalBookmarks: checkpoint.totalBookmarks,
      processedCount: checkpoint.processedBookmarks.length,
      remainingCount: checkpoint.bookmarkQueue.length,
      lastSaveTime: checkpoint.lastSaveTime
    };
  }
  
  /**
   * 启动自动保存
   */
  startAutoSave(saveCallback: () => Promise<void>, intervalMs: number = 30000): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    this.autoSaveInterval = window.setInterval(async () => {
      try {
        await saveCallback();
      } catch (error) {
        console.error('自动保存失败:', error);
      }
    }, intervalMs);
    
    console.log(`自动保存已启动，间隔: ${intervalMs}ms`);
  }
  
  /**
   * 停止自动保存
   */
  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      console.log('自动保存已停止');
    }
  }
  
  /**
   * 更新处理进度
   */
  async updateProgress(
    processedBookmarkId: string,
    isSuccess: boolean,
    error?: ArchiveError
  ): Promise<void> {
    const checkpoint = await this.loadCheckpoint();
    if (!checkpoint) return;
    
    // 更新处理列表
    if (!checkpoint.processedBookmarks.includes(processedBookmarkId)) {
      checkpoint.processedBookmarks.push(processedBookmarkId);
    }
    
    // 更新统计
    if (isSuccess) {
      checkpoint.successCount++;
    } else {
      checkpoint.failureCount++;
      if (error) {
        checkpoint.failedBookmarks.push(error);
      }
    }
    
    // 从队列中移除已处理的书签
    checkpoint.bookmarkQueue = checkpoint.bookmarkQueue.filter(
      bookmark => bookmark.id !== processedBookmarkId
    );
    
    checkpoint.currentIndex++;
    checkpoint.lastSaveTime = Date.now();
    
    await this.saveCheckpoint(checkpoint);
  }
  
  /**
   * 暂停处理
   */
  async pauseProcessing(): Promise<void> {
    const checkpoint = await this.loadCheckpoint();
    if (checkpoint) {
      checkpoint.isPaused = true;
      checkpoint.lastSaveTime = Date.now();
      await this.saveCheckpoint(checkpoint);
    }
  }
  
  /**
   * 恢复处理
   */
  async resumeProcessing(): Promise<void> {
    const checkpoint = await this.loadCheckpoint();
    if (checkpoint) {
      checkpoint.isPaused = false;
      checkpoint.lastSaveTime = Date.now();
      await this.saveCheckpoint(checkpoint);
    }
  }
  
  /**
   * 获取当前会话ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
  
  /**
   * 设置会话ID（用于恢复会话）
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }
}

// 导出单例实例
export const checkpointManager = new CheckpointManager();