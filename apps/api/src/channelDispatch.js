'use strict';

const db = require('./db/pg');

function getPort() {
  return Number(process.env.PORT || 3001);
}

function getKey() {
  return process.env.API_KEY || '';
}

async function apiJson(method, path, { query, body } = {}) {
  let url = `http://127.0.0.1:${getPort()}${path}`;
  if (query && Object.keys(query).length) {
    const u = new URL(url);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    }
    url = u.toString();
  }
  const opt = { method, headers: { 'x-api-key': getKey() } };
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(body);
  }
  const res = await fetch(url, opt);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || res.statusText);
  }
  if (res.status >= 400) throw new Error(json?.error || json?.message || res.statusText);
  return json;
}

async function dispatchChannel(channel, data = {}) {
  const h = handlers[channel];
  if (!h) throw new Error(`Channel not implemented for PostgreSQL API: ${channel}`);
  return h(data);
}

const handlers = {
  'auth:login': (d) => apiJson('POST', '/api/auth/login', { body: { username: d.username, password: d.password } }),

  'auth:getRoles': () => apiJson('GET', '/api/auth/roles'),

  'auth:getUsersByRole': (d) => apiJson('GET', '/api/auth/users-by-role', { query: { role: d.role } }),

  'roles:getAll': () => apiJson('GET', '/api/users/roles/all'),

  'roles:create': (d) => apiJson('POST', '/api/users/roles/create', { body: { name: d.name } }),

  'roles:delete': (d) => apiJson('DELETE', `/api/users/roles/${d.id}`),

  'permissions:getForUser': async ({ userId, role }) => {
    if (role === 'Owner') return null;
    const rows = await db('user_permissions').where({ user_id: userId });
    const map = {};
    for (const r of rows) {
      map[r.module] = {
        view: !!r.can_view,
        create: !!r.can_create,
        edit: !!r.can_edit,
        delete: !!r.can_delete,
      };
    }
    return map;
  },

  'permissions:saveForUser': async ({ userId, permissions }) => {
    const rows = [];
    for (const [mod, actions] of Object.entries(permissions || {})) {
      rows.push({
        module: mod,
        can_view: !!actions.view,
        can_create: !!actions.create,
        can_edit: !!actions.edit,
        can_delete: !!actions.delete,
      });
    }
    return apiJson('PUT', `/api/users/${userId}/permissions`, { body: { permissions: rows } });
  },

  'dashboard:getStats': async (d = {}) => {
    const q = d.branch_id ? { branch_id: d.branch_id } : {};
    const stats = await apiJson('GET', '/api/dashboard/stats', { query: q });
    return {
      totalSale: stats.totalSale,
      totalProfit: stats.totalProfit,
      pendingPayment: stats.pendingPayment,
      cashBalance: stats.cashBalance,
      bankBalance: stats.bankBalance,
      lowStock: stats.lowStock,
      monthlySales: stats.monthlySales || [],
      recentInvoices: stats.recentInvoices || [],
      topItems: stats.topProducts || [],
      branchRevenue: [],
    };
  },

  'invoices:getAll': (d = {}) =>
    apiJson('GET', '/api/invoices', {
      query: {
        status: d.status && d.status !== 'All' ? d.status : undefined,
        search: d.search || undefined,
        branch_id: d.branch_id || undefined,
      },
    }),

  'invoices:getById': (d) => apiJson('GET', `/api/invoices/${d.id}`),

  'invoices:create': (d) => apiJson('POST', '/api/invoices', { body: d }),

  'invoices:updateStatus': (d) =>
    apiJson('PUT', `/api/invoices/${d.id}/status`, { body: { status: d.status, paid_amount: d.paid_amount } }),

  'invoices:delete': (d) => apiJson('DELETE', `/api/invoices/${d.id}`),

  'invoices:update': (d) => apiJson('PUT', `/api/invoices/${d.id}`, { body: d.data || d }),

  'invoices:autoComplete': () => apiJson('POST', '/api/invoices/autocomplete', { body: {} }),

  'returns:getAll': () => apiJson('GET', '/api/invoices/returns'),

  'returns:create': (d) => apiJson('POST', '/api/invoices/returns', { body: d }),

  'products:getAll': (d = {}) =>
    apiJson('GET', '/api/products', {
      query: { search: d.search, category: d.category, status: d.status },
    }),

  'products:findByBarcode': (d) => apiJson('GET', `/api/products/barcode/${encodeURIComponent(d.barcode || '')}`),

  'products:create': (d) => apiJson('POST', '/api/products', { body: d }),

  'products:update': (d) => {
    const { id, ...rest } = d;
    return apiJson('PUT', `/api/products/${id}`, { body: rest });
  },

  'products:delete': (d) => apiJson('DELETE', `/api/products/${d.id}`),

  'products:getInventoryStats': async () => {
    const totalRow = await db('products').where({ is_active: true }).count('* as c').first();
    const lowRow = await db('products').whereIn('status', ['Low', 'Critical']).where({ is_active: true }).count('* as c').first();
    const costRow = await db('products')
      .where({ is_active: true })
      .select(db.raw('COALESCE(SUM(current_stock * purchase_price),0) as val'))
      .first();
    const sellRow = await db('products')
      .where({ is_active: true })
      .select(db.raw('COALESCE(SUM(current_stock * selling_price),0) as val'))
      .first();
    return {
      total: Number(totalRow?.c || 0),
      lowAlert: Number(lowRow?.c || 0),
      costVal: Number(costRow?.val || 0),
      sellVal: Number(sellRow?.val || 0),
    };
  },

  'categories:getAll': () => db('categories').orderBy('name'),

  'customers:getAll': (d = {}) => apiJson('GET', '/api/customers', { query: { search: d.search } }),

  'vendors:getAll': (d = {}) => apiJson('GET', '/api/vendors', { query: { search: d.search } }),

  'vendors:create': (d) => apiJson('POST', '/api/vendors', { body: d }),

  'vendors:update': (d) => {
    const { id, ...rest } = d;
    return apiJson('PUT', `/api/vendors/${id}`, { body: rest });
  },

  'vendors:delete': (d) => apiJson('DELETE', `/api/vendors/${d.id}`),

  'purchases:getAll': (d = {}) => apiJson('GET', '/api/purchases', { query: { search: d.search } }),

  'purchases:create': (d) => apiJson('POST', '/api/purchases', { body: d }),

  'purchases:delete': (d) => apiJson('DELETE', `/api/purchases/${d.id}`),

  'purchases:updateStatus': (d) => apiJson('PUT', `/api/purchases/${d.id}/status`, { body: { status: d.status } }),

  'purchases:createReturn': (d) => apiJson('POST', '/api/purchases/returns', { body: d }),

  'purchases:getReturns': () => apiJson('GET', '/api/purchases/returns'),

  'purchases:getItems': (d) => apiJson('GET', `/api/purchases/${d.id}/items`),

  'paybills:getAll': () => apiJson('GET', '/api/paybills'),

  'paybills:create': (d) =>
    apiJson('POST', '/api/paybills', {
      body: {
        vendor_id: d.vendor_id,
        purchase_invoice_id: d.purchase_invoice_id || null,
        amount: d.paying_amount || d.amount || 0,
        payment_mode: d.payment_mode || 'Cash',
        payment_date: d.payment_date || d.last_payment_date || new Date().toISOString().slice(0, 10),
        reference_no: d.reference_no || '',
        notes: d.notes || '',
      },
    }),

  'banking:getAccounts': () => apiJson('GET', '/api/banking/accounts'),

  'banking:getTransactions': () => apiJson('GET', '/api/banking/transactions'),

  'banking:addTransaction': (d) => apiJson('POST', '/api/banking/transactions', { body: d }),

  'expenses:getAll': () => apiJson('GET', '/api/expenses'),

  'expenses:getStats': () => apiJson('GET', '/api/expenses/stats'),

  'expenses:create': async (d) => {
    let category_id = d.category_id;
    if (!category_id && d.category) {
      const row = await db('expense_categories').whereRaw('LOWER(name) = ?', [String(d.category).toLowerCase()]).first();
      category_id = row?.id || null;
    }
    return apiJson('POST', '/api/expenses', {
      body: {
        category_id,
        amount: d.amount,
        payment_mode: d.payment_mode || 'Cash',
        description: d.title || d.description || '',
        expense_date: d.expense_date || new Date().toISOString().slice(0, 10),
        created_by: d.created_by || null,
      },
    });
  },

  'reports:sales': async ({ from, to }) =>
    db('invoices as i')
      .join('invoice_items as ii', 'ii.invoice_id', 'i.id')
      .leftJoin('products as p', 'p.id', 'ii.product_id')
      .whereNotIn('i.status', ['Draft', 'Deleted'])
      .andWhereBetween('i.invoice_date', [from, to])
      .select(
        'i.invoice_date as date',
        'i.invoice_no as bill_no',
        'i.customer_name',
        'ii.product_name as item_name',
        'ii.qty',
        'ii.rate',
        'ii.amount',
        'i.status as payment_status',
        'i.payment_mode',
        db.raw('(ii.qty * (ii.rate - COALESCE(p.purchase_price, 0))) as profit'),
      )
      .orderBy('i.invoice_date', 'desc'),

  'reports:stock': () => apiJson('GET', '/api/reports/stock'),

  'reports:customerOutstanding': () => apiJson('GET', '/api/reports/customer-outstanding'),

  'reports:vendorOutstanding': () => apiJson('GET', '/api/reports/vendor-outstanding'),

  'reports:profitLoss': (d) => apiJson('GET', '/api/reports/profit-loss', { query: { from: d.from, to: d.to } }),

  'reports:balanceSheet': () => apiJson('GET', '/api/reports/balance-sheet'),

  'reports:expenses': (d = {}) =>
    apiJson('GET', '/api/reports/expenses', {
      query: { from: d.from, to: d.to, branch_id: d.branch_id, category: d.category },
    }),

  'search:global': (d) => apiJson('GET', '/api/search', { query: { q: d.query } }),

  'settings:getCompany': () => apiJson('GET', '/api/company'),

  'settings:saveCompany': (d) => apiJson('PUT', '/api/company', { body: d }),

  'accounts:getAll': () => apiJson('GET', '/api/banking/accounts'),

  'accounts:create': (d) => apiJson('POST', '/api/banking/accounts', { body: d }),

  'accounts:update': (d) => {
    const { id, ...rest } = d;
    return apiJson('PUT', `/api/banking/accounts/${id}`, { body: rest });
  },

  'settings:getAll': () => apiJson('GET', '/api/settings'),

  'settings:saveAll': (d) => apiJson('PUT', '/api/settings', { body: d }),

  'invoiceSettings:get': async () => {
    let row = await db('invoice_settings').where({ id: 1 }).first();
    if (!row) {
      await db('invoice_settings').insert({ id: 1 });
      row = await db('invoice_settings').where({ id: 1 }).first();
    }
    const r = { ...row };
    if (typeof r.custom_fields === 'string') {
      try {
        r.custom_fields = JSON.parse(r.custom_fields || '[]');
      } catch {
        r.custom_fields = [];
      }
    }
    return r;
  },

  'invoiceSettings:save': async (data) => {
    const payload = { ...data, custom_fields: JSON.stringify(data.custom_fields || []) };
    delete payload.id;
    const exists = await db('invoice_settings').where({ id: 1 }).first();
    if (exists) await db('invoice_settings').where({ id: 1 }).update(payload);
    else await db('invoice_settings').insert({ id: 1, ...payload });
    return { success: true };
  },

  'users:getAll': () => apiJson('GET', '/api/users'),

  'users:create': (d) => apiJson('POST', '/api/users', { body: d }),

  'users:update': (d) => {
    const { id, ...rest } = d;
    return apiJson('PUT', `/api/users/${id}`, { body: rest });
  },

  'users:toggleActive': async (d) => {
    const u = await db('users').where({ id: d.id }).first();
    if (!u) return { success: false, error: 'Not found' };
    return apiJson('PUT', `/api/users/${d.id}`, {
      body: {
        name: u.name,
        mobile: u.mobile,
        email: u.email || '',
        role: u.role,
        branch_id: u.branch_id,
        is_active: d.is_active,
      },
    });
  },

  'users:delete': (d) => apiJson('DELETE', `/api/users/${d.id}`),

  'branches:getAll': () => apiJson('GET', '/api/branches'),

  'branches:create': (d) =>
    apiJson('POST', '/api/branches', {
      body: {
        name: d.name,
        address: d.address || '',
        phone: d.contact || d.phone || '',
        city: d.city || '',
        state: d.state || '',
        email: d.email || '',
        gstin: d.gstin || '',
      },
    }),

  'branches:update': (d) => {
    const { id, ...rest } = d;
    return apiJson('PUT', `/api/branches/${id}`, {
      body: {
        name: rest.name,
        address: rest.address || '',
        phone: rest.contact || rest.phone || '',
        city: rest.city || '',
        state: rest.state || '',
        email: rest.email || '',
        gstin: rest.gstin || '',
      },
    });
  },

  'branches:delete': (d) => apiJson('DELETE', `/api/branches/${d.id}`),

  'notifications:getAll': async () => {
    const notifications = await apiJson('GET', '/api/notifications');
    const unreadRow = await db('notifications').where({ is_read: false }).count('* as c').first();
    return { notifications, unread: Number(unreadRow?.c || 0) };
  },

  'notifications:markRead': (d) => {
    if (d?.id) return apiJson('PUT', `/api/notifications/${d.id}/read`, { body: {} });
    return apiJson('PUT', '/api/notifications/mark-all-read', { body: {} });
  },

  'notifications:delete': async (d) => {
    if (d?.id) return apiJson('DELETE', `/api/notifications/${d.id}`);
    await db('notifications').where({ is_read: true }).del();
    return { success: true };
  },

  'notifications:add': (d) => apiJson('POST', '/api/notifications', { body: d }),

  'products:importCSV': async ({ rows }) => {
    const cats = await db('categories').select('id', 'name');
    const catMap = {};
    for (const c of cats) catMap[String(c.name).toLowerCase()] = c.id;
    let last = await db('products').select('sku').orderBy('id', 'desc').first();
    let seq = 1;
    if (last?.sku) {
      const n = parseInt(String(last.sku).replace('ITM-', ''), 10);
      if (!isNaN(n)) seq = n + 1;
    }
    let inserted = 0;
    let updated = 0;
    for (const row of rows || []) {
      const catId = catMap[String(row.category || '').toLowerCase()] || null;
      const stock = parseInt(row.current_stock || row.stock || 0, 10);
      const reorder = parseInt(row.reorder_level || 10, 10);
      const existing = await db('products').where({ name: row.name }).first();
      if (existing) {
        const status = stock <= 5 ? 'Critical' : stock <= reorder ? 'Low' : 'Good';
        await db('products')
          .where({ id: existing.id })
          .update({
            purchase_price: parseFloat(row.purchase_price || 0),
            selling_price: parseFloat(row.selling_price || 0),
            current_stock: stock,
            reorder_level: reorder,
            barcode: row.barcode || null,
            category_id: catId,
            status,
          });
        updated++;
      } else {
        const sku = `ITM-${String(seq).padStart(3, '0')}`;
        seq++;
        const status = stock <= 5 ? 'Critical' : stock <= reorder ? 'Low' : 'Good';
        await db('products').insert({
          sku,
          name: row.name,
          category_id: catId,
          purchase_price: parseFloat(row.purchase_price || 0),
          selling_price: parseFloat(row.selling_price || 0),
          opening_stock: stock,
          current_stock: stock,
          reorder_level: reorder,
          barcode: row.barcode || null,
          status,
          description: '',
        });
        inserted++;
      }
    }
    return { success: true, inserted, updated };
  },

  'products:exportCSV': () =>
    db('products as p')
      .leftJoin('categories as c', 'c.id', 'p.category_id')
      .where('p.is_active', true)
      .select(
        'p.sku',
        'p.name',
        'c.name as category',
        'p.purchase_price',
        'p.selling_price',
        'p.current_stock',
        'p.reorder_level',
        'p.barcode',
      )
      .orderBy('p.sku'),

  'settings:clearData': async ({ modules } = {}) => {
    const CLEAR_TABLES = {
      billing: ['invoice_items', 'invoices', 'return_exchange_items', 'return_exchange'],
      inventory: ['products', 'categories'],
      vendors: ['purchase_return_items', 'purchase_returns', 'purchase_invoice_items', 'purchase_invoices', 'pay_bills', 'vendors'],
      banking: ['banking_transactions'],
      expenses: ['expenses'],
      reports: [],
      notifications: ['notifications'],
    };
    const cleared = [];
    const errors = [];
    for (const mod of modules || []) {
      const tables = CLEAR_TABLES[mod];
      if (!tables?.length) continue;
      for (const tbl of tables) {
        try {
          await db(tbl).del();
          cleared.push(tbl);
        } catch (e) {
          errors.push(`${tbl}: ${e.message}`);
        }
      }
    }
    return { success: errors.length === 0, cleared, errors };
  },

  'settings:getTableCounts': async () => {
    const cnt = async (table) => Number((await db(table).count('* as c').first())?.c || 0);
    return {
      billing: await cnt('invoices'),
      inventory: await cnt('products'),
      vendors: await cnt('vendors'),
      banking: await cnt('banking_transactions'),
      expenses: await cnt('expenses'),
      notifications: await cnt('notifications'),
    };
  },

  'backup:getLogs': async () => [],

  'backup:now': async () => ({ success: true, note: 'Backup logging not available on PostgreSQL schema' }),
};

module.exports = { dispatchChannel };
