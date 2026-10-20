/** Icon Font Awesome cho từng nhóm hàng (thêm nhóm mới thì thêm 1 dòng) */
const ICONS = {
  'đồ uống': 'fa-mug-hot',
  'cà phê': 'fa-mug-saucer',
  'đồ ăn': 'fa-utensils',
  'bánh': 'fa-croissant',
  'món ăn': 'fa-utensils',
  'đặc sản': 'fa-gift',
  'arabica': 'fa-mug-saucer',
  'ethiopia': 'fa-coffee-pot',
  'robusta': 'fa-mug-hot',
  'signature': 'fa-cup-togo',
  'matcha': 'fa-leaf',
  'trà': 'fa-mug-tea',
  'healthy': 'fa-blender',
  'cold': 'fa-whiskey-glass-ice',
  'dịch vụ': 'fa-bell-concierge',
  'phụ thu': 'fa-receipt',
}
export const categoryIcon = (cat = '') => ICONS[cat.toLowerCase()] || 'fa-box'
