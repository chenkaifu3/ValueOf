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

// ===== 应用状态 =====
let state = {
    items: [],
    currentCategory: 'all',
    editingItemId: null,
    syncConfig: null,
    currentSort: { field: 'purchaseDate', order: 'desc' },
    currentPhoto: null // Base64 encoded photo
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
    return Math.max(diffDays, 1); // 最少1天
}

function calculateDaily(item) {
    if (item.calcMethod === 'none') {
        return null;
    }

    if (item.calcMethod === 'count') {
        return item.usageCount > 0 ? item.price / item.usageCount : null;
    }

    // 默认按时间计算
    const days = calculateDays(item.purchaseDate, item.retireDate);
    return item.price / days;
}

function showToast(message, type = 'success') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// ===== 数据持久化 =====
const Storage = {
    ITEMS_KEY: 'valueof_items',
    SYNC_KEY: 'valueof_sync_config',

    loadItems() {
        try {
            const data = localStorage.getItem(this.ITEMS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('加载数据失败:', e);
            return [];
        }
    },

    saveItems(items) {
        try {
            localStorage.setItem(this.ITEMS_KEY, JSON.stringify(items));
            return true;
        } catch (e) {
            console.error('保存数据失败:', e);
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

        if (sortOrder === 'asc') {
            return valueA - valueB;
        } else {
            return valueB - valueA;
        }
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

    const dailyValues = filteredItems
        .map(item => calculateDaily(item))
        .filter(v => v !== null);
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

    // 应用排序
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
        const daysText = item.retireDate
            ? `已使用 ${days} 天`
            : `使用中 ${days} 天`;

        // 如果有照片，显示照片；否则显示图标
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

function renderAll() {
    renderSummary();
    renderCategoryTabs();
    renderItemsList();
    renderSyncStatus();
    renderSortMenu();
}

// ===== 表单处理 =====
function resetForm() {
    $('#item-form').reset();
    $('#item-purchase-date').value = new Date().toISOString().split('T')[0];
    state.editingItemId = null;
    state.currentPhoto = null;
    $('#add-page-title').textContent = '添加物品';

    // 重置图标选择
    $$('.icon-option').forEach((opt, i) => {
        opt.classList.toggle('selected', i === 0);
    });

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

    // 选择图标
    $$('.icon-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.icon === item.icon);
    });

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
    const selectedIcon = $('.icon-option.selected');

    return {
        name: $('#item-name').value.trim(),
        category: $('#item-category').value,
        icon: selectedIcon ? selectedIcon.dataset.icon : '📦',
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

    if (!data.name) {
        showToast('请输入物品名称', 'error');
        return false;
    }

    if (!data.category) {
        showToast('请选择分类', 'error');
        return false;
    }

    if (!data.price || data.price <= 0) {
        showToast('请输入有效的购买价格', 'error');
        return false;
    }

    if (!data.purchaseDate) {
        showToast('请选择购买日期', 'error');
        return false;
    }

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
        const newItem = {
            id: generateId(),
            ...data
        };
        state.items.unshift(newItem);
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

    // 压缩图片
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // 压缩到最大 300x300
            const canvas = document.createElement('canvas');
            const maxSize = 300;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // 转换为 Base64
            state.currentPhoto = canvas.toDataURL('image/jpeg', 0.7);

            // 显示预览
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
            syncedAt: new Date().toISOString(),
            version: '1.0.0'
        }, null, 2);

        let response;

        if (gistId) {
            // 更新现有 Gist
            response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    files: {
                        'valueof_data.json': { content }
                    }
                })
            });
        } else {
            // 创建新 Gist
            response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    description: 'ValueOf App Data Backup',
                    public: false,
                    files: {
                        'valueof_data.json': { content }
                    }
                })
            });
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // 保存配置
        state.syncConfig = { token, gistId: data.id };
        Storage.saveSyncConfig(state.syncConfig);

        // 更新界面
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

    if (!token) {
        showToast('请输入 GitHub Token', 'error');
        return;
    }

    if (!gistId) {
        showToast('请输入 Gist ID', 'error');
        return;
    }

    showToast('正在拉取...');

    try {
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const gist = await response.json();
        const file = gist.files['valueof_data.json'];

        if (!file) {
            throw new Error('Gist 中没有找到数据文件');
        }

        const data = JSON.parse(file.content);

        if (!data.items || !Array.isArray(data.items)) {
            throw new Error('无效的数据格式');
        }

        state.items = data.items;
        Storage.saveItems(state.items);

        // 保存配置
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
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
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

function importData(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.items || !Array.isArray(data.items)) {
                throw new Error('无效的数据格式');
            }

            state.items = data.items;
            Storage.saveItems(state.items);
            renderAll();
            showToast(`成功导入 ${data.items.length} 件物品`);
        } catch (err) {
            showToast('导入失败: ' + err.message, 'error');
        }
    };

    reader.onerror = () => {
        showToast('读取文件失败', 'error');
    };

    reader.readAsText(file);
}

