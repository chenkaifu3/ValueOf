/**
 * ValueOf - 物品价值日均分摊管理应用
 */

// ===== 数据模型 =====
const CATEGORIES = {
    all: '全部',
    digital: '数码产品',
    life: '生活运动',
    clothes: '衣物鞋包',
    beauty: '护肤美妆',
    furniture: '家具电器',
    other: '其他'
};

// 默认图标
const DEFAULT_ICONS = ['📱', '💻', '⌚', '🎧', '📷', '🎮', '👟', '👔', '👜', '🧴', '🛋️', '🏠', '🚲', '⚽', '📚', '🎁', '🎒', '💄', '🧥', '👗'];

// ===== 应用状态 =====
let state = {
    items: [],
    currentCategory: 'all',
    editingItemId: null,
    syncConfig: null,
    currentSort: { field: 'daily', order: 'asc' },
    currentPhoto: null,
    icons: [...DEFAULT_ICONS],
    selectedIcon: '📱'
};

// ===== DOM 元素缓存 =====
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// ===== 工具函数 =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatCurrency(value) {
    return '¥' + value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function calculateDays(purchaseDate, retireDate = null) {
    const start = new Date(purchaseDate);
    const end = retireDate ? new Date(retireDate) : new Date();
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(diffDays, 1);
}

function calculateDaily(item) {
    if (item.calcMethod === 'none') return null;
    if (item.calcMethod === 'count') {
        // 按次数计的物品不计入日均成本汇总
        return null;
    }
    const days = calculateDays(item.purchaseDate, item.retireDate);
    return item.price / days;
}

