import { Scene } from 'phaser';
import { Piece } from '../../objects/Piece';
import { AudioService } from '../../services/AudioService';

export interface SnapSystemOptions {
  snapDistance?: number;
  requireAngle0?: boolean;
  solvedTint?: number;
  playAudio?: boolean;
  emitEvent?: boolean;
  onSolved?: (piece: Piece) => void;
}

export class SnapSystem {
  private scene: Scene;
  private audio: AudioService;
  private snapDistance: number;
  private requireAngle0: boolean;
  private solvedTint: number;
  private onSolved?: (piece: Piece) => void;

  constructor(scene: Scene, options: SnapSystemOptions = {}) {
    this.scene = scene;
    this.audio = AudioService.getInstance();
    this.snapDistance = options.snapDistance ?? 30;
    this.requireAngle0 = options.requireAngle0 ?? true;
    this.solvedTint = options.solvedTint ?? 0xddffdd;
    this.onSolved = options.onSolved;
  }

  public canSnap(piece: Piece): boolean {
    if (piece.isSolved) return false;
    const dist = Phaser.Math.Distance.Between(piece.x, piece.y, piece.correctX, piece.correctY);
    if (dist >= this.snapDistance) return false;
    if (this.requireAngle0 && piece.angle !== 0) return false;
    return true;
  }

  /**
   * Intenta encajar una pieza con las reglas actuales.
   * Retorna true si encajó y aplicó estado de resuelto.
   */
  public trySnap(piece: Piece, options: Pick<SnapSystemOptions, 'playAudio' | 'emitEvent'> = {}): boolean {
    if (!this.canSnap(piece)) return false;
    this.applySolvedState(piece, options);
    return true;
  }

  /**
   * Aplica el estado de resuelto (sin decidir si puede/should snap).
   * No cambia la experiencia: coincide con la lógica previa de Piece.snapToPlace().
   */
  public applySolvedState(piece: Piece, options: Pick<SnapSystemOptions, 'playAudio' | 'emitEvent'> = {}): void {
    piece.isSolved = true;
    piece.x = piece.correctX;
    piece.y = piece.correctY;
    piece.angle = 0;
    piece.disableInteractive();
    piece.setDepth(0);
    piece.setTint(this.solvedTint);

    if (options.playAudio ?? true) {
      this.audio.playSnap();
    }

    this.onSolved?.(piece);

    if (options.emitEvent ?? true) {
      this.scene.events.emit('piece-placed');
    }
  }
}


