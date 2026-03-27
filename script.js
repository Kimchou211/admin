// ============================================================
//  គ្រប់គ្រងអាជីវកម្ម - Business Management System
// ============================================================

// ===== DATA STORE =====
// កំណត់ផ្លូវទៅកាន់រូបភាព QR Code របស់អ្នក (ដាក់រូបភាពក្នុង folder គម្រោងរបស់អ្នក)
const PAYMENT_QR_PATH = 'assets/my-qr.jpg'; 

let customers = [];
let products  = [];
let transactions = [];
let orders    = [];
let debts     = [];

// ===== CHART INSTANCES =====
let lineChartInst = null;
let pieChartInst  = null;
let rLineInst     = null;
let rPieInst      = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  // Don't seed sample data - start with empty data
  setupNav();
  setupDarkMode();
  await loadAllData();
  document.getElementById('orderDate').valueAsDate = new Date();
  document.getElementById('txDate').valueAsDate    = new Date();
  document.getElementById('debtDate').valueAsDate  = new Date();
});

async function loadAllData() {
  try {
    const [cRes, pRes, tRes, oRes, dRes] = await Promise.all([
      fetch('api.php?action=get_customers').then(r => r.json()),
      fetch('api.php?action=get_products').then(r => r.json()),
      fetch('api.php?action=get_transactions').then(r => r.json()),
      fetch('api.php?action=get_orders').then(r => r.json()),
      fetch('api.php?action=get_debts').then(r => r.json())
    ]);
    
    // ត្រួតពិនិត្យ និងចម្រាញ់ទិន្នន័យដោយសុវត្ថិភាព (ការពារ Error .map)
    customers = Array.isArray(cRes) ? cRes.map(c => ({
      ...c,
      id: parseInt(c.id),
      profileImage: c.profile_image // ផ្គូផ្គងឈ្មោះពី Database មក JavaScript
    })) : [];

    products = Array.isArray(pRes) ? pRes.map(p => ({ id: p.id, name: p.name, cost: parseFloat(p.cost_price), price: parseFloat(p.sale_price), qty: parseInt(p.quantity) })) : [];
    transactions = Array.isArray(tRes) ? tRes.map(t => ({ ...t, amount: parseFloat(t.amount), date: t.transaction_date })) : [];
    orders = Array.isArray(oRes) ? oRes.map(o => ({ 
      ...o, 
      total: parseFloat(o.total_amount), 
      profit: parseFloat(o.total_profit), 
      date: o.order_date, 
      customerId: parseInt(o.customer_id),
      // បំប្លែងទិន្នន័យទំនិញក្នុងវិក្កយបត្រឱ្យត្រូវនឹងឈ្មោះដែល viewInvoice ប្រើ
      items: Array.isArray(o.items) ? o.items.map(it => ({ ...it, price: parseFloat(it.unit_price || 0), qty: parseInt(it.quantity || 0) })) : []
    })) : [];
    debts = Array.isArray(dRes) ? dRes.map(d => ({ ...d, amount: parseFloat(d.amount), date: d.debt_date, paid: d.status === 'paid' })) : [];
    
    if (cRes.error || pRes.error) toast('មានបញ្ហាក្នុងការទាញទិន្នន័យពី Database', 'error');
    renderDashboard();
  } catch (e) { console.error("Load failed", e); }
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// Clear all data function
function clearAllData() {
  if (!confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យទាំងអស់មែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ!')) return;
  
  customers = [];
  products = [];
  transactions = [];
  orders = [];
  debts = [];
  
  toast('លុបទិន្នន័យទាំងអស់ដោយជោគជ័យ', 'warning');
  
  // Re-render current page
  const activePage = document.querySelector('.page.active').id.replace('page-', '');
  if (activePage === 'dashboard') renderDashboard();
  if (activePage === 'transactions') renderTransactions();
  if (activePage === 'inventory') renderInventory();
  if (activePage === 'customers') renderCustomers();
  if (activePage === 'orders') renderOrders();
  if (activePage === 'debts') renderDebts();
  if (activePage === 'reports') renderReports();
}

// ===== NAVIGATION =====
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const page = el.dataset.page;
      navigateTo(page);
      if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
      closeMobileMenu();
    });
  });
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  const mobileBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const sidebarClose = document.getElementById('sidebarToggle');

  const toggleMenu = () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  };

  if (mobileBtn) mobileBtn.addEventListener('click', toggleMenu);
  if (overlay) overlay.addEventListener('click', toggleMenu);
  if (sidebarClose) sidebarClose.addEventListener('click', toggleMenu);
}