function showToast(message, type = 'success') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== 数据持久化 =====
const Storage = {
    ITEMS_KEY: 'valueof_items',
    SYNC_KEY: 'valueof_sync_config',
    ICONS_KEY: 'valueof_icons',

    loadItems() {
        try {
            const data = localStorage.getItem(this.ITEMS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    saveItems(items) {
        try {
            localStorage.setItem(this.ITEMS_KEY, JSON.stringify(items));
            return true;
        } catch (e) {
            return false;
        }
    },

    loadSyncConfig() {
        try {
            const data = localStorage.getItem(this.SYNC_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    saveSyncConfig(config) {
        try {
            localStorage.setItem(this.SYNC_KEY, JSON.stringify(config));
            return true;
        } catch (e) {
            return false;
        }
    },

    loadIcons() {
        try {
            const data = localStorage.getItem(this.ICONS_KEY);
            return data ? JSON.parse(data) : [...DEFAULT_ICONS];
        } catch (e) {
            return [...DEFAULT_ICONS];
        }
    },

    saveIcons(icons) {
        try {
            localStorage.setItem(this.ICONS_KEY, JSON.stringify(icons));
            return true;
        } catch (e) {
            return false;
        }
    }
};

// ===== 排序功能 =====
function sortItems(items, sortField, sortOrder) {
    return [...items].sort((a, b) => {
        let valueA, valueB;
        switch (sortField) {
            case 'purchaseDate':
                valueA = new Date(a.purchaseDate).getTime();
                valueB = new Date(b.purchaseDate).getTime();
                break;
            case 'price':
                valueA = a.price;
                valueB = b.price;
                break;
            case 'days':
                valueA = calculateDays(a.purchaseDate, a.retireDate);
                valueB = calculateDays(b.purchaseDate, b.retireDate);
                break;
            case 'usageCount':
                valueA = a.usageCount || 0;
                valueB = b.usageCount || 0;
                break;
            case 'daily':
                valueA = calculateDaily(a) || Infinity;
                valueB = calculateDaily(b) || Infinity;
                break;
            default:
                valueA = 0;
                valueB = 0;
        }
        return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    });
}

// ===== 页面导航 =====
function navigateTo(pageName) {
    $$('.page').forEach(page => page.classList.remove('active'));
    $(`#page-${pageName}`).classList.add('active');
    $$('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });
}

// ===== 渲染函数 =====
function renderSummary() {
    const filteredItems = state.currentCategory === 'all'
        ? state.items
        : state.items.filter(item => item.category === state.currentCategory);

    $('#total-count').textContent = filteredItems.length;

    const totalValue = filteredItems.reduce((sum, item) => sum + item.price, 0);
    $('#total-value').textContent = formatCurrency(totalValue);

    const dailyValues = filteredItems.map(item => calculateDaily(item)).filter(v => v !== null);
    const totalDaily = dailyValues.reduce((sum, v) => sum + v, 0);
    $('#total-daily').textContent = formatCurrency(totalDaily) + '/天';

    $('#current-category-name').textContent = CATEGORIES[state.currentCategory];
}

function renderCategoryTabs() {
    $$('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === state.currentCategory);
    });
}

function renderItemsList() {
    const list = $('#items-list');
    const emptyState = $('#empty-state');

    let filteredItems = state.currentCategory === 'all'
        ? state.items
        : state.items.filter(item => item.category === state.currentCategory);

    filteredItems = sortItems(filteredItems, state.currentSort.field, state.currentSort.order);

    if (filteredItems.length === 0) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    list.innerHTML = filteredItems.map(item => {
        const days = calculateDays(item.purchaseDate, item.retireDate);
        const daily = calculateDaily(item);
        const dailyText = daily !== null
            ? (item.calcMethod === 'count' ? formatCurrency(daily) + '/次' : formatCurrency(daily) + '/天')
            : '不计算';
        const daysText = item.retireDate ? `已使用 ${days} 天` : `使用中 ${days} 天`;

        const iconContent = item.photo
            ? `<img src="${item.photo}" alt="${item.name}">`
            : item.icon;
        const iconClass = item.photo ? 'item-icon has-photo' : 'item-icon';

        return `
      <div class="item-card glass-card" data-id="${item.id}">
        <div class="${iconClass}">${iconContent}</div>
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-days">${daysText}</div>
        </div>
        <div class="item-values">
          <div class="item-price">${formatCurrency(item.price)}</div>
          <div class="item-daily">${dailyText}</div>
        </div>
      </div>
    `;
    }).join('');
}

function renderSyncStatus() {
    const statusEl = $('#sync-status');
    if (state.syncConfig && state.syncConfig.token) {
        statusEl.innerHTML = '<span>已配置</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        statusEl.classList.remove('not-synced');
        statusEl.classList.add('synced');
    } else {
        statusEl.innerHTML = '<span>未配置</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        statusEl.classList.remove('synced');
        statusEl.classList.add('not-synced');
    }
}

function renderSortMenu() {
    $$('.sort-option').forEach(opt => {
        const isActive = opt.dataset.sort === state.currentSort.field &&
            opt.dataset.order === state.currentSort.order;
        opt.classList.toggle('active', isActive);
    });
}

function renderIconPicker(containerId = 'icon-picker') {
    const container = $(`#${containerId}`);
    if (!container) return;

    container.innerHTML = state.icons.map(icon => `
        <div class="icon-option${icon === state.selectedIcon ? ' selected' : ''}" data-icon="${icon}">${icon}</div>
    `).join('');
}

function renderAll() {
    renderSummary();
    renderCategoryTabs();
    renderItemsList();
    renderSyncStatus();
    renderSortMenu();
    renderIconPicker();
}

// ===== 表单处理 =====
function resetForm() {
    $('#item-form').reset();
    $('#item-purchase-date').value = new Date().toISOString().split('T')[0];
    state.editingItemId = null;
    state.currentPhoto = null;
    state.selectedIcon = state.icons[0] || '📱';
    $('#add-page-title').textContent = '添加物品';

    // 更新图标显示
    $('#current-icon').textContent = state.selectedIcon;
    renderIconPicker();

    // 折叠图标选择器
    $('#icon-picker').classList.remove('expanded');
    $('#icon-picker-toggle').classList.remove('expanded');

    // 隐藏使用次数
    $('#usage-count-group').style.display = 'none';

    // 隐藏照片预览
    $('#photo-preview').style.display = 'none';
    $('#photo-upload-btn').style.display = 'flex';
}

function populateForm(item) {
    $('#item-name').value = item.name;
    $('#item-category').value = item.category;
    $('#item-price').value = item.price;
    $('#item-purchase-date').value = item.purchaseDate;
    $('#item-retire-date').value = item.retireDate || '';
    $('#item-calc-method').value = item.calcMethod;
    $('#item-usage-count').value = item.usageCount || 1;
    $('#item-note').value = item.note || '';

    // 设置当前图标
    state.selectedIcon = item.icon;
    $('#current-icon').textContent = item.icon;
    renderIconPicker();

    // 显示/隐藏使用次数
    $('#usage-count-group').style.display = item.calcMethod === 'count' ? 'block' : 'none';

    // 显示照片预览
    if (item.photo) {
        state.currentPhoto = item.photo;
        $('#photo-preview-img').src = item.photo;
        $('#photo-preview').style.display = 'block';
        $('#photo-upload-btn').style.display = 'none';
    } else {
        state.currentPhoto = null;
        $('#photo-preview').style.display = 'none';
        $('#photo-upload-btn').style.display = 'flex';
    }

    state.editingItemId = item.id;
    $('#add-page-title').textContent = '编辑物品';
}

function getFormData() {
    return {
        name: $('#item-name').value.trim(),
        category: $('#item-category').value,
        icon: state.selectedIcon,
        photo: state.currentPhoto || null,
        price: parseFloat($('#item-price').value) || 0,
        purchaseDate: $('#item-purchase-date').value,
        retireDate: $('#item-retire-date').value || null,
        calcMethod: $('#item-calc-method').value,
        usageCount: parseInt($('#item-usage-count').value) || 1,
        note: $('#item-note').value.trim()
    };
}

function validateForm() {
    const data = getFormData();
    if (!data.name) { showToast('请输入物品名称', 'error'); return false; }
    if (!data.category) { showToast('请选择分类', 'error'); return false; }
    if (!data.price || data.price <= 0) { showToast('请输入有效的购买价格', 'error'); return false; }
    if (!data.purchaseDate) { showToast('请选择购买日期', 'error'); return false; }
    return true;
}

function saveItem() {
    if (!validateForm()) return;

    const data = getFormData();

    if (state.editingItemId) {
        const index = state.items.findIndex(item => item.id === state.editingItemId);
        if (index !== -1) {
            state.items[index] = { ...state.items[index], ...data };
        }
        showToast('物品已更新');
    } else {
        state.items.unshift({ id: generateId(), ...data });
        showToast('物品已添加');
    }

    Storage.saveItems(state.items);
    renderAll();
    navigateTo('items');
    resetForm();
}

// ===== 照片处理 =====
function handlePhotoSelect(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 300;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxSize) { height *= maxSize / width; width = maxSize; }
            } else {
                if (height > maxSize) { width *= maxSize / height; height = maxSize; }
            }

            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);

            state.currentPhoto = canvas.toDataURL('image/jpeg', 0.7);
            $('#photo-preview-img').src = state.currentPhoto;
            $('#photo-preview').style.display = 'block';
            $('#photo-upload-btn').style.display = 'none';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removePhoto() {
    state.currentPhoto = null;
    $('#photo-preview').style.display = 'none';
    $('#photo-upload-btn').style.display = 'flex';
    $('#item-photo').value = '';
}

// ===== 删除物品 =====
let itemToDelete = null;

function showDeleteModal(itemId) {
    itemToDelete = itemId;
    $('#delete-modal').classList.add('active');
}

function hideDeleteModal() {
    itemToDelete = null;
    $('#delete-modal').classList.remove('active');
}

function confirmDelete() {
    if (itemToDelete) {
        state.items = state.items.filter(item => item.id !== itemToDelete);
        Storage.saveItems(state.items);
        renderAll();
        showToast('物品已删除');
    }
    hideDeleteModal();
}

// ===== 图标管理 =====
function showIconModal() {
    renderIconManagePicker();
    $('#icon-modal').classList.add('active');
}

function hideIconModal() {
    $('#icon-modal').classList.remove('active');
}

function renderIconManagePicker() {
    const container = $('#icon-manage-picker');
    container.innerHTML = state.icons.map(icon => `
        <div class="icon-option" data-icon="${icon}" data-deletable="true">${icon}</div>
    `).join('');
}

function addNewIcon() {
    const input = $('#new-icon-input');
    const newIcon = input.value.trim();

    if (!newIcon) {
        showToast('请输入图标', 'error');
        return;
    }

    if (state.icons.includes(newIcon)) {
        showToast('图标已存在', 'error');
        return;
    }

    state.icons.push(newIcon);
    Storage.saveIcons(state.icons);
    input.value = '';
    renderIconManagePicker();
    renderIconPicker();
    showToast('图标添加成功');
}

function deleteIcon(icon) {
    if (state.icons.length <= 1) {
        showToast('至少保留一个图标', 'error');
        return;
    }

    state.icons = state.icons.filter(i => i !== icon);
    Storage.saveIcons(state.icons);

    if (state.selectedIcon === icon) {
        state.selectedIcon = state.icons[0];
        $('#current-icon').textContent = state.selectedIcon;
    }

    renderIconManagePicker();
    renderIconPicker();
    showToast('图标已删除');
}

function resetIcons() {
    state.icons = [...DEFAULT_ICONS];
    state.selectedIcon = state.icons[0];
    Storage.saveIcons(state.icons);
    $('#current-icon').textContent = state.selectedIcon;
    renderIconManagePicker();
    renderIconPicker();
    showToast('已恢复默认图标');
}

// ===== GitHub Gist 同步功能 =====
function showSyncModal() {
    const config = state.syncConfig || {};
    $('#sync-token').value = config.token || '';
    $('#sync-gist-id').value = config.gistId || '';
    $('#sync-modal').classList.add('active');
}

function hideSyncModal() {
    $('#sync-modal').classList.remove('active');
}

async function uploadToGist() {
    const token = $('#sync-token').value.trim();
    let gistId = $('#sync-gist-id').value.trim();

    if (!token) {
        showToast('请输入 GitHub Token', 'error');
        return;
    }

    showToast('正在同步...');

    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json'
        };

        const content = JSON.stringify({
            items: state.items,
            icons: state.icons,
            syncedAt: new Date().toISOString(),
            version: '1.1.0'
        }, null, 2);

        let response;

        if (gistId) {
            response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ files: { 'valueof_data.json': { content } } })
            });
        } else {
            response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    description: 'ValueOf App Data Backup',
                    public: false,
                    files: { 'valueof_data.json': { content } }
                })
            });
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        state.syncConfig = { token, gistId: data.id };
        Storage.saveSyncConfig(state.syncConfig);
        $('#sync-gist-id').value = data.id;
        renderSyncStatus();
        hideSyncModal();
        showToast('同步成功！');
    } catch (e) {
        showToast('同步失败: ' + e.message, 'error');
    }
}

