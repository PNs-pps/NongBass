const $ = (sel) => document.querySelector(sel);

const ORDERS_KEY = 'ws_orders_v1';
const MENU_KEY = 'ws_menu_status_v1';
const LAST_ORDER_KEY = 'ws_last_order';

const state = {
  activeCategory: 'juice',
  cart: [],
  modalItem: null,
  sweetChoice: '50',
  qty: 1,
};

const orderModal = $('#orderModal');
const cartModal = $('#cartModal');
const menuTabs = $('#menuTabs');
const menuGrid = $('#menuGrid');
const cartItemsEl = $('#cartItems');
const cartTotalEl = $('#cartTotal');
const cartQtyEl = $('#cartQty');
const cartSummary = $('#cartSummary');
const cartActions = $('#cartActions');
const cartStep = $('#cartStep');
const checkoutStep = $('#checkoutStep');
const orderReviewEl = $('#orderReview');
const cartCountEl = $('#cartCount');
const checkoutForm = $('#checkoutForm');
const checkoutSuccess = $('#checkoutSuccess');
const checkoutSuccessText = $('#checkoutSuccessText');
const qrBox = $('#qrBox');
const toastEl = $('#toast');

let toastTimer = null;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ---------- Storage helpers ---------- */
function loadMenuStatus() {
  try {
    return JSON.parse(localStorage.getItem(MENU_KEY)) || {};
  } catch {
    return {};
  }
}

function isAvailable(name) {
  return loadMenuStatus()[name] !== false;
}

function loadOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveOrder(order) {
  const list = loadOrders();
  list.unshift(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
}

function makeOrderId() {
  return 'WS' + Date.now().toString().slice(-6);
}

/* ---------- Tabs + Menu grid ---------- */
function renderTabs() {
  menuTabs.innerHTML = '';
  MENUS.forEach((m) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab' + (m.id === state.activeCategory ? ' active' : '');
    b.textContent = `${m.icon} ${m.title}`;
    b.addEventListener('click', () => {
      state.activeCategory = m.id;
      renderTabs();
      renderGrid();
    });
    menuTabs.appendChild(b);
  });
}

function renderGrid() {
  const m = MENUS.find((x) => x.id === state.activeCategory);
  const items = m.items.filter((item) => isAvailable(item.name));
  menuGrid.innerHTML = '';

  if (items.length === 0) {
    menuGrid.innerHTML = '<p class="menu-empty">ขออภัย หมวดนี้ปิดชั่วคราว 🙏</p>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'menu-card' + (item.recommended ? ' recommended' : '');
    card.innerHTML = `
      ${item.recommended ? '<span class="badge">⭐ เมนูแนะนำ</span>' : ''}
      <div class="menu-visual" style="--hue: ${item.hue}">
        <span class="menu-emoji floaty">${item.emoji}</span>
        <span class="garnish">${item.garnish}</span>
        <span class="bubble b1"></span><span class="bubble b2"></span><span class="bubble b3"></span>
      </div>
      <h3>${item.name}</h3>
      <p class="desc">${item.desc || ''}</p>
      <div class="menu-footer">
        <span class="price">${item.price} <small>บาท</small></span>
        <button type="button" class="order-btn">สั่งสินค้า</button>
      </div>
    `;
    card.querySelector('.order-btn').addEventListener('click', () => openOrder(item));
    menuGrid.appendChild(card);
  });
}

/* ---------- Order popup ---------- */
function selectSweet(choice) {
  state.sweetChoice = choice;
  document.querySelectorAll('.sweetness-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.sweet === choice);
  });
  const custom = $('#customSweet');
  if (choice === 'custom') {
    custom.classList.remove('hidden');
    custom.focus();
  } else {
    custom.classList.add('hidden');
    custom.value = '';
  }
}

function setQty(n) {
  state.qty = Math.max(1, n);
  $('#qtyValue').textContent = state.qty;
}

