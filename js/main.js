// Точка входа: создаёт игру и запускает цикл.

import { Game } from './core/game.js';

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);
game.start();

// Отладочный доступ из консоли браузера: game.startRound(5), game.storage.data и т.п.
// Полезно, чтобы проверить поздние раунды, не проходя их руками.
window.game = game;