const pageTitles = {
  dashboard:    'ផ្ទាំងគ្រប់គ្រង',
  transactions: 'ចំណូល & ចំណាយ',
  inventory:    'ស្តុកទំនិញ',
  customers:    'អតិថិជន',
  orders:       'ការលក់',
  debts:        'បំណុល / ឥណទាន',
  reports:      'របាយការណ៍',
};

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  const navItem = document.querySelector(`[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.add('active');

  document.getElementById('pageTitle').textContent = pageTitles[page] || page;

  closeMobileMenu();

  if (page === 'dashboard')    renderDashboard();
  if (page === 'transactions') renderTransactions();
  if (page === 'inventory')    renderInventory();
  if (page === 'customers')    renderCustomers();
  if (page === 'orders')       renderOrders();
  if (page === 'debts')        renderDebts();
  if (page === 'reports')      renderReports();
}

function closeMobileMenu() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ===== DARK MODE =====
function setupDarkMode() {
  if (localStorage.getItem('bms_dark') === 'true') toggleDark(true);
  document.getElementById('darkToggle').addEventListener('click', () => toggleDark());
}

function toggleDark(force) {
  const isDark = force !== undefined ? force : !document.body.classList.contains('dark');
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('bms_dark', isDark);
  document.getElementById('darkIcon').textContent = isDark ? '☀️' : '🌙';
  document.getElementById('darkText').textContent = isDark ? 'ភ្លឺ'  : 'ងងឹត';
}

// ===== MODAL HELPERS =====
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Close on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ===== TOAST =====
function toast(msg, type = 'success') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => { t.style.animation = 'slideOut .25s ease forwards'; setTimeout(() => t.remove(), 250); }, 2800);
}

// ===== ANIMATED COUNTER =====
function animateCounter(el, target, prefix='$') {
  const start = 0, dur = 600;
  const step = t => {
    const val = Math.round(start + (target - start) * Math.min(t/dur, 1));
    el.textContent = prefix === '$' ? `$${val.toLocaleString()}` : val.toLocaleString();
    if (t < dur) requestAnimationFrame(ts => step(ts - raf0));
  };
  let raf0; requestAnimationFrame(ts => { raf0 = ts; step(0); });
}

// ===== DASHBOARD =====
function renderDashboard() {
  const inc  = transactions.filter(t => t.type === 'income').reduce((s,t)=>s+t.amount,0);
  const exp  = transactions.filter(t => t.type === 'expense').reduce((s,t)=>s+t.amount,0);
  const prof = inc - exp;

  const elI  = document.getElementById('totalIncome');
  const elE  = document.getElementById('totalExpense');
  const elP  = document.getElementById('totalProfit');
  const elC  = document.getElementById('totalCustomers');
  const elO  = document.getElementById('totalOrders');
  const elPr = document.getElementById('totalProducts');

  elI.textContent  = `$${inc.toLocaleString()}`;
  elE.textContent  = `$${exp.toLocaleString()}`;
  elP.textContent  = `$${prof.toLocaleString()}`;
  elP.style.color  = prof >= 0 ? 'var(--success)' : 'var(--danger)';
  elC.textContent  = customers.length;
  elO.textContent  = orders.length;
  elPr.textContent = products.length;

  renderDashboardRecent();
  updateDashboardCharts();
}

function renderDashboardRecent() {
  const txEl = document.getElementById('recentTransactions');
  const ordEl = document.getElementById('recentOrders');

  const recentTx = [...transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  txEl.innerHTML = recentTx.length ? recentTx.map(t => `
    <div class="recent-item">
      <span>${t.title}</span>
      <span class="tx-amount ${t.type}">${t.type==='income'?'+':'-'}$${t.amount.toFixed(2)}</span>
    </div>
  `).join('') : '<div class="empty-state"><div class="empty-state-text">មិនមានទិន្នន័យ</div></div>';

  const recentOrd = [...orders].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  ordEl.innerHTML = recentOrd.length ? recentOrd.map(o => {
    const c = customers.find(c=>c.id == o.customerId);
    return `<div class="recent-item">
      <span>${c?c.name:'មិនស្គាល់'}</span>
      <span class="tx-amount income">$${o.total.toFixed(2)}</span>
    </div>`;
  }).join('') : '<div class="empty-state"><div class="empty-state-text">មិនមានទិន្នន័យ</div></div>';
}

function updateDashboardCharts() {
  const days = parseInt(document.getElementById('chartPeriod').value || 30);
  const labels = [], incData = [], expData = [];
  const now = new Date();

  if (days <= 30) {
    for (let i = days-1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate()-i);
      const ds = d.toISOString().split('T')[0];
      labels.push(ds.slice(5));
      incData.push(transactions.filter(t=>t.type==='income' && t.date===ds).reduce((s,t)=>s+t.amount,0));
      expData.push(transactions.filter(t=>t.type==='expense' && t.date===ds).reduce((s,t)=>s+t.amount,0));
    }
  } else {
    const months = {};
    transactions.forEach(t => {
      const m = t.date.slice(0,7);
      if (!months[m]) months[m] = { income:0, expense:0 };
      months[m][t.type] += t.amount;
    });
    const sorted = Object.keys(months).sort().slice(-6);
    sorted.forEach(m => {
      labels.push(m.slice(5));
      incData.push(months[m]?.income||0);
      expData.push(months[m]?.expense||0);
    });
  }

  const lineCtx = document.getElementById('lineChart').getContext('2d');
  if (lineChartInst) lineChartInst.destroy();
  
  const lineCanvas = document.getElementById('lineChart');
  lineCanvas.removeAttribute('height');
  lineCanvas.style.height = '280px';
  
  lineChartInst = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'ចំណូល', data: incData, borderColor:'#10B981', backgroundColor:'rgba(16,185,129,.1)', fill:true, tension:.4, pointRadius:3 },
        { label:'ចំណាយ', data: expData, borderColor:'#EF4444', backgroundColor:'rgba(239,68,68,.1)',   fill:true, tension:.4, pointRadius:3 }
      ]
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'top' }
      }, 
      scales: { 
        x: { grid: { display: false } }, 
        y: { grid: { color: 'rgba(0,0,0,.05)' } } 
      }
    }
  });

  // Pie chart
  const cats = {};
  transactions.filter(t=>t.type==='expense').forEach(t => { cats[t.category] = (cats[t.category]||0)+t.amount; });
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  if (pieChartInst) pieChartInst.destroy();
  
  const pieCanvas = document.getElementById('pieChart');
  pieCanvas.removeAttribute('height');
  pieCanvas.style.height = '280px';
  
  if (Object.keys(cats).length) {
    pieChartInst = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(cats),
        datasets: [{ data: Object.values(cats), backgroundColor:['#4F46E5','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899'], hoverOffset:6 }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }
}

// ===== TRANSACTIONS =====
function renderTransactions() {
  const filter = document.getElementById('txFilter').value;
  const search = (document.getElementById('txSearch').value||'').toLowerCase();
  let list = [...transactions].sort((a,b)=>b.date.localeCompare(a.date));
  if (filter !== 'all') list = list.filter(t=>t.type===filter);
  if (search) list = list.filter(t=>t.title.toLowerCase().includes(search)||t.category.toLowerCase().includes(search));

  document.getElementById('transactionsBody').innerHTML = list.length ? list.map(t=>`
    <tr>
      <td>${t.title}</td>
      <td><span class="badge badge-${t.type}">${t.type==='income'?'ចំណូល':'ចំណាយ'}</span></td>
      <td>${t.category}</td>
      <td class="${t.type==='income'?'text-success':'text-danger'} font-bold">${t.type==='income'?'+':'-'}$${t.amount.toFixed(2)}</td>
      <td>${t.date}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" onclick="editTransaction('${t.id}')" title="កែសម្រួល">✏️</button>
          <button class="btn-icon" onclick="deleteTransaction('${t.id}')" title="លុប">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">💰</div><div class="empty-state-text">មិនមានប្រតិបត្តិការ</div></div></td></tr>`;
}

