// Add Product (Atomic Transaction: Creates Product + Initial Stock)
const addProduct = async (req, res) => {
  const {
    name,
    warehouse_name,
    warehouse_id,
    shelf_code,
    sku: providedSku,
    category,
    unit,
    cost_per_unit,
    initial_quantity,
    description: bodyDescription
  } = req.body;
  const companyPrefix = (req.company || 'phoenix').toUpperCase().slice(0, 3);

  // Auto-generate a professional SKU if not provided
  const sku = providedSku || `${companyPrefix}-${Date.now().toString().slice(-6)}`;
  const description = (typeof bodyDescription === 'string' && bodyDescription.trim()) || 'Registered Asset';

  // Resilience: Map warehouse_id to name if provided by frontend
  const resolvedWarehouseName = warehouse_name || (Number(warehouse_id) === 1 ? 'Warehouse 2' : Number(warehouse_id) === 2 ? 'Warehouse 3' : 'Main Warehouse');

  const parsedCost = cost_per_unit === undefined || cost_per_unit === '' ? 0 : Number(cost_per_unit);
  const safeCost = Number.isFinite(parsedCost) ? parsedCost : 0;
  const parsedQty = initial_quantity === undefined || initial_quantity === '' ? 0 : Number(initial_quantity);
  const safeQty = Number.isFinite(parsedQty) && parsedQty >= 0 ? parsedQty : 0;

  const client = await req.db.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Product
    const productRes = await client.query(
      'INSERT INTO products (name, sku, description, category, unit, cost_per_unit) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [name, sku, description, category || 'raw_material', unit || 'pcs', safeCost]
    );
    const productId = productRes.rows[0].id;

    // 2. Insert Initial Stock record
    await client.query(
      'INSERT INTO stock (product_id, warehouse_name, quantity, shelf_code) VALUES ($1, $2, $3, $4)',
      [productId, resolvedWarehouseName, safeQty, shelf_code || 'N/A']
    );

    // 3. Notification
    const alertMsg = `New Asset Registered: ${name} (${sku}) by ${req.user?.name || 'System'}`;
    await client.query(
      'INSERT INTO notifications (message, user_name, type) VALUES ($1, $2, $3)',
      [alertMsg, req.user?.name || 'System', 'PRODUCT_CREATE']
    ).catch(() => {});

    await client.query('COMMIT');
    res.status(201).json({
      id: productId,
      sku,
      message: 'Product and stock record successfully initialized'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: `Operational Failure: ${err.message}` });
  } finally {
    client.release();
  }
};

// Get All Products (Admin/User)
const getProducts = async (req, res) => {
  try {
    const products = await req.db.query('SELECT * FROM products ORDER BY name ASC');
    res.json(products.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Product (Admin only)
const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, sku, description, category, unit, cost_per_unit } = req.body;
  try {
    const existing = await req.db.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Product not found.' });
    const prev = existing.rows[0];
    const mergedSku = sku !== undefined && sku !== null && String(sku).trim() !== '' ? sku : prev.sku;
    const mergedName = name !== undefined ? name : prev.name;
    const mergedDesc = description !== undefined ? description : prev.description;
    const mergedCat = category !== undefined ? category : prev.category;
    const mergedUnit = unit !== undefined ? unit : prev.unit;
    const parsedCost = cost_per_unit === undefined || cost_per_unit === '' ? prev.cost_per_unit : Number(cost_per_unit);
    const mergedCost = Number.isFinite(Number(parsedCost)) ? parsedCost : prev.cost_per_unit;

    const updated = await req.db.query(
      'UPDATE products SET name=$1, sku=$2, description=$3, category=$4, unit=$5, cost_per_unit=$6 WHERE id=$7 RETURNING *',
      [mergedName, mergedSku, mergedDesc, mergedCat, mergedUnit, mergedCost, id]
    );
    if (updated.rows.length === 0) return res.status(404).json({ message: 'Product not found.' });
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete Product (Admin only)
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    await req.db.query('DELETE FROM products WHERE id=$1', [id]);
    res.json({ message: 'Asset removed from operational catalog.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { addProduct, getProducts, updateProduct, deleteProduct };