function openOrder(item) {
  state.modalItem = item;
  $('#orderModalTitle').textContent = item.name;
  $('#modalPrice').textContent = `${item.price} บาท`;
  $('#modalDesc').textContent = item.desc || '';
  $('#modalEmoji').textContent = item.emoji;
  $('#modalGarnish').textContent = item.garnish;
  $('#modalVisual').style.setProperty('--hue', item.hue);
  selectSweet('50');
  setQty(1);
  orderModal.classList.add('open');
  orderModal.setAttribute('aria-hidden', 'false');
}

function closeOrder() {
  orderModal.classList.remove('open');
  orderModal.setAttribute('aria-hidden', 'true');
}

function getSweetLabel() {
  if (state.sweetChoice === 'custom') {
    const raw = $('#customSweet').value.trim();
    const num = Number(raw);
    if (raw === '' || Number.isNaN(num) || num < 0 || num > 200) return null;
    return `${num}% (ระบุเอง)`;
  }
  return `${state.sweetChoice}%`;
}

function addToCart() {
  const item = state.modalItem;
  if (!item) return;
  const sweet = getSweetLabel();
  if (!sweet) {
    toast('กรุณาระบุความหวานให้ถูกต้อง (0–200%)');
    return;
  }
  const existing = state.cart.find((c) => c.name === item.name && c.sweet === sweet);
  if (existing) {
    existing.qty += state.qty;
  } else {
    state.cart.push({
      name: item.name,
      price: item.price,
      emoji: item.emoji,
      sweet,
      qty: state.qty,
    });
  }
  updateCartBadge();
  toast(`เพิ่ม "${item.name}" ลงตะกร้าแล้ว (ความหวาน ${sweet})`);
  closeOrder();
}

/* ---------- Cart ---------- */
function updateCartBadge() {
  const count = state.cart.reduce((sum, c) => sum + c.qty, 0);
  cartCountEl.textContent = count;
  cartCountEl.classList.toggle('hidden', count === 0);
}

function cartTotal() {
  return state.cart.reduce((sum, c) => sum + c.price * c.qty, 0);
}

function renderCart() {
  cartItemsEl.innerHTML = '';
  cartItemsEl.classList.remove('hidden');
  const count = state.cart.reduce((sum, c) => sum + c.qty, 0);
  cartQtyEl.textContent = `${count} ชิ้น`;
  cartTotalEl.textContent = `${cartTotal()} บาท`;

  if (state.cart.length === 0) {
    cartItemsEl.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p>ยังไม่มีสินค้าในตะกร้า</p>
        <button type="button" class="btn btn-ghost btn-sm go-menu-btn">ไปเลือกเมนู</button>
      </div>`;
    checkoutForm.classList.add('hidden');
    cartSummary.classList.add('hidden');
  } else {
    checkoutForm.classList.remove('hidden');
    cartSummary.classList.remove('hidden');
    state.cart.forEach((c, idx) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <span class="cart-item-emoji">${c.emoji}</span>
        <div class="cart-item-info">
          <strong>${c.name}</strong>
          <small>ความหวาน ${c.sweet}</small>
          <div class="cart-item-qty">
            <button type="button" data-act="dec" data-idx="${idx}" aria-label="ลด">&minus;</button>
            <span>${c.qty}</span>
            <button type="button" data-act="inc" data-idx="${idx}" aria-label="เพิ่ม">+</button>
          </div>
        </div>
        <div class="cart-item-right">
          <span class="cart-item-price">${c.price * c.qty} ฿</span>
          <button type="button" class="cart-item-remove" data-act="remove" data-idx="${idx}" aria-label="ลบ">&times;</button>
        </div>
      `;
      cartItemsEl.appendChild(row);
    });
  }

  cartActions.classList.toggle('hidden', state.cart.length === 0);
}

function showStep(step) {
  cartStep.classList.toggle('hidden', step !== 'cart');
  checkoutStep.classList.toggle('hidden', step !== 'checkout');
  const modalBox = document.querySelector('.cart-modal');
  if (modalBox) modalBox.scrollTop = 0;
}