async function saveTransaction() {
  const id   = document.getElementById('txId').value;
  const title= document.getElementById('txTitle').value.trim();
  const amt  = parseFloat(document.getElementById('txAmount').value);
  const type = document.getElementById('txType').value;
  const cat  = document.getElementById('txCategory').value;
  const date = document.getElementById('txDate').value;
  const note = document.getElementById('txNote').value;

  if (!title || isNaN(amt) || amt <= 0 || !date) { toast('សូមបំពេញព័ត៌មានអោយបានគ្រប់គ្រាន់', 'warning'); return; }

  const txData = { title, amount: amt, type, category: cat, date, note };
  
  const res = await fetch('api.php?action=save_transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(txData)
  }).then(r => r.json());

  if (res.success) {
    toast('បន្ថែមប្រតិបត្តិការដោយជោគជ័យ');
    await loadAllData(); closeModal('transactionModal'); clearTxForm(); renderTransactions();
  }
}

function editTransaction(id) {
  const t = transactions.find(x => x.id == id);
  if (!t) return;
  document.getElementById('txId').value       = t.id;
  document.getElementById('txTitle').value    = t.title;
  document.getElementById('txAmount').value   = t.amount;
  document.getElementById('txType').value     = t.type;
  document.getElementById('txCategory').value = t.category;
  document.getElementById('txDate').value     = t.date;
  document.getElementById('txNote').value     = t.note||'';
  document.getElementById('txModalTitle').textContent = 'កែសម្រួលប្រតិបត្តិការ';
  openModal('transactionModal');
}

async function deleteTransaction(id) {
  if (!confirm('លុបប្រតិបត្តិការនេះ?')) return;
  await fetch(`api.php?action=delete_transaction&id=${id}`);
  await loadAllData();
  renderTransactions(); toast('លុបដោយជោគជ័យ','warning');
}