async function downloadFromGist() {
    const token = $('#sync-token').value.trim();
    const gistId = $('#sync-gist-id').value.trim();

    if (!token) { showToast('请输入 GitHub Token', 'error'); return; }
    if (!gistId) { showToast('请输入 Gist ID', 'error'); return; }

    showToast('正在拉取...');

    try {
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const gist = await response.json();
        const file = gist.files['valueof_data.json'];
        if (!file) throw new Error('Gist 中没有找到数据文件');

        const data = JSON.parse(file.content);
        if (!data.items || !Array.isArray(data.items)) throw new Error('无效的数据格式');

        state.items = data.items;
        Storage.saveItems(state.items);

        if (data.icons && Array.isArray(data.icons)) {
            state.icons = data.icons;
            Storage.saveIcons(state.icons);
        }

        state.syncConfig = { token, gistId };
        Storage.saveSyncConfig(state.syncConfig);

        renderAll();
        hideSyncModal();
        showToast(`成功拉取 ${data.items.length} 件物品`);
    } catch (e) {
        showToast('拉取失败: ' + e.message, 'error');
    }
}

// ===== 导入导出 =====
function exportData() {
    const data = {
        items: state.items,
        icons: state.icons,
        exportedAt: new Date().toISOString(),
        version: '1.1.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valueof_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出');
}

