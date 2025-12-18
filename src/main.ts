import './style.css';
import 'phaser';
import { GameConfig } from './core/GameConfig';

window.addEventListener('load', () => {
  new Phaser.Game(GameConfig);
});

