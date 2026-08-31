import './ui/style.css';
import 'phaser';
import { boot } from './app/bootstrap';
import { ProgressStore } from './data/ProgressStore';
import { initI18n } from './i18n';
import { showBootSplash } from './ui/bootSplash';

initI18n({ saved: ProgressStore.getInstance().getLocale() });
showBootSplash();
window.addEventListener('load', boot);
