export interface LevelData {
  id: string;
  title: string;
  difficulty: number; // Number of pieces
  imageKey: string;
  imageUrl: string; // Local path or remote URL
  eventType?: 'daily' | 'weekly' | 'monthly'; // Optional for especiales
  alwaysUnlocked?: boolean; // Para eventos siempre visibles
}

// Manually update this number when adding new images (Stage_N.jpg)
const AVAILABLE_IMAGES_COUNT = 14; 

// Pseudo-random number generator with seed
class SeededRNG {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  // Simple LCG
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

function getDifficultyForLevel(levelNum: number): number {
  // Fixed first 10 levels
  if (levelNum === 1) return 16;  // Muy Fácil
  if (levelNum === 2) return 16;  // Muy Fácil
  if (levelNum === 3) return 36;  // Fácil
  if (levelNum === 4) return 36;  // Fácil
  if (levelNum === 5) return 64;  // Medio
  if (levelNum === 6) return 36;  // Fácil
  if (levelNum === 7) return 16;  // Muy Fácil
  if (levelNum === 8) return 36;  // Fácil
  if (levelNum === 9) return 36;  // Fácil
  if (levelNum === 10) return 64; // Medio

  // Dynamic Levels (11+)
  // Groups of 10
  const groupIndex = Math.floor((levelNum - 11) / 10);
  const indexInGroup = (levelNum - 11) % 10;

  // Create the bag for this group
  // 4 Easy (36), 4 Medium (64), 2 Hard (100)
  const bag = [
      36, 36, 36, 36,
      64, 64, 64, 64,
      100, 100
  ];

  // Shuffle bag deterministically based on groupIndex
  const rng = new SeededRNG(groupIndex + 12345); // Salted seed
  
  // Fisher-Yates shuffle using seeded RNG
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }

  return bag[indexInGroup];
}

function generateLevels(): LevelData[] {
    const levels: LevelData[] = [];

    for (let i = 1; i <= AVAILABLE_IMAGES_COUNT; i++) {
        const diff = getDifficultyForLevel(i);
        let title = `Nivel ${i}`;
        
        // Add descriptive titles based on difficulty
        if (diff === 16) title += ': Iniciación';
        else if (diff === 36) title += ': Fácil';
        else if (diff === 64) title += ': Medio';
        else if (diff === 100) title += ': Difícil';

        levels.push({
            id: `level_${i}`,
            title: title,
            difficulty: diff,
            imageKey: `stage_${i}`,
            imageUrl: `assets/Stage_${i}.jpg`
        });
    }

    return levels;
}

export const LEVELS: LevelData[] = generateLevels();

// Niveles especiales (eventos)
export const SPECIAL_LEVELS: LevelData[] = [
  {
    id: 'event_daily',
    title: 'Diario',
    difficulty: 200,
    imageKey: 'stage_daily',
    imageUrl: '/esp_events/daily/Stage_D.jpg',
    eventType: 'daily',
    alwaysUnlocked: true,
  },
  {
    id: 'event_weekly',
    title: 'Semanal',
    difficulty: 500,
    imageKey: 'stage_weekly',
    imageUrl: '/esp_events/weekly/Stage_S.jpg',
    eventType: 'weekly',
    alwaysUnlocked: true,
  },
  {
    id: 'event_monthly',
    title: 'Mensual',
    difficulty: 1000,
    imageKey: 'stage_monthly',
    imageUrl: '/esp_events/monthly/Stage_M.jpg',
    eventType: 'monthly',
    alwaysUnlocked: true,
  },
];

export function getLevelById(id: string): LevelData | undefined {
  const normal = LEVELS.find(l => l.id === id);
  if (normal) return normal;
  return SPECIAL_LEVELS.find(l => l.id === id);
}
