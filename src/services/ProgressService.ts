export interface PieceState {
  id: number; // index in the array
  x: number;
  y: number;
  angle: number;
  isSolved: boolean;
}

export interface GameSession {
  levelId: string;
  pieces: PieceState[];
  isRevealActive?: boolean;
  lastUpdated: number;
  elapsedMs?: number;
}

export class ProgressService {
  private static STORAGE_KEY = 'puzzle_adventure_progress_v2';
  private static SESSION_KEY = 'puzzle_adventure_active_session';
  private static SPECIAL_SESSIONS_KEY = 'puzzle_adventure_special_sessions_v1';
  private static POWERUPS_KEY = 'puzzle_adventure_powerups_v1';
  private static instance: ProgressService;

  private readonly defaultPowerups: Record<string, number> = {
    reveal_temp: 8,
    area: 5,
    hint: 5,
    sarea: 0,
    reveal_perm: 0,
  };
  private highestUnlockedIndex: number = 0;
  private specialSessions: Record<string, GameSession> = {};
  private powerups: Record<string, number> = { ...this.defaultPowerups };

  private constructor() {
    this.loadProgress();
    this.loadSpecialSessions();
    this.loadPowerups();
  }

  public static getInstance(): ProgressService {
    if (!ProgressService.instance) {
      ProgressService.instance = new ProgressService();
    }
    return ProgressService.instance;
  }

  private loadProgress() {
    const stored = localStorage.getItem(ProgressService.STORAGE_KEY);
    
    if (stored) {
      this.highestUnlockedIndex = parseInt(stored, 10);
    } else {
      const oldStored = localStorage.getItem('puzzle_adventure_progress');
      if (oldStored) {
        try {
          const arr = JSON.parse(oldStored);
          this.highestUnlockedIndex = Math.max(0, arr.length - 1);
        } catch (e) {
          this.highestUnlockedIndex = 0;
        }
      } else {
        this.highestUnlockedIndex = 0;
      }
      this.saveProgress();
    }
  }

  private saveProgress() {
    localStorage.setItem(ProgressService.STORAGE_KEY, this.highestUnlockedIndex.toString());
  }

  private loadSpecialSessions() {
    const stored = localStorage.getItem(ProgressService.SPECIAL_SESSIONS_KEY);
    if (stored) {
      try {
        this.specialSessions = JSON.parse(stored);
      } catch (e) {
        this.specialSessions = {};
      }
    } else {
      this.specialSessions = {};
    }
  }

  private saveSpecialSessions() {
    localStorage.setItem(ProgressService.SPECIAL_SESSIONS_KEY, JSON.stringify(this.specialSessions));
  }

  private loadPowerups() {
    const stored = localStorage.getItem(ProgressService.POWERUPS_KEY);
    if (stored) {
      try {
        this.powerups = JSON.parse(stored);
      } catch (e) {
        this.powerups = { ...this.defaultPowerups };
      }
    } else {
      this.powerups = { ...this.defaultPowerups };
    }
  }

  private savePowerups() {
    localStorage.setItem(ProgressService.POWERUPS_KEY, JSON.stringify(this.powerups));
  }

  public isLevelUnlocked(levelId: string): boolean {
    if (!levelId.startsWith('level_')) return true; // Especiales siempre desbloqueados por ahora
    const num = parseInt(levelId.replace('level_', ''), 10);
    const index = num - 1;
    return index <= this.highestUnlockedIndex;
  }

  public isLevelCompleted(levelId: string): boolean {
    if (!levelId.startsWith('level_')) return false;
    const num = parseInt(levelId.replace('level_', ''), 10);
    const index = num - 1;
    return index < this.highestUnlockedIndex;
  }

  public unlockLevel(levelId: string) {
     if (!levelId.startsWith('level_')) return; // No aplica a especiales
     const num = parseInt(levelId.replace('level_', ''), 10);
     const index = num - 1;
     if (index > this.highestUnlockedIndex) {
         this.highestUnlockedIndex = index;
         this.saveProgress();
     }
  }

  public completeLevel(levelIndex: number) {
    const nextIndex = levelIndex + 1;
    if (nextIndex > this.highestUnlockedIndex) {
      this.highestUnlockedIndex = nextIndex;
      this.saveProgress();
    }
  }

  public getHighestUnlockedIndex(): number {
      return this.highestUnlockedIndex;
  }
  
  public resetProgress() {
      this.highestUnlockedIndex = 0;
      this.saveProgress();
      localStorage.removeItem('puzzle_adventure_progress');
      this.clearSession();
  }

  // --- Session Management ---

  public saveSession(session: GameSession) {
    localStorage.setItem(ProgressService.SESSION_KEY, JSON.stringify(session));
  }

  public getSession(): GameSession | null {
    const stored = localStorage.getItem(ProgressService.SESSION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  public clearSession() {
    localStorage.removeItem(ProgressService.SESSION_KEY);
  }

  // --- Special Sessions (persist in paralelo) ---
  public saveSpecialSession(session: GameSession) {
    this.specialSessions[session.levelId] = session;
    this.saveSpecialSessions();
  }

  public getSpecialSession(levelId: string): GameSession | null {
    if (!this.specialSessions || Object.keys(this.specialSessions).length === 0) {
      this.loadSpecialSessions();
    }
    return this.specialSessions[levelId] || null;
  }

  public clearSpecialSession(levelId: string) {
    delete this.specialSessions[levelId];
    this.saveSpecialSessions();
  }

  // --- Powerups Globales ---
  public getPowerups(): Record<string, number> {
    return { ...this.powerups };
  }

  public setPowerups(newState: Record<string, number>) {
    this.powerups = { ...newState };
    this.savePowerups();
  }

  public consumePowerup(key: string): boolean {
    if ((this.powerups[key] ?? 0) <= 0) return false;
    this.powerups[key] -= 1;
    this.savePowerups();
    return true;
  }

  public addPowerup(key: string, amount: number = 1) {
    const current = this.powerups[key] ?? 0;
    this.powerups[key] = current + amount;
    this.savePowerups();
  }

  public resetPowerups() {
    this.powerups = { ...this.defaultPowerups };
    this.savePowerups();
  }
}
