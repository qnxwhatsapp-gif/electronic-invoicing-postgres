/**
 * Phase 2 baseline PostgreSQL schema.
 * Mirrors current SQLite domain model for incremental route migration.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('company_profile', (t) => {
    t.integer('id').primary().defaultTo(1);
    t.string('company_name').notNullable().defaultTo('My Company');
    t.string('tagline').defaultTo('');
    t.string('mobile').defaultTo('');
    t.string('email').defaultTo('');
    t.string('address').defaultTo('');
    t.string('city').defaultTo('');
    t.string('state').defaultTo('');
    t.string('pincode').defaultTo('');
    t.string('website').defaultTo('');
    t.string('gstin').defaultTo('');
    t.string('pan').defaultTo('');
    t.string('bank_name').defaultTo('');
    t.string('account_number').defaultTo('');
    t.string('ifsc_code').defaultTo('');
    t.string('upi_id').defaultTo('');
    t.string('invoice_prefix').defaultTo('INV');
    t.text('invoice_footer').defaultTo('');
    t.string('currency_symbol').defaultTo('Rs.');
    t.string('tax_label').defaultTo('GST');
    t.decimal('tax_percent', 10, 2).defaultTo(18);
    t.text('logo_path');
  });

  await knex.schema.createTable('branches', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('store_id').unique();
    t.string('address').defaultTo('');
    t.string('city').defaultTo('');
    t.string('state').defaultTo('');
    t.string('phone').defaultTo('');
    t.string('email').defaultTo('');
    t.string('gstin').defaultTo('');
    t.boolean('is_active').defaultTo(true);
  });

  await knex.schema.createTable('permissions', (t) => {
    t.increments('id').primary();
    t.string('module').notNullable();
    t.string('action').notNullable();
    t.unique(['module', 'action']);
  });

  await knex.schema.createTable('role_permissions', (t) => {
    t.increments('id').primary();
    t.string('role').notNullable();
    t.integer('permission_id').references('id').inTable('permissions').onDelete('CASCADE');
    t.boolean('granted').defaultTo(true);
    t.unique(['role', 'permission_id']);
  });

  await knex.schema.createTable('user_roles', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().unique();
    t.boolean('is_system').defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('mobile').unique();
    t.string('email');
    t.string('password').notNullable();
    t.string('role').notNullable().defaultTo('Staff');
    t.integer('branch_id').references('id').inTable('branches').onDelete('SET NULL');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('user_permissions', (t) => {
    t.increments('id').primary();
    t.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.string('module').notNullable();
    t.boolean('can_view').defaultTo(false);
    t.boolean('can_create').defaultTo(false);
    t.boolean('can_edit').defaultTo(false);
    t.boolean('can_delete').defaultTo(false);
    t.unique(['user_id', 'module']);
  });

  await knex.schema.createTable('customers', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('mobile');
    t.string('email');
    t.string('address').defaultTo('');
    t.string('city').defaultTo('');
    t.string('state').defaultTo('');
    t.string('pincode').defaultTo('');
    t.string('gstin');
    t.string('customer_type').defaultTo('Regular');
    t.decimal('opening_balance', 14, 2).defaultTo(0);
    t.decimal('credit_limit', 14, 2).defaultTo(0);
    t.integer('credit_days').defaultTo(30);
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('categories', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().unique();
    t.text('description');
    t.boolean('is_active').defaultTo(true);
  });

  await knex.schema.createTable('products', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('sku').unique();
    t.string('barcode').unique();
    t.integer('category_id').references('id').inTable('categories').onDelete('SET NULL');
    t.decimal('purchase_price', 14, 2).defaultTo(0);
    t.decimal('selling_price', 14, 2).defaultTo(0);
    t.integer('current_stock').defaultTo(0);
    t.integer('reorder_level').defaultTo(10);
    t.integer('opening_stock').defaultTo(0);
    t.string('status').defaultTo('Good');
    t.text('description');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('accounts', (t) => {
    t.increments('id').primary();
    t.string('account_name').notNullable();
    t.string('account_type').defaultTo('Cash');
    t.string('bank_name');
    t.string('account_number');
    t.string('ifsc_code');
    t.decimal('opening_balance', 14, 2).defaultTo(0);
    t.decimal('current_balance', 14, 2).defaultTo(0);
    t.boolean('is_primary').defaultTo(false);
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('invoices', (t) => {
    t.increments('id').primary();
    t.string('invoice_no').notNullable().unique();
    t.date('invoice_date').notNullable();
    t.date('due_date');
    t.string('customer_name');
    t.string('customer_phone');
    t.string('customer_address');
    t.integer('seller_id').references('id').inTable('users').onDelete('SET NULL');
    t.integer('branch_id').references('id').inTable('branches').onDelete('SET NULL');
    t.decimal('subtotal', 14, 2).defaultTo(0);
    t.decimal('tax_amount', 14, 2).defaultTo(0);
    t.decimal('grand_total', 14, 2).defaultTo(0);
    t.string('payment_mode').defaultTo('Cash');
    t.decimal('cash_amount', 14, 2);
    t.decimal('online_amount', 14, 2);
    t.text('internal_notes');
    t.string('status').defaultTo('Paid');
    t.string('type').defaultTo('Sale');
    t.boolean('is_credit_sale').defaultTo(false);
    t.decimal('paid_amount', 14, 2).defaultTo(0);
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('invoice_items', (t) => {
    t.increments('id').primary();
    t.integer('invoice_id').references('id').inTable('invoices').onDelete('CASCADE');
    t.integer('product_id').references('id').inTable('products').onDelete('SET NULL');
    t.string('product_code');
    t.string('product_name');
    t.integer('qty').defaultTo(1);
    t.decimal('rate', 14, 2).defaultTo(0);
    t.decimal('amount', 14, 2).defaultTo(0);
  });

  await knex.schema.createTable('return_exchange', (t) => {
    t.increments('id').primary();
    t.integer('original_invoice_id').references('id').inTable('invoices').onDelete('SET NULL');
    t.string('invoice_no');
    t.string('customer_name');
    t.string('type').notNullable();
    t.integer('total_items_sold');
    t.integer('items_returned').defaultTo(0);
    t.decimal('return_amount', 14, 2).defaultTo(0);
    t.decimal('exchange_amount', 14, 2).defaultTo(0);
    t.decimal('net_amount', 14, 2).defaultTo(0);
    t.string('status').defaultTo('complete');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('date').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('return_exchange_items', (t) => {
    t.increments('id').primary();
    t.integer('return_id').references('id').inTable('return_exchange').onDelete('CASCADE');
    t.integer('product_id').references('id').inTable('products').onDelete('SET NULL');
    t.string('product_name');
    t.integer('returned_qty').defaultTo(0);
    t.integer('exchange_qty').defaultTo(0);
    t.decimal('rate', 14, 2);
  });

  await knex.schema.createTable('vendors', (t) => {
    t.increments('id').primary();
    t.string('vendor_name').notNullable();
    t.string('company_name');
    t.string('email');
    t.string('phone');
    t.string('street_address');
    t.string('city');
    t.string('province_state');
    t.string('postal_code');
    t.string('account_name');
    t.string('account_number');
    t.decimal('outstanding_balance', 14, 2).defaultTo(0);
    t.string('status').defaultTo('Active');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('purchase_invoices', (t) => {
    t.increments('id').primary();
    t.string('po_number').notNullable().unique();
    t.integer('vendor_id').references('id').inTable('vendors').onDelete('SET NULL');
    t.string('vendor_name');
    t.date('purchase_date');
    t.decimal('subtotal', 14, 2).defaultTo(0);
    t.decimal('grand_total', 14, 2).defaultTo(0);
    t.decimal('paid_amount', 14, 2).defaultTo(0);
    t.decimal('pending_amount', 14, 2).defaultTo(0);
    t.text('purchase_note');
    t.string('status').defaultTo('Pending');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('purchase_invoice_items', (t) => {
    t.increments('id').primary();
    t.integer('purchase_invoice_id').references('id').inTable('purchase_invoices').onDelete('CASCADE');
    t.integer('product_id').references('id').inTable('products').onDelete('SET NULL');
    t.string('product_name');
    t.string('product_code');
    t.integer('qty').defaultTo(0);
    t.decimal('price', 14, 2).defaultTo(0);
    t.decimal('total', 14, 2).defaultTo(0);
  });

  await knex.schema.createTable('purchase_returns', (t) => {
    t.increments('id').primary();
    t.string('po_number');
    t.integer('vendor_id').references('id').inTable('vendors').onDelete('SET NULL');
    t.string('vendor_name');
    t.integer('original_invoice_id').references('id').inTable('purchase_invoices').onDelete('SET NULL');
    t.integer('purchased_qty').defaultTo(0);
    t.integer('return_qty').defaultTo(0);
    t.decimal('return_total', 14, 2).defaultTo(0);
    t.text('return_reason');
    t.string('status').defaultTo('Pending');
    t.date('order_date');
  });

  await knex.schema.createTable('purchase_return_items', (t) => {
    t.increments('id').primary();
    t.integer('purchase_return_id').references('id').inTable('purchase_returns').onDelete('CASCADE');
    t.integer('product_id').references('id').inTable('products').onDelete('SET NULL');
    t.string('item_name');
    t.string('sku');
    t.integer('purchased_qty').defaultTo(0);
    t.integer('return_qty').defaultTo(0);
    t.decimal('purchase_price', 14, 2).defaultTo(0);
    t.decimal('total', 14, 2).defaultTo(0);
  });

  await knex.schema.createTable('banking_transactions', (t) => {
    t.increments('id').primary();
    t.string('txn_id').unique();
    t.integer('account_id').references('id').inTable('accounts').onDelete('SET NULL');
    t.string('account_name');
    t.date('date');
    t.text('description');
    t.string('type');
    t.decimal('amount', 14, 2).defaultTo(0);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('expense_categories', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().unique();
    t.boolean('is_active').defaultTo(true);
  });

  await knex.schema.createTable('expenses', (t) => {
    t.increments('id').primary();
    t.integer('category_id');
    t.string('category_name');
    t.decimal('amount', 14, 2).defaultTo(0);
    t.string('payment_mode').defaultTo('Cash');
    t.text('description');
    t.date('expense_date');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('pay_bills', (t) => {
    t.increments('id').primary();
    t.integer('vendor_id').references('id').inTable('vendors').onDelete('SET NULL');
    t.integer('purchase_invoice_id').references('id').inTable('purchase_invoices').onDelete('SET NULL');
    t.decimal('amount', 14, 2).defaultTo(0);
    t.string('payment_mode').defaultTo('Cash');
    t.date('payment_date');
    t.string('reference_no');
    t.text('notes');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('notifications', (t) => {
    t.increments('id').primary();
    t.string('type');
    t.string('title');
    t.text('message');
    t.integer('user_id').references('id').inTable('users').onDelete('SET NULL');
    t.integer('reference_id');
    t.string('reference_type');
    t.string('link');
    t.boolean('is_read').defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('invoice_settings', (t) => {
    t.integer('id').primary().defaultTo(1);
    t.string('inv_prefix').defaultTo('INV');
    t.string('inv_suffix').defaultTo('');
    t.integer('inv_start_number').defaultTo(1);
    t.integer('inv_padding').defaultTo(3);
    t.string('seller_name').defaultTo('');
    t.string('seller_tagline').defaultTo('');
    t.string('seller_phone').defaultTo('');
    t.string('seller_email').defaultTo('');
    t.string('seller_website').defaultTo('');
    t.string('seller_gstin').defaultTo('');
    t.string('seller_pan').defaultTo('');
    t.text('seller_address').defaultTo('');
    t.string('template_color').defaultTo('#111111');
    t.string('template_layout').defaultTo('Classic');
    t.boolean('show_customer_info').defaultTo(true);
    t.boolean('show_due_date').defaultTo(true);
    t.boolean('show_hsn').defaultTo(true);
    t.boolean('show_tax_breakdown').defaultTo(true);
    t.boolean('show_bank_details').defaultTo(true);
    t.boolean('show_signature').defaultTo(true);
    t.boolean('show_terms').defaultTo(true);
    t.boolean('show_logo').defaultTo(true);
    t.boolean('show_watermark').defaultTo(false);
    t.string('bank_name').defaultTo('');
    t.string('bank_account_no').defaultTo('');
    t.string('bank_ifsc').defaultTo('');
    t.string('bank_branch').defaultTo('');
    t.text('footer_notes').defaultTo('Thank you for your business!');
    t.text('terms_conditions').defaultTo('');
    t.text('custom_fields').defaultTo('[]');
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('app_settings', (t) => {
    t.string('key').primary();
    t.text('value');
  });
};

exports.down = async function down(knex) {
  await knex.schema
    .dropTableIfExists('app_settings')
    .dropTableIfExists('invoice_settings')
    .dropTableIfExists('notifications')
    .dropTableIfExists('pay_bills')
    .dropTableIfExists('expenses')
    .dropTableIfExists('expense_categories')
    .dropTableIfExists('banking_transactions')
    .dropTableIfExists('purchase_return_items')
    .dropTableIfExists('purchase_returns')
    .dropTableIfExists('purchase_invoice_items')
    .dropTableIfExists('purchase_invoices')
    .dropTableIfExists('vendors')
    .dropTableIfExists('return_exchange_items')
    .dropTableIfExists('return_exchange')
    .dropTableIfExists('invoice_items')
    .dropTableIfExists('invoices')
    .dropTableIfExists('accounts')
    .dropTableIfExists('products')
    .dropTableIfExists('categories')
    .dropTableIfExists('customers')
    .dropTableIfExists('user_permissions')
    .dropTableIfExists('users')
    .dropTableIfExists('user_roles')
    .dropTableIfExists('role_permissions')
    .dropTableIfExists('permissions')
    .dropTableIfExists('branches')
    .dropTableIfExists('company_profile');
};
