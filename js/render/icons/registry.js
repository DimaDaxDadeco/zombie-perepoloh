// Сводный реестр иконок.
//
// Разложены по доменам, а не одним файлом на сотню значков: по тому же
// правилу, по которому разнесены js/screens/* и js/systems/*. Файл на сто
// иконок невозможно просматривать глазами, а просматривать их надо — это
// картинки.
//
// Модуль обязан оставаться БЕЗ DOM и БЕЗ Path2D: его импортирует Node-тест,
// который сверяет имена иконок из конфига с этим реестром.

import { UI_ICONS } from './ui.js';
import { WEAPON_ICONS } from './weapons.js';
import { ABILITY_ICONS } from './abilities.js';
import { SHOP_ICONS, DIFFICULTY_ICONS, MEDAL_ICONS } from './awards.js';
import { PLACE_ICONS, ROUND_ICONS } from './places.js';

export const ICONS = {
  ...UI_ICONS,
  ...WEAPON_ICONS,
  ...ABILITY_ICONS,
  ...SHOP_ICONS,
  ...DIFFICULTY_ICONS,
  ...MEDAL_ICONS,
  ...PLACE_ICONS,
  ...ROUND_ICONS,
};