function clearTxForm() {
  ['txId','txTitle','txAmount','txNote'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('txType').value = 'income';
  document.getElementById('txDate').valueAsDate = new Date();
  document.getElementById('txModalTitle').textContent = 'បន្ថែមប្រតិបត្តិការ';
}

// ===== INVENTORY =====
function renderInventory() {
  const search = (document.getElementById('invSearch').value||'').toLowerCase();
  let list = [...products].sort((a,b)=>a.name.localeCompare(b.name));
  if (search) list = list.filter(p=>p.name.toLowerCase().includes(search));

  document.getElementById('inventoryBody').innerHTML = list.length ? list.map(p=>{
    const margin = p.price - p.cost;
    const low = p.qty < 10;
    return `<tr>
      <td class="font-bold">${p.name}</td>
      <td>$${p.cost.toFixed(2)}</td>
      <td>$${p.price.toFixed(2)}</td>
      <td>${p.qty}</td>
      <td class="text-success">$${margin.toFixed(2)}</td>
      <td><span class="badge ${low?'badge-low':'badge-paid'}">${low?'ស្តុកតិច':'ធម្មតា'}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" onclick="editInventory('${p.id}')">✏️</button>
          <button class="btn-icon" onclick="deleteInventory('${p.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('') : `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">មិនមានផលិតផល</div></div></td></tr>`;
}

async function saveInventory() {
  const id    = document.getElementById('invId').value;
  const name  = document.getElementById('invName').value.trim();
  const cost  = parseFloat(document.getElementById('invCost').value);
  const price = parseFloat(document.getElementById('invPrice').value);
  const qty   = parseInt(document.getElementById('invQty').value);

  if (!name || isNaN(cost) || isNaN(price) || isNaN(qty)) { toast('សូមបំពេញព័ត៌មានអោយបានគ្រប់គ្រាន់','warning'); return; }

  const productData = { id, name, cost_price: cost, sale_price: price, quantity: qty };
  const res = await fetch('api.php?action=save_product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData)
  }).then(r => r.json());

  if (res.success) {
    toast(id ? 'កែសម្រួលជោគជ័យ' : 'បន្ថែមជោគជ័យ');
    await loadAllData(); closeModal('inventoryModal'); renderInventory();
  }
}

function editInventory(id) {
  const p = products.find(x => x.id == id);
  if (!p) return;
  document.getElementById('invId').value    = p.id;
  document.getElementById('invName').value  = p.name;
  document.getElementById('invCost').value  = p.cost;
  document.getElementById('invPrice').value = p.price;
  document.getElementById('invQty').value   = p.qty;
  document.getElementById('invModalTitle').textContent = 'កែសម្រួលផលិតផល';
  openModal('inventoryModal');
}

async function deleteInventory(id) {
  if (!confirm('លុបផលិតផលនេះ?')) return;
  await fetch(`api.php?action=delete_product&id=${id}`);
  await loadAllData();
  renderInventory(); toast('លុបដោយជោគជ័យ','warning');
}

function clearInvForm() {
  ['invId','invName','invCost','invPrice','invQty'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('invModalTitle').textContent = 'បន្ថែមផលិតផល';
}

// ===== CUSTOMERS with Profile Image =====
let currentProfileFile = null;
let currentProfilePreview = null;

// មុខងារជំនួយសម្រាប់ឆែកមើលរូបភាពថាត្រឹមត្រូវឬអត់
function isValidDataUrl(str) {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('data:image') && str.length > 100;
}

function renderCustomers() {
  const search = (document.getElementById('custSearch').value||'').toLowerCase();
  let list = [...customers];
  if (search) list = list.filter(c=>(c.name||'').toLowerCase().includes(search)|| (c.phone||'').includes(search));

  const grid = document.getElementById('customersGrid');
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-text">មិនមានអតិថិជន</div></div>';
    return;
  }

  grid.innerHTML = list.map(c => {
    const custOrders = orders.filter(o=>o.customerId==c.id);
    const total = custOrders.reduce((s,o)=>s+parseFloat(o.total || 0),0);
    const avatarHtml = isValidDataUrl(c.profileImage) 
      ? `<img src="${c.profileImage}" alt="${c.name}" onerror="this.parentElement.innerHTML='<span>${c.name.charAt(0)}</span>'">` 
      : `<span>${c.name.charAt(0)}</span>`;
    return `<div class="customer-card">
      <div class="customer-avatar">${avatarHtml}</div>
      <div class="customer-name">${c.name}</div>
      <div class="customer-phone">📞 ${c.phone}</div>
      <div class="customer-address">📍 ${c.address||'—'}</div>
      <div class="customer-stats">
        <div class="cstat"><div class="cstat-val">${custOrders.length}</div><div class="cstat-lab">ការបញ្ជាទិញ</div></div>
        <div class="cstat"><div class="cstat-val">$${total.toFixed(0)}</div><div class="cstat-lab">សរុប</div></div>
      </div>
      <div class="customer-actions">
        <button class="btn-small" onclick="viewCustomerHistory('${c.id}')">📋 ប្រវត្តិ</button>
        <button class="btn-small" onclick="editCustomer('${c.id}')">✏️</button>
        <button class="btn-danger" onclick="deleteCustomer('${c.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function prepareCustomerModal() {
  currentProfileFile = null;
  document.getElementById('custProfilePreview').innerHTML = '<span>👤</span>';
  document.getElementById('custProfilePreview').style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
  document.getElementById('custProfileInput').value = '';
  clearCustForm();
  openModal('customerModal');
}

function handleProfileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    toast('សូមជ្រើសរើសរូបភាពប៉ុណ្ណោះ', 'warning');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    currentProfileFile = e.target.result;
    const preview = document.getElementById('custProfilePreview');
    preview.innerHTML = `<img src="${currentProfileFile}" alt="profile">`;
    preview.style.background = 'none';
  };
  reader.readAsDataURL(file);
}

async function saveCustomer() {
  const id      = document.getElementById('custId').value;
  const name    = document.getElementById('custName').value.trim();
  const phone   = document.getElementById('custPhone').value.trim();
  const address = document.getElementById('custAddress').value.trim();

  if (!name || !phone) { toast('សូមបំពេញឈ្មោះ និងលេខទូរស័ព្ទ','warning'); return; }
  
  const custData = { id, name, phone, address, profile_image: currentProfileFile };
  const res = await fetch('api.php?action=save_customer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(custData)
  }).then(r => r.json());

  if (res.success) {
    toast(id ? 'កែសម្រួលជោគជ័យ' : 'បន្ថែមជោគជ័យ');
    await loadAllData(); closeModal('customerModal'); renderCustomers();
  }
}

function editCustomer(id) {
  const c = customers.find(x=>x.id==id);
  if (!c) return;
  document.getElementById('custId').value      = c.id;
  document.getElementById('custName').value    = c.name;
  document.getElementById('custPhone').value   = c.phone;
  document.getElementById('custAddress').value = c.address||'';
  
  // Set profile preview
  const preview = document.getElementById('custProfilePreview');
  if (isValidDataUrl(c.profileImage)) {
    preview.innerHTML = `<img src="${c.profileImage}" alt="profile">`;
    preview.style.background = 'none';
    currentProfileFile = c.profileImage;
  } else {
    preview.innerHTML = '<span>👤</span>';
    preview.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
    currentProfileFile = null;
  }
  
  openModal('customerModal');
}

async function deleteCustomer(id) {
  if (!confirm('លុបអតិថិជននេះ?')) return;
  await fetch(`api.php?action=delete_customer&id=${id}`);
  await loadAllData();
  renderCustomers(); toast('លុបដោយជោគជ័យ','warning');
}

function clearCustForm() {
  ['custId','custName','custPhone','custAddress'].forEach(id=>document.getElementById(id).value='');
  currentProfileFile = null;
}

function viewCustomerHistory(id) {
  const c = customers.find(x=>x.id==id);
  if (!c) return;
  const custOrders = orders.filter(o=>o.customerId==id);
  document.getElementById('historyTitle').textContent = `ប្រវត្តិ - ${c.name}`;
  document.getElementById('historyContent').innerHTML = custOrders.length ? `
    <table class="data-table">
      <thead><tr><th>#</th><th>ផលិតផល</th><th>សរុប</th><th>ចំណេញ</th><th>កាលបរិច្ឆេទ</th><th></th></tr></thead>
      <tbody>
        ${custOrders.map((o,i)=>`
          <tr>
            <td>#${i+1}</td>
            <td>${o.items.map(it=>it.name).join(', ')}</td>
            <td class="text-success font-bold">$${o.total.toFixed(2)}</td>
            <td class="text-primary">$${o.profit.toFixed(2)}</td>
            <td>${o.date}</td>
            <td><button class="btn-small" onclick="viewInvoice('${o.id}'); closeModal('historyModal')">វិក្កយបត្រ</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
  ` : '<div class="empty-state"><div class="empty-state-text">មិនមានការបញ្ជាទិញ</div></div>';
  openModal('historyModal');
}

// ===== ORDERS =====
function openOrderModal() {
  const sel = document.getElementById('orderCustomer');
  sel.innerHTML = '<option value="">-- ជ្រើសរើស --</option>' + customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('orderItems').innerHTML = '';
  document.getElementById('orderDate').valueAsDate = new Date();
  document.getElementById('orderNote').value = '';
  updateOrderSummary();
  addOrderItem();
  openModal('orderModal');
}

// Patch the + button in orders page
document.addEventListener('click', e => {
  if (e.target.closest('[onclick="openModal(\'orderModal\')"]')) {
    e.preventDefault();
    openOrderModal();
  }
});

function addOrderItem() {
  const container = document.getElementById('orderItems');
  const row = document.createElement('div');
  row.className = 'order-item';
  row.innerHTML = `
    <select onchange="updateOrderSummary()">
      <option value="">-- ជ្រើសរើសផលិតផល --</option>
      ${products.map(p=>`<option value="${p.id}" data-price="${p.price}" data-cost="${p.cost}">${p.name} ($${p.price})</option>`).join('')}
    </select>
    <input type="number" placeholder="ចំនួន" value="1" min="1" oninput="updateOrderSummary()">
    <span class="item-subtotal" style="font-weight:600;color:var(--primary)">$0.00</span>
    <button class="btn-icon" onclick="this.parentElement.remove(); updateOrderSummary()">❌</button>
  `;
  container.appendChild(row);
}

function updateOrderSummary() {
  let total = 0, profit = 0;
  document.querySelectorAll('.order-item').forEach(row => {
    const sel = row.querySelector('select');
    const qty = parseFloat(row.querySelector('input')?.value||0);
    const opt = sel.selectedOptions[0];
    if (opt && opt.value) {
      const price = parseFloat(opt.dataset.price||0);
      const cost  = parseFloat(opt.dataset.cost||0);
      const sub   = price * qty;
      total  += sub;
      profit += (price - cost) * qty;
      row.querySelector('.item-subtotal').textContent = `$${sub.toFixed(2)}`;
    }
  });
  document.getElementById('orderTotal').textContent  = `$${total.toFixed(2)}`;
  document.getElementById('orderProfit').textContent = `$${profit.toFixed(2)}`;
}

async function saveOrder() {
  const custId = document.getElementById('orderCustomer').value;
  const date   = document.getElementById('orderDate').value;
  const note   = document.getElementById('orderNote').value;

  if (!custId) { toast('សូមជ្រើសរើសអតិថិជន','warning'); return; }
  if (!date)   { toast('សូមជ្រើសរើសកាលបរិច្ឆេទ','warning'); return; }

  const items = [];
  let total = 0, profit = 0;
  let valid = true;

  document.querySelectorAll('.order-item').forEach(row => {
    const sel = row.querySelector('select');
    const qty = parseFloat(row.querySelector('input')?.value||0);
    const opt = sel.selectedOptions[0];
    if (!opt || !opt.value || qty <= 0) return;
    const price = parseFloat(opt.dataset.price);
    const cost  = parseFloat(opt.dataset.cost);
    const prod  = products.find(p => p.id == opt.value);
    if (!prod) { valid = false; return; }
    if (prod.qty < qty) { toast(`ស្តុក "${prod.name}" មិនគ្រប់គ្រាន់`,'error'); valid=false; return; }
    items.push({ productId: opt.value, name: prod.name, qty, price, cost });
    total  += price * qty;
    profit += (price - cost) * qty;
  });

  if (!valid) return;
  if (!items.length) { toast('សូមបន្ថែមផលិតផលយ៉ាងហោចណាស់មួយ','warning'); return; }

  const orderData = { customer_id: custId, items, total, profit, date, note };
  
  const res = await fetch('api.php?action=save_order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  }).then(r => r.json());

  if (res.success) {
    await loadAllData();
    closeModal('orderModal');
    renderOrders();
    viewInvoice(res.order_id);
  }
}

function renderOrders() {
  const search = (document.getElementById('orderSearch').value||'').toLowerCase();
  let list = [...orders].sort((a,b)=>b.date.localeCompare(a.date));
  if (search) list = list.filter(o=>{ const c=customers.find(x=>x.id == o.customerId); return (c?.name||'').toLowerCase().includes(search); });

  document.getElementById('ordersBody').innerHTML = list.length ? list.map((o,i)=>{
    const c = customers.find(x=>x.id == o.customerId);
    const prods = o.items.map(it=>`${it.name}(${it.qty})`).join(', ');
    return `<tr>
      <td>#${list.length-i}</td>
      <td>${c?c.name:'—'}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${prods}</td>
      <td class="text-success font-bold">$${o.total.toFixed(2)}</td>
      <td class="text-primary">$${o.profit.toFixed(2)}</td>
      <td>${o.date}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" onclick="viewInvoice('${o.id}')" title="វិក្កយបត្រ">🧾</button>
          <button class="btn-icon" onclick="deleteOrder('${o.id}')" title="លុប">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('') : `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">🛒</div><div class="empty-state-text">មិនមានការបញ្ជាទិញ</div></div></tr>`;
}

async function deleteOrder(id) {
  if (!confirm('លុបការបញ្ជាទិញ?')) return;
  await fetch(`api.php?action=delete_order&id=${id}`);
  await loadAllData();
  renderOrders(); toast('លុបការបញ្ជាទិញ និងបូកស្តុកវិញរួចរាល់','warning');
}

// ===== INVOICE MODERN =====
function viewInvoice(orderId) {
  const order = orders.find(o => o.id == orderId);
  if (!order) return;
  const cust = customers.find(c => c.id == order.customerId) || { name:'—', phone:'—', address:'', profileImage: null };
  const invNum = `INV-${String(orderId).slice(-6).toUpperCase()}`;
  
  // Format date
  const orderDate = new Date(order.date);
  const formattedDate = orderDate.toLocaleDateString('km-KH', { year: 'numeric', month: 'long', day: 'numeric' });
  
  // Create customer avatar HTML
  const customerAvatarHtml = isValidDataUrl(cust.profileImage) 
    ? `<div class="customer-avatar-invoice"><img src="${cust.profileImage}" alt="${cust.name}" onerror="this.style.display='none'"></div>` 
    : `<div class="customer-avatar-placeholder">${cust.name.charAt(0)}</div>`;

  // Calculate subtotal and tax (if needed)
  const subtotal = order.total;
  const tax = 0; // You can add tax calculation if needed
  const grandTotal = subtotal + tax;

  document.getElementById('invoiceContent').innerHTML = `
    <div class="invoice-wrapper" id="printableInvoice">
      <!-- Modern Header -->
      <div class="invoice-header-modern">
        <div class="invoice-logo-modern">
          <span><i class="fa-solid fa-shop"></i></span>
        </div>
        <div class="invoice-biz-name-modern">Noun KyNa</div>
        <div class="invoice-biz-sub-modern">សូមអរគុណចំពោះការទិញទំនិញពីខាងយើងខ្ញុំ</div>
      </div>

      <!-- Info Bar -->
      <div class="invoice-info-bar">
        <div class="invoice-info-item">
          <div class="invoice-info-icon">📄</div>
          <div class="invoice-info-text">
            <span class="invoice-info-label">លេខវិក្កយបត្រ</span>
            <span class="invoice-info-value">${invNum}</span>
          </div>
        </div>
        <div class="invoice-info-item">
          <div class="invoice-info-icon">📅</div>
          <div class="invoice-info-text">
            <span class="invoice-info-label">កាលបរិច្ឆេទ</span>
            <span class="invoice-info-value">${formattedDate}</span>
          </div>
        </div>
        <div class="invoice-info-item">
          <div class="invoice-info-icon">⏰</div>
          <div class="invoice-info-text">
            <span class="invoice-info-label">ម៉ោង</span>
            <span class="invoice-info-value">${new Date().toLocaleTimeString('km-KH')}</span>
          </div>
        </div>
      </div>

      <!-- Parties Section -->
      <div class="invoice-parties-modern">
        <!-- Company Info -->
        <div class="invoice-party-card">
          <div class="invoice-party-header">
            <div class="invoice-party-icon"><i class="fa-brands fa-facebook"></i></div>
            <div>
              <div class="invoice-party-title">facebook</div>
              <div class="invoice-party-name">Noun Nyka</div>
            </div>
          </div>
          <div class="invoice-party-details">
            <div class="invoice-party-detail">📍 ភ្នំពេញ, កម្ពុជា</div>
            <div class="invoice-party-detail">📞 012 345 678</div>
            <div class="invoice-party-detail">✉️ info@business.com</div>
          </div>
        </div>

        <!-- Customer Info -->
        <div class="invoice-party-card">
          ${customerAvatarHtml}
          <div class="invoice-party-header" style="margin-top: 12px;">
            
            <div>
              <div class="invoice-party-title">អតិថិជន</div>
              <div class="invoice-party-name">${cust.name}</div>
            </div>
          </div>
          <div class="invoice-party-details">
            <div class="invoice-party-detail">📞 ${cust.phone}</div>
            ${cust.address ? `<div class="invoice-party-detail">📍 ${cust.address}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- Products Table -->
      <div class="invoice-table-modern">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>ផលិតផល</th>
              <th>ចំនួន</th>
              <th style="text-align:right">តម្លៃឯកតា</th>
              <th style="text-align:right">សរុប</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((it,i)=>`
              <tr>
                <td>${i+1}</td>
                <td class="product-name-cell">${it.name}</td>
                <td>${it.qty}</td>
                <td style="text-align:right">$${it.price.toFixed(2)}</td>
                <td style="text-align:right;font-weight:600">$${(it.price*it.qty).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Totals Section -->
      <div class="invoice-totals-modern">
        <div class="invoice-total-row-modern">
          <span class="invoice-total-label">សរុបរង</span>
          <span class="invoice-total-amount">$${subtotal.toFixed(2)}</span>
        </div>
        <div class="invoice-total-row-modern">
          <span class="invoice-total-label">ពន្ធ (0%)</span>
          <span class="invoice-total-amount">$${tax.toFixed(2)}</span>
        </div>
        <div class="invoice-total-row-modern invoice-grand-total-modern">
          <span class="invoice-total-label">សរុបទឹកប្រាក់</span>
          <span class="invoice-total-amount">$${grandTotal.toFixed(2)}</span>
        </div>
      </div>

      ${order.note ? `
        <div class="invoice-note-modern">
          <strong>📝 កំណត់ចំណាំ</strong>
          <p>${order.note}</p>
        </div>
      ` : ''}

      <!-- QR Code Section -->
      <div class="invoice-qr-modern">
        <div class="qr-text">
          <strong>ទូទាត់តាមរយៈ QR Code</strong>
          <p>ABA / Wing / ACLEDA</p>
        </div>
        <img src="${PAYMENT_QR_PATH}" alt="Payment QR" onerror="this.style.display='none'">
      </div>

      <!-- Footer -->
      <div class="invoice-footer-modern">
        <div class="thankyou">សូមអរគុណចំពោះការទិញ និង ទំនុកចិត្ត!</div>
        <div class="powered">វិក្កយបត្រ</div>
      </div>
    </div>
  `;
  openModal('invoiceModal');
}

function printInvoice() { window.print(); }

async function downloadInvoiceImage() {
  const el = document.getElementById('printableInvoice');
  if (!el) return;
  toast('កំពុងរៀបចំរូបភាព...','info');
  try {
    const canvas = await html2canvas(el, { scale:2, backgroundColor:'#ffffff', useCORS:true });
    const link = document.createElement('a');
    link.download = `invoice-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('ទាញយករូបភាពដោយជោគជ័យ 🎉');
  } catch (err) {
    toast('មានបញ្ហា: ' + err.message, 'error');
  }
}

// ===== DEBTS =====
function renderDebts() {
  const filter = document.getElementById('debtFilter').value;
  let list = [...debts].sort((a,b)=>b.date.localeCompare(a.date));
  if (filter !== 'all') list = list.filter(d=>d.type===filter);

  document.getElementById('debtsBody').innerHTML = list.length ? list.map(d=>`<tr>
    <td class="font-bold">${d.name}</td>
    <td><span class="badge badge-${d.type==='receivable'?'receivable':'payable'}">${d.type==='receivable'?'ត្រូវទទួល':'ត្រូវបង់'}</span></td>
    <td class="${d.type==='receivable'?'text-success':'text-danger'} font-bold">$${d.amount.toFixed(2)}</td>
    <td>${d.description||'—'}</td>
    <td>${d.date}</td>
    <td><span class="badge badge-${d.paid?'paid':'unpaid'}">${d.paid?'បានបង់':'មិនទាន់'}</span></td>
    <td>
      <div class="action-btns">
        ${!d.paid?`<button class="btn-small" onclick="markDebtPaid('${d.id}')">✅ បានបង់</button>`:''}
        <button class="btn-icon" onclick="deleteDebt('${d.id}')">🗑️</button>
      </div>
    </td>
  </tr>`).join('') : `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-text">មិនមានបំណុល</div></div></td></tr>`;
}

async function saveDebt() {
  const name = document.getElementById('debtName').value.trim();
  const type = document.getElementById('debtType').value;
  const amt  = parseFloat(document.getElementById('debtAmount').value);
  const desc = document.getElementById('debtDesc').value.trim();
  const date = document.getElementById('debtDate').value;

  if (!name || isNaN(amt) || !date) { toast('សូមបំពេញព័ត៌មានអោយបានគ្រប់គ្រាន់','warning'); return; }

  const debtData = { name, type, amount: amt, description: desc, date };
  const res = await fetch('api.php?action=save_debt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(debtData)
  }).then(r => r.json());

  if (res.success) {
    await loadAllData(); closeModal('debtModal'); clearDebtForm(); renderDebts();
    toast('បន្ថែមបំណុលដោយជោគជ័យ');
  }
}

async function markDebtPaid(id) {
  if (!confirm('បញ្ជាក់ការបង់ប្រាក់?')) return;
  await fetch(`api.php?action=mark_debt_paid&id=${id}`);
  await loadAllData(); renderDebts(); toast('ធ្វើបច្ចុប្បន្នភាពដោយជោគជ័យ');
}

async function deleteDebt(id) {
  if (!confirm('លុបបំណុលនេះ?')) return;
  await fetch(`api.php?action=delete_debt&id=${id}`);
  await loadAllData(); renderDebts(); toast('លុបដោយជោគជ័យ','warning');
}

function clearDebtForm() {
  ['debtId','debtName','debtAmount','debtDesc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('debtDate').valueAsDate = new Date();
}

// ===== REPORTS =====
function renderReports() {
  const period = document.getElementById('reportPeriod').value;
  const now = new Date();
  let filteredTx = [];

  if (period === 'daily') {
    const today = now.toISOString().split('T')[0];
    filteredTx = transactions.filter(t=>t.date===today);
  } else {
    const m = now.toISOString().slice(0,7);
    filteredTx = transactions.filter(t=>t.date.startsWith(m));
  }

  const inc  = filteredTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp  = filteredTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const prof = inc - exp;

  document.getElementById('rIncome').textContent  = `$${inc.toFixed(2)}`;
  document.getElementById('rExpense').textContent = `$${exp.toFixed(2)}`;
  document.getElementById('rProfit').textContent  = `$${prof.toFixed(2)}`;
  document.getElementById('rProfit').style.color  = prof>=0?'var(--success)':'var(--danger)';

  // Report line chart - last 6 months
  const months = {};
  transactions.forEach(t => {
    const m = t.date.slice(0,7);
    if (!months[m]) months[m] = { income:0, expense:0 };
    months[m][t.type] += t.amount;
  });
  const sortedM = Object.keys(months).sort().slice(-6);

  const rLineCtx = document.getElementById('reportLineChart').getContext('2d');
  if (rLineInst) rLineInst.destroy();
  
  const rLineCanvas = document.getElementById('reportLineChart');
  rLineCanvas.removeAttribute('height');
  rLineCanvas.style.height = '260px';
  
  rLineInst = new Chart(rLineCtx, {
    type:'bar',
    data:{
      labels: sortedM.map(m=>m.slice(5)+'/'+m.slice(0,4)),
      datasets:[
        { label:'ចំណូល',  data:sortedM.map(m=>months[m]?.income||0),  backgroundColor:'rgba(16,185,129,.7)', borderRadius:6 },
        { label:'ចំណាយ', data:sortedM.map(m=>months[m]?.expense||0), backgroundColor:'rgba(239,68,68,.7)',  borderRadius:6 }
      ]
    },
    options:{ 
      responsive: true, 
      maintainAspectRatio: true,
      plugins:{ legend:{ position:'top' } }, 
      scales:{ x:{ grid:{ display:false } }, y:{ grid:{ color:'rgba(0,0,0,.05)' } } }
    }
  });

  // Report pie
  const cats = {};
  transactions.filter(t=>t.type==='expense').forEach(t=>{ cats[t.category]=(cats[t.category]||0)+t.amount; });
  const rPieCtx = document.getElementById('reportPieChart').getContext('2d');
  if (rPieInst) rPieInst.destroy();
  
  const rPieCanvas = document.getElementById('reportPieChart');
  rPieCanvas.removeAttribute('height');
  rPieCanvas.style.height = '260px';
  
  if (Object.keys(cats).length) {
    rPieInst = new Chart(rPieCtx, {
      type:'pie',
      data:{ labels:Object.keys(cats), datasets:[{ data:Object.values(cats), backgroundColor:['#4F46E5','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899'] }] },
      options:{ 
        responsive: true, 
        maintainAspectRatio: true,
        plugins:{ legend:{ position:'bottom', labels:{ boxWidth:12 } } }
      }
    });
  }

  // Top products
  const prodSales = {};
  orders.forEach(o=>o.items.forEach(it=>{ prodSales[it.name]=(prodSales[it.name]||0)+it.qty; }));
  const topProds = Object.entries(prodSales).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.getElementById('topProducts').innerHTML = topProds.length ? topProds.map(([name,qty],i)=>`
    <div class="rank-item">
      <div class="rank-num">${i+1}</div>
      <div class="rank-name">${name}</div>
      <div class="rank-val">${qty} ឯកតា</div>
    </div>
  `).join('') : '<div class="empty-state"><div class="empty-state-text">មិនមានទិន្នន័យ</div></div>';

  // Top customers
  const custSpend = {};
  orders.forEach(o=>{
    const c = customers.find(x => x.id == o.customerId);
    if (c) custSpend[c.name]=(custSpend[c.name]||0)+o.total;
  });
  const topCust = Object.entries(custSpend).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.getElementById('topCustomers').innerHTML = topCust.length ? topCust.map(([name,total],i)=>`
    <div class="rank-item">
      <div class="rank-num">${i+1}</div>
      <div class="rank-name">${name}</div>
      <div class="rank-val">$${total.toFixed(2)}</div>
    </div>
  `).join('') : '<div class="empty-state"><div class="empty-state-text">មិនមានទិន្នន័យ</div></div>';
}

// ===== EXPORT =====
function exportData() {
  const menu = document.createElement('div');
  menu.style.cssText = 'position:fixed;top:64px;right:16px;z-index:999;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px;box-shadow:var(--shadow-md);';
  menu.innerHTML = `
    <button onclick="exportJSON()" style="display:block;width:100%;text-align:left;padding:8px 16px;background:none;border:none;cursor:pointer;font-family:Kantumruy Pro,sans-serif;font-size:13px;color:var(--text);border-radius:6px;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">📋 JSON Export</button>
    <button onclick="exportCSV()" style="display:block;width:100%;text-align:left;padding:8px 16px;background:none;border:none;cursor:pointer;font-family:Kantumruy Pro,sans-serif;font-size:13px;color:var(--text);border-radius:6px;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">📊 CSV Export</button>
  `;
  document.body.appendChild(menu);
  setTimeout(()=>{ document.addEventListener('click', ()=>menu.remove(), { once:true }); }, 100);
}

function exportJSON() {
  const data = { customers, products, transactions, orders, debts };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `business-data-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  toast('នាំចេញ JSON ដោយជោគជ័យ');
}

function exportCSV() {
  const rows = [['Title','Type','Category','Amount','Date']];
  transactions.forEach(t=>rows.push([t.title, t.type, t.category, t.amount, t.date]));
  const csv = rows.map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  toast('នាំចេញ CSV ដោយជោគជ័យ');
}

// Patch order modal open button
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('#page-orders .page-toolbar .btn-primary');
  if (btn) btn.onclick = openOrderModal;
});
 