async function exportScreenshot() {
    showToast('正在生成截图...', 'info');

    // 切换到首页并显示所有物品
    navigateTo('items');
    state.currentCategory = 'all';
    renderAll();

    // 等待渲染完成
    await new Promise(resolve => setTimeout(resolve, 300));

    // 创建一个用于截图的容器
    const container = document.createElement('div');
    container.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 400px;
        background: linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%);
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
        color: #fff;
    `;

    // 生成截图内容
    const totalValue = state.items.reduce((sum, item) => sum + item.price, 0);
    const dailyValues = state.items.map(item => calculateDaily(item)).filter(v => v !== null);
    const totalDaily = dailyValues.reduce((sum, v) => sum + v, 0);

    let itemsHtml = '';
    const sortedItems = sortItems([...state.items], state.currentSort.field, state.currentSort.order);

    sortedItems.forEach((item, index) => {
        const days = calculateDays(item.purchaseDate, item.retireDate);
        const daily = calculateDaily(item);
        const dailyText = daily !== null ? `¥${daily.toFixed(2)}/天` : (item.calcMethod === 'count' ? `¥${(item.price / item.usageCount).toFixed(2)}/次` : '不计入');
        const colors = ['#8b5cf6', '#ec4899', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];
        const color = colors[index % 6];

        itemsHtml += `
            <div style="display: flex; align-items: center; gap: 12px; padding: 14px; margin-bottom: 10px; background: linear-gradient(135deg, ${color}22 0%, ${color}08 100%); border: 1px solid ${color}55; border-radius: 12px;">
                <div style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); border-radius: 10px; font-size: 22px;">${item.icon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 4px;">${item.name}</div>
                    <div style="font-size: 12px; color: #888;">使用中 ${days} 天</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 600;">¥${item.price.toLocaleString()}</div>
                    <div style="font-size: 12px; color: ${color};">${dailyText}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 24px; font-weight: 700; background: linear-gradient(135deg, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px;">ValueOf</div>
            <div style="font-size: 13px; color: #888;">物品价值管理</div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 12px; color: #888; margin-bottom: 6px;">总资产</div>
                <div style="font-size: 20px; font-weight: 700; background: linear-gradient(135deg, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">¥${totalValue.toLocaleString()}</div>
            </div>
            <div style="text-align: center; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 12px; color: #888; margin-bottom: 6px;">日均成本</div>
                <div style="font-size: 20px; font-weight: 700; background: linear-gradient(135deg, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">¥${totalDaily.toFixed(2)}/天</div>
            </div>
        </div>
        <div style="font-size: 13px; color: #888; margin-bottom: 12px;">${state.items.length} 件物品</div>
        ${itemsHtml}
        <div style="text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 11px; color: #666;">生成于 ${new Date().toLocaleDateString('zh-CN')}</div>
        </div>
    `;

    document.body.appendChild(container);

    try {
        const canvas = await html2canvas(container, {
            backgroundColor: null,
            scale: 2,
            logging: false
        });

        const link = document.createElement('a');
        link.download = `valueof_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        showToast('截图已保存');
    } catch (err) {
        console.error('Screenshot error:', err);
        showToast('截图失败', 'error');
    } finally {
        document.body.removeChild(container);
    }
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.items || !Array.isArray(data.items)) throw new Error('无效的数据格式');

            state.items = data.items;
            Storage.saveItems(state.items);

            if (data.icons && Array.isArray(data.icons)) {
                state.icons = data.icons;
                Storage.saveIcons(state.icons);
            }

            renderAll();
            showToast(`成功导入 ${data.items.length} 件物品`);
        } catch (err) {
            showToast('导入失败: ' + err.message, 'error');
        }
    };
    reader.onerror = () => showToast('读取文件失败', 'error');
    reader.readAsText(file);
}

