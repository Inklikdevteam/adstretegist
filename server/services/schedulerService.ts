import { DailySyncService } from './dailySyncService';

export class SchedulerService {
  private dailySyncService: DailySyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.dailySyncService = new DailySyncService();
  }

  /**
   * Start the daily scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    console.log('Starting daily sync scheduler...');
    
    // Calculate time until next midnight (IST)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(1, 0, 0, 0); // Run at 1:00 AM IST
    
    const timeUntilTomorrow = tomorrow.getTime() - now.getTime();
    
    console.log(`First sync scheduled for: ${tomorrow.toISOString()}`);
    
    // Set initial timeout for first run
    setTimeout(() => {
      this.runDailySync();
      
      // Then set up recurring daily sync (24 hours interval)
      this.syncInterval = setInterval(() => {
        this.runDailySync();
      }, 24 * 60 * 60 * 1000); // 24 hours
      
    }, timeUntilTomorrow);

    this.isRunning = true;
  }

  /**
   * Stop the daily scheduler
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('Daily sync scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; nextRun: Date | null } {
    const nextRun = this.isRunning ? this.calculateNextRun() : null;
    return {
      isRunning: this.isRunning,
      nextRun
    };
  }

  /**
   * Calculate next scheduled run time
   */
  private calculateNextRun(): Date {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(1, 0, 0, 0); // 1:00 AM IST
    
    // If it's already past 1:00 AM today, schedule for tomorrow
    if (now.getHours() >= 1) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    return nextRun;
  }

  /**
   * Execute the daily sync process
   */
  private async runDailySync(): Promise<void> {
    console.log('🔄 Running scheduled daily sync...', new Date().toISOString());
    
    try {
      await this.dailySyncService.performDailySync();
      console.log('✅ Scheduled daily sync completed successfully');
    } catch (error) {
      console.error('❌ Scheduled daily sync failed:', error);
    }
  }

  /**
   * Manually trigger sync (for testing or immediate refresh)
   */
  async triggerManualSync(): Promise<{ success: boolean; message: string; syncedUsers: number }> {
    console.log('🔄 Manual sync triggered...', new Date().toISOString());
    
    try {
      const result = await this.dailySyncService.triggerManualSync();
      console.log(`✅ Manual sync completed: ${result.message}`);
      return result;
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      return {
        success: false,
        message: `Manual sync failed: ${error.message}`,
        syncedUsers: 0
      };
    }
  }
}

// Create singleton instance
export const schedulerService = new SchedulerService();