// ===== 事件绑定 =====
function bindEvents() {
    // 底部导航
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            navigateTo(item.dataset.page);
        });
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

    // 分类筛选按钮（顶部卡片）
    $('#category-filter-btn').addEventListener('click', () => {
        const categories = Object.keys(CATEGORIES);
        const currentIndex = categories.indexOf(state.currentCategory);
        const nextIndex = (currentIndex + 1) % categories.length;
        state.currentCategory = categories[nextIndex];
        renderAll();
    });

    // 排序按钮
    $('#sort-btn').addEventListener('click', () => {
        const sortMenu = $('#sort-menu');
        const sortBtn = $('#sort-btn');
        sortMenu.classList.toggle('active');
        sortBtn.classList.toggle('active');
    });

    // 排序选项
    $$('.sort-option').forEach(opt => {
        opt.addEventListener('click', () => {
            state.currentSort = {
                field: opt.dataset.sort,
                order: opt.dataset.order
            };
            renderAll();
            $('#sort-menu').classList.remove('active');
            $('#sort-btn').classList.remove('active');
        });
    });

    // 图标选择
    $('#icon-picker').addEventListener('click', (e) => {
        const option = e.target.closest('.icon-option');
        if (option) {
            $$('.icon-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
        }
    });

    // 照片上传
    $('#photo-upload-btn').addEventListener('click', () => {
        $('#item-photo').click();
    });

    $('#item-photo').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handlePhotoSelect(file);
        }
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
            const itemId = card.dataset.id;
            const item = state.items.find(i => i.id === itemId);
            if (item) {
                populateForm(item);
                navigateTo('add');
            }
        }
    });

    // 长按删除（使用右键作为替代）
    $('#items-list').addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const card = e.target.closest('.item-card');
        if (card) {
            showDeleteModal(card.dataset.id);
        }
    });

    // 删除确认
    $('#delete-confirm').addEventListener('click', confirmDelete);
    $('#delete-cancel').addEventListener('click', hideDeleteModal);

    // 同步设置
    $('#sync-btn').addEventListener('click', showSyncModal);
    $('#sync-cancel').addEventListener('click', hideSyncModal);
    $('#sync-save').addEventListener('click', uploadToGist);
    $('#sync-download').addEventListener('click', downloadFromGist);

    // 点击遮罩关闭弹窗
    $$('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
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

    // 导入
    $('#import-btn').addEventListener('click', () => {
        $('#import-file').click();
    });

    $('#import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importData(file);
            e.target.value = '';
        }
    });
}

// ===== 初始化 =====
function init() {
    // 加载数据
    state.items = Storage.loadItems();
    state.syncConfig = Storage.loadSyncConfig();

    // 设置默认日期
    $('#item-purchase-date').value = new Date().toISOString().split('T')[0];

    // 绑定事件
    bindEvents();

    // 渲染界面
    renderAll();
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
