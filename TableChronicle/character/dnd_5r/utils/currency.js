// ===== 货币工具函数 =====
export function parsePrice(str) {
    if (!str || str === 'null' || str === '0') return { value: 0, unit: 'GP' };
    const m = str.match(/([\d.]+)\s*(PP|GP|EP|SP|CP|铂金币|金币|银金币|银币|铜币)?/i);
    if (!m) return { value: 0, unit: 'GP' };
    const val = parseFloat(m[1]) || 0;
    let unit = (m[2] || 'GP').toUpperCase();
    if (unit === '铂金币') unit = 'PP';
    else if (unit === '金币') unit = 'GP';
    else if (unit === '银金币') unit = 'EP';
    else if (unit === '银币') unit = 'SP';
    else if (unit === '铜币') unit = 'CP';
    return { value: val, unit };
}

export function toCP(price) {
    const unitMap = { PP: 1000, GP: 100, EP: 50, SP: 10, CP: 1 };
    const p = parsePrice(price);
    return Math.round(p.value * (unitMap[p.unit] || 100));
}

export function formatCurrency(cp) {
    const pp = Math.floor(cp / 1000);
    cp %= 1000;
    const gp = Math.floor(cp / 100);
    cp %= 100;
    const ep = Math.floor(cp / 50);
    cp %= 50;
    const sp = Math.floor(cp / 10);
    cp %= 10;
    const parts = [];
    if (pp) parts.push(pp + 'PP');
    if (gp) parts.push(gp + 'GP');
    if (ep) parts.push(ep + 'EP');
    if (sp) parts.push(sp + 'SP');
    if (cp) parts.push(cp + 'CP');
    return parts.join(' ') || '0GP';
}