// ===== 事件绑定 =====
function bindEvents() {
    // 底部导航
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });

    // 添加按钮
    $('#nav-add').addEventListener('click', () => {
        resetForm();
        navigateTo('add');
    });

    // 返回按钮
    $('#back-btn').addEventListener('click', () => {
        navigateTo('items');
        resetForm();
    });

    // 保存按钮
    $('#save-btn').addEventListener('click', saveItem);

    // 分类标签
    $$('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            state.currentCategory = tab.dataset.category;
            renderAll();
        });
    });

    // 分类筛选按钮
    $('#category-filter-btn').addEventListener('click', () => {
        const categories = Object.keys(CATEGORIES);
        const currentIndex = categories.indexOf(state.currentCategory);
        state.currentCategory = categories[(currentIndex + 1) % categories.length];
        renderAll();
    });

    // 排序按钮
    $('#sort-btn').addEventListener('click', () => {
        $('#sort-menu').classList.toggle('active');
        $('#sort-btn').classList.toggle('active');
    });

    // 排序选项
    $$('.sort-option').forEach(opt => {
        opt.addEventListener('click', () => {
            state.currentSort = { field: opt.dataset.sort, order: opt.dataset.order };
            renderAll();
            $('#sort-menu').classList.remove('active');
            $('#sort-btn').classList.remove('active');
        });
    });

    // 图标选择器折叠
    $('#icon-picker-toggle').addEventListener('click', () => {
        const toggle = $('#icon-picker-toggle');
        const picker = $('#icon-picker');
        toggle.classList.toggle('expanded');
        picker.classList.toggle('expanded');
    });

    // 图标选择
    $('#icon-picker').addEventListener('click', (e) => {
        const option = e.target.closest('.icon-option');
        if (option) {
            state.selectedIcon = option.dataset.icon;
            $('#current-icon').textContent = state.selectedIcon;
            $$('#icon-picker .icon-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // 选择后折叠
            $('#icon-picker-toggle').classList.remove('expanded');
            $('#icon-picker').classList.remove('expanded');
        }
    });

    // 照片上传
    $('#photo-upload-btn').addEventListener('click', () => $('#item-photo').click());
    $('#item-photo').addEventListener('change', (e) => {
        if (e.target.files[0]) handlePhotoSelect(e.target.files[0]);
    });
    $('#photo-remove').addEventListener('click', removePhoto);

    // 计算方式切换
    $('#item-calc-method').addEventListener('change', (e) => {
        $('#usage-count-group').style.display = e.target.value === 'count' ? 'block' : 'none';
    });

    // 物品卡片点击
    $('#items-list').addEventListener('click', (e) => {
        const card = e.target.closest('.item-card');
        if (card) {
            const item = state.items.find(i => i.id === card.dataset.id);
            if (item) {
                populateForm(item);
                navigateTo('add');
            }
        }
    });

    // 长按删除
    $('#items-list').addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const card = e.target.closest('.item-card');
        if (card) showDeleteModal(card.dataset.id);
    });

    // 删除确认
    $('#delete-confirm').addEventListener('click', confirmDelete);
    $('#delete-cancel').addEventListener('click', hideDeleteModal);

    // 同步设置
    $('#sync-btn').addEventListener('click', showSyncModal);
    $('#sync-cancel').addEventListener('click', hideSyncModal);
    $('#sync-save').addEventListener('click', uploadToGist);
    $('#sync-download').addEventListener('click', downloadFromGist);

    // 图标管理
    $('#icon-manage-btn').addEventListener('click', showIconModal);
    $('#icon-modal-close').addEventListener('click', hideIconModal);
    $('#add-icon-btn').addEventListener('click', addNewIcon);
    $('#reset-icons-btn').addEventListener('click', resetIcons);

    // 图标管理中删除图标（双击删除）
    $('#icon-manage-picker').addEventListener('dblclick', (e) => {
        const option = e.target.closest('.icon-option');
        if (option) {
            deleteIcon(option.dataset.icon);
        }
    });

    // 点击遮罩关闭弹窗
    $$('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });

    // 点击其他地方关闭排序菜单
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#sort-btn') && !e.target.closest('#sort-menu')) {
            $('#sort-menu').classList.remove('active');
            $('#sort-btn').classList.remove('active');
        }
    });

    // 导出
    $('#export-btn').addEventListener('click', exportData);

    // 导出截图
    $('#screenshot-btn').addEventListener('click', exportScreenshot);

    // 导入
    $('#import-btn').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            importData(e.target.files[0]);
            e.target.value = '';
        }
    });
}

// ===== 初始化 =====
function init() {
    state.items = Storage.loadItems();
    state.syncConfig = Storage.loadSyncConfig();
    state.icons = Storage.loadIcons();
    state.selectedIcon = state.icons[0] || '📱';

    $('#item-purchase-date').value = new Date().toISOString().split('T')[0];
    $('#current-icon').textContent = state.selectedIcon;

    bindEvents();
    renderAll();
}

document.addEventListener('DOMContentLoaded', init);