function renderOrderReview() {
  const rows = state.cart
    .map(
      (c) => `<div class="order-review-row"><span>${c.name} × ${c.qty}</span><strong>${c.price * c.qty} บาท</strong></div>`
    )
    .join('');
  orderReviewEl.innerHTML = `${rows}<div class="order-review-row total"><span>ยอดรวม</span><span>${cartTotal()} บาท</span></div>`;
}

function openCart() {
  checkoutSuccess.classList.add('hidden');
  showStep('cart');
  renderCart();
  cartModal.classList.add('open');
  cartModal.setAttribute('aria-hidden', 'false');
}

function closeCart() {
  cartModal.classList.remove('open');
  cartModal.setAttribute('aria-hidden', 'true');
}

/* ---------- Map (Google Maps preview) ---------- */
function updateMapPreview() {
  const q = $('#coAddress').value.trim();
  if (!q) {
    toast('กรุณากรอกที่อยู่ก่อนดูแผนที่');
    return;
  }
  $('#mapFrame').src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  $('#openMapLink').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  $('#mapPreview').classList.remove('hidden');
}

/* ---------- Order tracking (buyer) ---------- */
const STATUS_LABELS = { new: 'ใหม่', preparing: 'กำลังทำ', done: 'เสร็จสิ้น', cancelled: 'ยกเลิก' };
const TRACK_STEPS = ['new', 'preparing', 'done'];

