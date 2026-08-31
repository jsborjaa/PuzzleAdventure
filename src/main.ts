import './ui/style.css';
import 'phaser';
import { boot } from './app/bootstrap';
import { ProgressStore } from './data/ProgressStore';
import { initI18n } from './i18n';

initI18n({ saved: ProgressStore.getInstance().getLocale() });
window.addEventListener('load', boot);
