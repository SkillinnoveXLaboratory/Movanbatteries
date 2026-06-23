const field = (name, label, type = 'text', extra = {}) => ({ name, label, type, ...extra });

export const resources = {
  customers: {
    title: 'Customers', eyebrow: 'Relationship management', endpoint: '/customers', searchable: true,
    columns: ['name', 'mobileNumber', 'vehicleNumbers', 'tags', 'createdAt'],
    fields: [field('name', 'Customer name', 'text', { required: true }), field('mobileNumber', 'Mobile number', 'tel', { required: true }), field('vehicleNumbers', 'Vehicle numbers', 'tags'), field('address', 'Address', 'textarea'), field('shopId', 'Shop', 'select', { required: true, optionsSource: 'shops' }), field('tags', 'Tags', 'tags')],
    create: true, edit: true,
  },
  batteries: {
    title: 'Registered Batteries', eyebrow: 'Warranty registry', endpoint: '/batteries', searchable: true,
    columns: ['batterySerialNumber', 'customerId', 'batteryBrand', 'batteryModel', 'vehicleNumber', 'purchaseDate', 'warrantyPeriodMonths'],
    fields: [field('customerId', 'Customer', 'select', { required: true, optionsSource: 'customers' }), field('batteryBrand', 'Brand', 'text', { required: true }), field('batteryModel', 'Model', 'text', { required: true }), field('batterySerialNumber', 'Serial number', 'text', { required: true }), field('purchaseDate', 'Purchase date', 'date', { required: true }), field('warrantyPeriodMonths', 'Warranty (months)', 'number', { required: true }), field('invoiceNumber', 'Invoice number'), field('vehicleNumber', 'Vehicle number')],
    create: true, edit: true,
  },
  loaners: {
    title: 'Loaner Batteries', eyebrow: 'Temporary battery fleet', endpoint: '/loaner-batteries',
    columns: ['serialNumber', 'brand', 'batteryModel', 'status', 'currentServiceCaseId', 'updatedAt'],
    fields: [field('serialNumber', 'Serial number', 'text', { required: true }), field('brand', 'Brand', 'text', { required: true }), field('batteryModel', 'Battery model', 'text', { required: true }), field('status', 'Status', 'select', { options: ['available', 'in_use', 'damaged', 'retired'] }), field('remarks', 'Remarks', 'textarea')],
    create: true, edit: true,
  },
  products: {
    title: 'Products', eyebrow: 'Product catalogue', endpoint: '/products', searchable: true,
    columns: ['productName', 'productCode', 'category', 'brand', 'unitPrice', 'currentStock', 'minStockLevel'],
    fields: [field('productName', 'Product name', 'text', { required: true }), field('productCode', 'Product code', 'text', { required: true }), field('category', 'Category', 'text', { required: true }), field('brand', 'Brand', 'text', { required: true }), field('unitPrice', 'Unit price', 'number', { required: true }), field('currentStock', 'Opening stock', 'number'), field('minStockLevel', 'Minimum stock', 'number')],
    create: true, edit: true,
  },
  dealers: {
    title: 'Dealers', eyebrow: 'Supplier network', endpoint: '/dealers', searchable: true,
    columns: ['name', 'contactPerson', 'mobile', 'email', 'address', 'outstandingBalance'],
    fields: [field('name', 'Dealer name', 'text', { required: true }), field('contactPerson', 'Contact person'), field('mobile', 'Mobile', 'tel', { required: true }), field('email', 'Email', 'email'), field('address', 'Address', 'textarea')],
    create: true, edit: true,
  },
  purchases: {
    title: 'Purchases', eyebrow: 'Stock procurement', endpoint: '/purchases',
    columns: ['invoiceNumber', 'dealerId', 'purchaseDate', 'items', 'totalAmount', 'paymentStatus'],
    fields: [field('dealerId', 'Dealer', 'select', { required: true, optionsSource: 'dealers' }), field('purchaseDate', 'Purchase date', 'date', { required: true }), field('items', 'Items', 'lineItems', { required: true, priceField: 'unitCost', priceLabel: 'Unit cost' }), field('totalAmount', 'Total amount', 'number', { required: true }), field('invoiceNumber', 'Invoice number', 'text', { required: true }), field('paymentStatus', 'Payment status', 'select', { options: ['Pending', 'Partial', 'Paid'] })],
    create: true, edit: true,
  },
  sales: {
    title: 'Sales', eyebrow: 'Customer transactions', endpoint: '/sales',
    columns: ['saleDate', 'customerId', 'items', 'totalAmount', 'paymentMethod', 'recordedBy'],
    fields: [field('saleDate', 'Sale date', 'date', { required: true }), field('customerId', 'Customer', 'select', { required: true, optionsSource: 'customers' }), field('items', 'Items', 'lineItems', { required: true, priceField: 'unitPrice', priceLabel: 'Unit price' }), field('totalAmount', 'Total amount', 'number', { required: true }), field('paymentMethod', 'Payment method', 'select', { options: ['Cash', 'UPI', 'Card', 'Credit'] })],
    create: true, edit: true, delete: true,
  },
  expenses: {
    title: 'Expenses', eyebrow: 'Operating costs', endpoint: '/expenses',
    columns: ['date', 'category', 'description', 'amount', 'recordedBy', 'createdAt'],
    fields: [field('category', 'Category', 'select', { options: ['Rent', 'Utilities', 'Salary', 'Transport', 'Maintenance', 'Marketing', 'Other'], required: true }), field('amount', 'Amount', 'number', { required: true }), field('date', 'Expense date', 'date', { required: true }), field('description', 'Description', 'textarea')],
    create: true, edit: true, delete: true,
  },
  users: {
    title: 'Users & Staff', eyebrow: 'Access administration', endpoint: '/users',
    columns: ['name', 'mobile', 'role', 'shopId', 'isActive', 'createdAt'],
    fields: [field('name', 'Name', 'text', { required: true }), field('mobile', 'Mobile', 'tel', { required: true }), field('password', 'Password', 'password', { createOnly: true, required: true }), field('role', 'Role', 'select', { options: ['Admin', 'Dealer', 'Staff'], required: true }), field('shopId', 'Shop', 'select', { required: true, optionsSource: 'shops' }), field('isActive', 'Account status', 'select', { options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] })],
    create: true, edit: true,
  },
  shops: {
    title: 'Shops', eyebrow: 'Branch administration', endpoint: '/shops',
    columns: ['name', 'branchCode', 'phone', 'address', 'createdAt'],
    fields: [field('name', 'Shop name', 'text', { required: true }), field('branchCode', 'Branch code'), field('phone', 'Phone', 'tel'), field('address', 'Address', 'textarea')],
    create: true, edit: true,
  },
  alertRules: {
    title: 'Alert Rules', eyebrow: 'Automation controls', endpoint: '/alerts/rules',
    columns: ['type', 'condition', 'action', 'isActive', 'createdAt'],
    fields: [field('type', 'Rule type', 'select', { options: ['threshold', 'schedule'], required: true }), field('condition', 'Condition', 'text', { required: true, placeholder: 'pending > 5' }), field('action', 'Action', 'text', { required: true, placeholder: 'notify_admin' })],
    create: true, edit: true, delete: true,
  },
  audit: {
    title: 'Audit Log', eyebrow: 'Security and accountability', endpoint: '/audit-logs',
    columns: ['createdAt', 'userId', 'action', 'details'], fields: [],
  },
  roles: {
    title: 'Roles', eyebrow: 'Permission reference', endpoint: '/roles',
    columns: ['name', 'description', 'permissions'], fields: [],
  },
  templates: {
    title: 'Message Templates', eyebrow: 'Customer communication', endpoint: '/message-templates',
    columns: ['name', 'templateName', 'title', 'content', 'isActive'], fields: [],
  },
};

