const PIN = '1234'; // เปลี่ยน PIN ผู้ขายได้ที่นี่
const ORDERS_KEY = 'ws_orders_v1';
const MENU_KEY = 'ws_menu_status_v1';
const STATUS_LABELS = { new: 'ใหม่', preparing: 'กำลังทำ', done: 'เสร็จสิ้น', cancelled: 'ยกเลิก' };

const $ = (s) => document.querySelector(s);
const gate = $('#pinGate');
const pinForm = $('#pinForm');
const pinInput = $('#pinInput');
const pinError = $('#pinError');
const orderList = $('#orderList');

let filter = 'all';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function loadOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function loadMenuStatus() {
  try {
    return JSON.parse(localStorage.getItem(MENU_KEY)) || {};
  } catch {
    return {};
  }
}

/* ---------- Auth ---------- */
function isAuthed() {
  return sessionStorage.getItem('ws_admin_auth') === '1';
}

function initAuth() {
  gate.classList.toggle('open', !isAuthed());
}

pinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (pinInput.value.trim() === PIN) {
    sessionStorage.setItem('ws_admin_auth', '1');
    gate.classList.remove('open');
    pinError.classList.add('hidden');
    pinInput.value = '';
    renderAll();
    renderMenuAdmin();
  } else {
    pinError.classList.remove('hidden');
    pinInput.value = '';
    pinInput.focus();
  }
});

$('#logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('ws_admin_auth');
  location.reload();
});

/* ---------- Order status history ---------- */
function getHistory(order) {
  if (Array.isArray(order.statusHistory) && order.statusHistory.length > 0) {
    return order.statusHistory;
  }
  const history = [{ status: 'new', at: order.createdAt || new Date().toISOString() }];
  if (order.status && order.status !== 'new') {
    history.push({ status: order.status, at: order.updatedAt || order.createdAt || new Date().toISOString() });
  }
  return history;
}

function ensureHistory(order) {
  if (!Array.isArray(order.statusHistory) || order.statusHistory.length === 0) {
    order.statusHistory = getHistory(order);
  }
  return order.statusHistory;
}

function setOrderStatus(id, newStatus) {
  const orders = loadOrders();
  const order = orders.find((o) => o.id === id);
  if (!order || order.status === newStatus) return;

  const history = ensureHistory(order);
  const now = new Date().toISOString();
  order.status = newStatus;
  order.updatedAt = now;
  history.push({ status: newStatus, at: now });

  saveOrders(orders);
  renderAll();
}

function undoOrderStatus(id) {
  const orders = loadOrders();
  const order = orders.find((o) => o.id === id);
  if (!order) return;

  const history = ensureHistory(order);
  if (history.length < 2) return;

  history.pop();
  const previous = history[history.length - 1];
  order.status = previous.status;
  order.updatedAt = previous.at;

  saveOrders(orders);
  renderAll();
}

/* ---------- Stats ---------- */
function renderStats() {
  const orders = loadOrders();
  $('#statTotal').textContent = orders.length;
  $('#statNew').textContent = orders.filter((o) => o.status === 'new').length;
  const revenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  $('#statRevenue').textContent = `${revenue.toLocaleString('th-TH')} ฿`;
}

/* ---------- Daily sales summary ---------- */
let summaryDay = localDateKey(new Date());

function localDateKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDay(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function updateDayChips() {
  $('#dayToday').classList.toggle('active', summaryDay === shiftDay(0));
  $('#dayYesterday').classList.toggle('active', summaryDay === shiftDay(-1));
}

function setSummaryDay(day) {
  summaryDay = day;
  $('#summaryDate').value = day;
  renderDaily();
  updateDayChips();
}

function renderDaily() {
  const orders = loadOrders().filter((o) => localDateKey(o.createdAt) === summaryDay);
  const valid = orders.filter((o) => o.status !== 'cancelled');
  const cancelled = orders.length - valid.length;

  const revenue = valid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const avg = valid.length ? Math.round(revenue / valid.length) : 0;
  const cash = valid
    .filter((o) => o.payment === 'cash')
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const transfer = revenue - cash;
  const pickup = valid.filter((o) => o.fulfillment !== 'delivery').length;
  const delivery = valid.length - pickup;

  const itemMap = new Map();
  valid.forEach((o) => {
    (o.items || []).forEach((it) => {
      const qty = Number(it.qty) || 0;
      const row = itemMap.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
      row.qty += qty;
      row.revenue += (Number(it.price) || 0) * qty;
      itemMap.set(it.name, row);
    });
  });
  const top = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);

  $('#dailyGrid').innerHTML = `
    <div class="daily-card"><span>ยอดขายรวม</span><strong>${revenue.toLocaleString('th-TH')} ฿</strong><small>ไม่รวมออเดอร์ยกเลิก</small></div>
    <div class="daily-card"><span>ออเดอร์สำเร็จ</span><strong>${valid.length}</strong><small>ยกเลิก ${cancelled} ออเดอร์</small></div>
    <div class="daily-card"><span>เฉลี่ย / ออเดอร์</span><strong>${avg.toLocaleString('th-TH')} ฿</strong></div>
    <div class="daily-card"><span>เงินสด / โอนเงิน</span><strong>${cash.toLocaleString('th-TH')} / ${transfer.toLocaleString('th-TH')} ฿</strong></div>
    <div class="daily-card"><span>รับหน้าร้าน / จัดส่ง</span><strong>${pickup} / ${delivery}</strong></div>
  `;

  $('#dailyTop').innerHTML = top.length
    ? `<h3>🏆 เมนูขายดีของวัน</h3>
       <ol>${top
         .map(
           (t) =>
             `<li>${esc(t.name)} — <strong>${t.qty} แก้ว</strong> <small>(${t.revenue.toLocaleString('th-TH')} ฿)</small></li>`
         )
         .join('')}</ol>`
    : '<p class="daily-empty">ยังไม่มียอดขายในวันนี้</p>';

  $('#summaryDate').value = summaryDay;
  updateDayChips();
}

$('#dayToday').addEventListener('click', () => setSummaryDay(shiftDay(0)));
$('#dayYesterday').addEventListener('click', () => setSummaryDay(shiftDay(-1)));
$('#summaryDate').addEventListener('change', () => {
  if ($('#summaryDate').value) setSummaryDay($('#summaryDate').value);
});

/* ---------- Orders ---------- */
function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function orderCard(o) {
  const items = (o.items || [])
    .map(
      (it) =>
        `<li><span>${esc(it.name)} × ${it.qty}${it.sweet ? ` · หวาน ${esc(it.sweet)}` : ''}</span><strong>${it.price * it.qty} ฿</strong></li>`
    )
    .join('');

  const fulfill = o.fulfillment === 'delivery' ? '🛵 จัดส่ง' : '🏠 รับที่ร้าน';
  const pay = o.payment === 'transfer' ? '🏦 โอนเงิน (QR)' : '💵 เงินสด';
  const mapAnchor =
    o.mapLink && /^https?:\/\//i.test(o.mapLink)
      ? ` <a href="${esc(o.mapLink)}" target="_blank" rel="noopener">📍 เปิดตำแหน่ง</a>`
      : '';
  const address =
    o.fulfillment === 'delivery' ? `<div>ที่อยู่: ${esc(o.address || '-')}${mapAnchor}</div>` : '';
  const updated = o.updatedAt
    ? `<div class="order-update">อัปเดตล่าสุด: ${formatTime(o.updatedAt)}</div>`
    : '';

  const actions = [];
  if (o.status === 'new') {
    actions.push(`<button type="button" class="btn-preparing" data-status="preparing" data-id="${esc(o.id)}">รับออเดอร์</button>`);
  }
  if (o.status === 'new' || o.status === 'preparing') {
    actions.push(`<button type="button" class="btn-done" data-status="done" data-id="${esc(o.id)}">ทำเสร็จ</button>`);
    actions.push(`<button type="button" class="btn-cancel" data-status="cancelled" data-id="${esc(o.id)}">ยกเลิก</button>`);
  }
  if (getHistory(o).length > 1) {
    actions.push(`<button type="button" class="btn-undo" data-undo="${esc(o.id)}">↩︎ ย้อนสถานะ</button>`);
  }

  return `<article class="order-card">
    <div class="order-top">
      <span class="order-id">#${esc(o.id)}</span>
      <span class="status-badge status-${esc(o.status)}">${STATUS_LABELS[o.status] || esc(o.status)}</span>
      <span class="order-time">${formatTime(o.createdAt)}</span>
    </div>
    <div class="order-meta">
      <div>ผู้สั่ง: <strong>${esc(o.name)}</strong> · โทร ${esc(o.phone)}</div>
      <div>${fulfill} · ${pay}</div>
      ${address}
      ${updated}
    </div>
    <ul class="order-items">${items}</ul>
    <div class="order-bottom">
      <strong>รวม ${Number(o.total) || 0} ฿</strong>
      <div class="order-actions">${actions.join('')}</div>
    </div>
  </article>`;
}

