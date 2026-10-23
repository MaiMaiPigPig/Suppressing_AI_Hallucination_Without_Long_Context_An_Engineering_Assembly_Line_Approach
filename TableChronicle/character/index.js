// 规则选择页交互
document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.rule-card');

    cards.forEach(card => {
        card.addEventListener('click', function() {
            const rule = this.dataset.rule;

            // 5e、coc、pf 正在施工
            const unfinished = ['dnd_5e', 'coc', 'pf'];
            if (unfinished.includes(rule)) {
                // 移除其他卡片的提示
                document.querySelectorAll('.rule-card .under-construction').forEach(el => el.remove());
                // 移除已有的提示
                const existing = this.querySelector('.under-construction');
                if (existing) {
                    existing.remove();
                    return;
                }
                const tip = document.createElement('div');
                tip.className = 'under-construction';
                tip.textContent = '正在施工';
                this.appendChild(tip);
                // 3秒后自动消失
                setTimeout(() => tip.remove(), 3000);
                return;
            }

            window.location.href = `/character/${rule}`;
        });
    });
});