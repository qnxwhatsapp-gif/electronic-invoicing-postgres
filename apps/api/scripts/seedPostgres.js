'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('../src/db/pg');

async function main() {
  const roleNames = ['Owner', 'Accountant', 'Billing Operator', 'Inventory Manager'];
  for (const name of roleNames) {
    await db('user_roles').insert({ name, is_system: true }).onConflict('name').ignore();
  }

  let branch = await db('branches').where({ store_id: 'MAIN-001' }).first();
  if (!branch) {
    const rows = await db('branches')
      .insert({ name: 'Main Branch', store_id: 'MAIN-001', address: 'Main Office' })
      .returning('*');
    branch = rows[0];
  }
  const branchId = branch.id;

  const defaultUsers = [
    { name: 'Admin', mobile: 'admin', password: 'admin123', role: 'Owner' },
    { name: 'Priya', mobile: 'priya', password: 'accountant123', role: 'Accountant' },
    { name: 'Raj', mobile: 'raj', password: 'billing123', role: 'Billing Operator' },
    { name: 'Meena', mobile: 'meena', password: 'inventory123', role: 'Inventory Manager' },
  ];

  for (const u of defaultUsers) {
    const exists = await db('users').where({ mobile: u.mobile }).first();
    if (!exists) {
      await db('users').insert({
        name: u.name,
        mobile: u.mobile,
        password: bcrypt.hashSync(u.password, 10),
        role: u.role,
        branch_id: branchId,
        is_active: true,
      });
    }
  }

  const accountExists = await db('accounts').where({ account_name: 'Cash Account' }).first();
  if (!accountExists) {
    await db('accounts').insert({
      account_name: 'Cash Account',
      account_type: 'Cash',
      opening_balance: 0,
      current_balance: 0,
      is_primary: true,
      is_active: true,
    });
  }

  for (const name of ['Rent', 'Utilities', 'Salary', 'Transport', 'Office Supplies', 'Marketing', 'Maintenance', 'Other']) {
    await db('expense_categories').insert({ name }).onConflict('name').ignore();
  }

  for (const name of ['Electronics', 'Furniture', 'Stationery', 'Electrical', 'Services']) {
    await db('categories').insert({ name }).onConflict('name').ignore();
  }

  await db('company_profile').insert({ id: 1, company_name: 'My Company' }).onConflict('id').ignore();
  await db('invoice_settings').insert({ id: 1 }).onConflict('id').ignore();

  const appSettings = [
    ['currency', 'INR'],
    ['currency_symbol', 'Rs.'],
    ['language', 'en'],
    ['date_format', 'DD/MM/YYYY'],
    ['tax_rate', '0'],
    ['tax_name', 'GST'],
  ];
  for (const [key, value] of appSettings) {
    await db('app_settings').insert({ key, value }).onConflict('key').ignore();
  }

  console.log('PostgreSQL default seed completed (users, branch, categories, settings).');
  await db.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