let trackedOrder = null;
let trackTimer = null;
let lastOrder = null;

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function findOrder(id, phone) {
  const key = String(id || '').trim().toLowerCase().replace(/^#/, '');
  if (!key) return null;
  const order = loadOrders().find((o) => String(o.id).toLowerCase() === key);
  if (!order) return null;
  if (normalizePhone(order.phone) !== normalizePhone(phone)) return null;
  return order;
}

function orderHistory(order) {
  if (Array.isArray(order.statusHistory) && order.statusHistory.length > 0) {
    return order.statusHistory;
  }
  const history = [{ status: 'new', at: order.createdAt || new Date().toISOString() }];
  if (order.status && order.status !== 'new') {
    history.push({ status: order.status, at: order.updatedAt || order.createdAt || new Date().toISOString() });
  }
  return history;
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function openTrack(prefill) {
  const modal = $('#trackModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  $('#trackError').classList.add('hidden');

  if (prefill && prefill.id && prefill.phone) {
    $('#trackId').value = prefill.id;
    $('#trackPhone').value = prefill.phone;
    checkTracking();
  } else if (lastOrder) {
    $('#trackId').value = lastOrder.id;
    $('#trackPhone').value = lastOrder.phone;
    checkTracking();
  }

  clearInterval(trackTimer);
  trackTimer = setInterval(() => {
    if (!modal.classList.contains('open') || !trackedOrder) return;
    const order = findOrder(trackedOrder.id, trackedOrder.phone);
    if (order) renderTrackedOrder(order);
  }, 5000);
}

function closeTrack() {
  const modal = $('#trackModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  clearInterval(trackTimer);
  trackTimer = null;
}

function checkTracking() {
  const id = $('#trackId').value;
  const phone = $('#trackPhone').value;
  const order = findOrder(id, phone);

  if (!order) {
    trackedOrder = null;
    $('#trackError').classList.remove('hidden');
    $('#trackResult').classList.add('hidden');
    return;
  }

  trackedOrder = { id: order.id, phone: order.phone };
  $('#trackError').classList.add('hidden');
  renderTrackedOrder(order);
}

function renderTrackedOrder(order) {
  const history = orderHistory(order);
  const status = order.status || 'new';
  const isCancelled = status === 'cancelled';

  const steps = isCancelled
    ? history
    : TRACK_STEPS.map((s) => {
        const hit = history.find((h) => h.status === s);
        return { status: s, at: hit ? hit.at : null, reached: Boolean(hit) };
      });

  const timeline = steps
    .map((step) => {
      const isCurrent = step.status === status;
      const reached = isCancelled ? true : step.reached;
      const cls = [
        'timeline-step',
        reached ? 'done' : '',
        isCurrent ? 'current' : '',
        step.status === 'cancelled' ? 'is-cancelled' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const dot = reached ? (isCurrent ? '●' : '✓') : '○';
      const time = step.at ? formatDateTime(step.at) : 'รอดำเนินการ';
      return `<div class="${cls}">
        <span class="timeline-dot">${dot}</span>
        <div class="timeline-info">
          <strong>${STATUS_LABELS[step.status] || step.status}</strong>
          <small>${time}</small>
        </div>
      </div>`;
    })
    .join('');

  const items = (order.items || [])
    .map((it) => `<li><span>${it.name} × ${it.qty}</span><strong>${it.price * it.qty} ฿</strong></li>`)
    .join('');

  const fulfill = order.fulfillment === 'delivery' ? '🛵 จัดส่ง' : '🏠 รับหน้าร้าน';
  const pay = order.payment === 'transfer' ? '🏦 โอนเงิน' : '💵 เงินสด';

  $('#trackResult').innerHTML = `
    <div class="track-card">
      <div class="track-head">
        <div>
          <strong>#${order.id}</strong>
          <span class="track-date">สั่งเมื่อ ${formatDateTime(order.createdAt)}</span>
        </div>
        <span class="track-badge is-${status}">${STATUS_LABELS[status] || status}</span>
      </div>
      <ul class="order-items">${items}</ul>
      <div class="track-summary">
        <span>${fulfill}</span>
        <span>${pay}</span>
        <strong>รวม ${order.total} ฿</strong>
      </div>
      <div class="timeline">${timeline}</div>
      <p class="track-hint">🔄 อัปเดตสถานะอัตโนมัติทุก 5 วินาที</p>
    </div>`;
  $('#trackResult').classList.remove('hidden');
}

/* ---------- Events ---------- */
$('#navPay').addEventListener('click', openCart);
$('#cartFab').addEventListener('click', openCart);

$('#toCheckout').addEventListener('click', () => {
  if (state.cart.length === 0) {
    toast('ตะกร้าว่างอยู่');
    return;
  }
  renderOrderReview();
  showStep('checkout');
});

$('#backToCart').addEventListener('click', () => showStep('cart'));

document.getElementById('modalClose').addEventListener('click', closeOrder);
orderModal.addEventListener('click', (e) => {
  if (e.target === orderModal) closeOrder();
});

document.querySelectorAll('.sweetness-btn').forEach((b) => {
  b.addEventListener('click', () => selectSweet(b.dataset.sweet));
});

$('#qtyMinus').addEventListener('click', () => setQty(state.qty - 1));
$('#qtyPlus').addEventListener('click', () => setQty(state.qty + 1));
$('#addToCartBtn').addEventListener('click', addToCart);

$('#cartClose').addEventListener('click', closeCart);
cartModal.addEventListener('click', (e) => {
  if (e.target === cartModal) closeCart();
});

cartItemsEl.addEventListener('click', (e) => {
  if (e.target.closest('.go-menu-btn')) {
    closeCart();
    document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  if (btn.dataset.act === 'inc') {
    state.cart[idx].qty += 1;
  } else if (btn.dataset.act === 'dec') {
    state.cart[idx].qty -= 1;
    if (state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
  } else if (btn.dataset.act === 'remove') {
    state.cart.splice(idx, 1);
  }
  updateCartBadge();
  renderCart();
});

document.querySelectorAll('input[name="payment"]').forEach((r) => {
  r.addEventListener('change', () => {
    qrBox.classList.toggle('hidden', r.value !== 'transfer');
  });
});

function syncFulfillmentUI() {
  const isDelivery = document.querySelector('input[name="fulfillment"]:checked').value === 'delivery';
  $('#addressGroup').classList.toggle('hidden', !isDelivery);
  $('#coAddress').required = isDelivery;
}

document.querySelectorAll('input[name="fulfillment"]').forEach((r) => {
  r.addEventListener('change', syncFulfillmentUI);
});

$('#previewMapBtn').addEventListener('click', updateMapPreview);

/* ---------- Tracking events ---------- */
$('#navTrack').addEventListener('click', (e) => {
  e.preventDefault();
  openTrack();
});
$('#trackClose').addEventListener('click', closeTrack);
$('#trackModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeTrack();
});
$('#trackForm').addEventListener('submit', (e) => {
  e.preventDefault();
  checkTracking();
});
$('#trackFromSuccess').addEventListener('click', () => {
  closeCart();
  let saved = lastOrder;
  if (!saved) {
    try {
      saved = JSON.parse(localStorage.getItem(LAST_ORDER_KEY));
    } catch {
      saved = null;
    }
  }
  openTrack(saved);
});

/* ---------- Checkout ---------- */
checkoutForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (state.cart.length === 0) {
    toast('ตะกร้าว่างอยู่');
    return;
  }
  const name = $('#coName').value.trim();
  const phone = $('#coPhone').value.trim();
  const address = $('#coAddress').value.trim();
  const mapLink = $('#coMapLink').value.trim();
  const payment = document.querySelector('input[name="payment"]:checked').value;
  const fulfillment = document.querySelector('input[name="fulfillment"]:checked').value;
  const isDelivery = fulfillment === 'delivery';

  if (!name || !phone) {
    toast('กรุณากรอกชื่อและเบอร์โทร');
    return;
  }
  if (isDelivery && !address) {
    toast('กรุณากรอกที่อยู่จัดส่ง');
    return;
  }

  const total = cartTotal();
  const createdAt = new Date().toISOString();
  const order = {
    id: makeOrderId(),
    createdAt,
    name,
    phone,
    fulfillment,
    address: isDelivery ? address : '',
    mapLink: isDelivery ? mapLink : '',
    payment,
    items: state.cart.map((c) => ({ name: c.name, price: c.price, qty: c.qty, sweet: c.sweet })),
    total,
    status: 'new',
    statusHistory: [{ status: 'new', at: createdAt }],
  };
  saveOrder(order);

  lastOrder = { id: order.id, phone };
  localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(lastOrder));

  const payText = payment === 'transfer' ? 'โอนเงิน (สแกน QR)' : 'ชำระเงินสด';
  checkoutSuccessText.textContent = `ขอบคุณ ${name}! เลขที่คำสั่งซื้อ #${order.id} · ยอดรวม ${total} บาท · ชำระเงิน${payText} · ${isDelivery ? 'จัดส่ง' : 'รับหน้าร้าน'}`;
  checkoutSuccess.classList.remove('hidden');
  cartStep.classList.add('hidden');
  checkoutStep.classList.add('hidden');

  state.cart = [];
  updateCartBadge();
});

$('#checkoutDone').addEventListener('click', () => {
  checkoutSuccess.classList.add('hidden');
  checkoutForm.reset();
  qrBox.classList.remove('hidden');
  $('#mapPreview').classList.add('hidden');
  $('#mapFrame').src = '';
  syncFulfillmentUI();
  showStep('cart');
  closeCart();
});

/* ---------- Sync when seller changes menu / order status ---------- */
window.addEventListener('storage', (e) => {
  if (e.key === MENU_KEY) renderGrid();
  if (e.key === ORDERS_KEY && trackedOrder && $('#trackModal').classList.contains('open')) {
    const order = findOrder(trackedOrder.id, trackedOrder.phone);
    if (order) renderTrackedOrder(order);
  }
});

/* ---------- Init ---------- */
try {
  lastOrder = JSON.parse(localStorage.getItem(LAST_ORDER_KEY)) || null;
} catch {
  lastOrder = null;
}

renderTabs();
renderGrid();
updateCartBadge();
syncFulfillmentUI();