export const labels = {
  name: 'Name', mobile: 'Mobile', mobileNumber: 'Mobile', vehicleNumbers: 'Vehicles', tags: 'Tags', createdAt: 'Created', updatedAt: 'Updated',
  batterySerialNumber: 'Serial number', customerId: 'Customer', batteryBrand: 'Brand', batteryModel: 'Model', vehicleNumber: 'Vehicle', purchaseDate: 'Purchased', warrantyPeriodMonths: 'Warranty',
  serialNumber: 'Serial number', brand: 'Brand', status: 'Status', currentServiceCaseId: 'Service case', productName: 'Product', productCode: 'Code', category: 'Category', unitPrice: 'Price', currentStock: 'Stock', minStockLevel: 'Min. stock',
  contactPerson: 'Contact', email: 'Email', address: 'Address', outstandingBalance: 'Balance', invoiceNumber: 'Invoice', dealerId: 'Dealer', items: 'Items', totalAmount: 'Total', paymentStatus: 'Payment', saleDate: 'Sale date', paymentMethod: 'Payment', recordedBy: 'Recorded by', date: 'Date', description: 'Description', amount: 'Amount', role: 'Role', shopId: 'Shop', isActive: 'Active', branchCode: 'Branch code', phone: 'Phone', type: 'Type', condition: 'Condition', action: 'Action', userId: 'User', details: 'Details', permissions: 'Permissions', templateName: 'Template', title: 'Title', content: 'Content',
};