function renderOrders() {
  const orders = loadOrders()
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((o) => filter === 'all' || o.status === filter);

  orderList.innerHTML = orders.length
    ? orders.map(orderCard).join('')
    : '<p class="order-empty">ยังไม่มีคำสั่งซื้อในหมวดนี้</p>';

  renderStats();
}

orderList.addEventListener('click', (e) => {
  const undoBtn = e.target.closest('button[data-undo]');
  if (undoBtn) {
    undoOrderStatus(undoBtn.dataset.undo);
    return;
  }

  const btn = e.target.closest('button[data-status]');
  if (!btn) return;

  const nextStatus = btn.dataset.status;
  if (nextStatus === 'cancelled') {
    const ok = window.confirm(`ยืนยันยกเลิกคำสั่งซื้อ #${btn.dataset.id}?`);
    if (!ok) return;
  }

  setOrderStatus(btn.dataset.id, nextStatus);
});

document.querySelectorAll('#orderFilters .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    filter = chip.dataset.filter;
    document.querySelectorAll('#orderFilters .chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderOrders();
  });
});

/* ---------- Menu management ---------- */
function renderMenuAdmin() {
  const status = loadMenuStatus();
  const wrap = $('#menuAdmin');

  wrap.innerHTML = MENUS.map((m) => {
    const rows = m.items
      .map((item) => {
        const on = status[item.name] !== false;
        return `<div class="menu-row">
          <div><span class="name">${esc(item.name)}</span><span class="price">${item.price} ฿</span></div>
          <div class="row-right">
            <span class="menu-state">${on ? 'เปิดขาย' : 'ปิดอยู่'}</span>
            <label class="switch">
              <input type="checkbox" data-menu="${esc(item.name)}" ${on ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          </div>
        </div>`;
      })
      .join('');

    return `<div class="menu-group"><h3>${esc(m.icon)} ${esc(m.title)}</h3>${rows}</div>`;
  }).join('');

  wrap.querySelectorAll('input[data-menu]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const st = loadMenuStatus();
      if (cb.checked) {
        delete st[cb.dataset.menu];
      } else {
        st[cb.dataset.menu] = false;
      }
      localStorage.setItem(MENU_KEY, JSON.stringify(st));
      cb.closest('.menu-row').querySelector('.menu-state').textContent = cb.checked ? 'เปิดขาย' : 'ปิดอยู่';
    });
  });
}

/* ---------- Tabs ---------- */
document.querySelectorAll('.admin-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.toggle('active', t === tab));
    $('#ordersPanel').classList.toggle('hidden', tab.dataset.tab !== 'orders');
    $('#menusPanel').classList.toggle('hidden', tab.dataset.tab !== 'menus');
    if (tab.dataset.tab === 'menus') renderMenuAdmin();
  });
});

function renderAll() {
  renderOrders();
  renderDaily();
}

/* ---------- Init ---------- */
initAuth();
renderAll();
renderMenuAdmin();
