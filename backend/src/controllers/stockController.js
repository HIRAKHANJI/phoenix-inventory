// ADD STOCK
const addStock = async (req, res) => {
  let { product_id, warehouse_name, warehouse_id, quantity, shelf_code, product_name } = req.body;

  try {
    // Resilience: Resolve product_id if only name was provided
    if (!product_id && product_name) {
      const pRes = await req.db.query('SELECT id FROM products WHERE name = $1 LIMIT 1', [product_name]);
      if (pRes.rows.length > 0) {
        product_id = pRes.rows[0].id;
      } else {
        return res.status(404).json({ message: `Product "${product_name}" not found in catalog.` });
      }
    }

    if (!product_id) return res.status(400).json({ message: 'Product ID or valid Product Name is required.' });

    const qtyNum = Number(quantity);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      return res.status(400).json({ message: 'Quantity must be a positive number.' });
    }

    // Resilience: Map warehouse_id to name if provided by frontend
    const resolvedWarehouseName = warehouse_name || (Number(warehouse_id) === 1 ? 'Warehouse 2' : Number(warehouse_id) === 2 ? 'Warehouse 3' : 'Main Warehouse');

    const existing = await req.db.query(
      'SELECT * FROM stock WHERE product_id=$1 AND warehouse_name=$2 AND shelf_code=$3',
      [product_id, resolvedWarehouseName, shelf_code || 'N/A']
    );

    let result;
    if (existing.rows.length > 0) {
      result = await req.db.query(
        'UPDATE stock SET quantity = quantity + $1, updated_at = NOW() WHERE id=$2 RETURNING *',
        [qtyNum, existing.rows[0].id]
      );
    } else {
      result = await req.db.query(
        'INSERT INTO stock (product_id, warehouse_name, quantity, shelf_code) VALUES ($1,$2,$3,$4) RETURNING *',
        [product_id, resolvedWarehouseName, qtyNum, shelf_code || 'N/A']
      );
    }


    // Notification trigger
    const prodRes = await req.db.query('SELECT name FROM products WHERE id = $1', [product_id]);
    const productName = prodRes.rows[0]?.name || product_id;
    const user_name = req.user?.name || "System";
    const notificationMessage = `Stock ADDED: ${qtyNum} units to ${productName} in ${resolvedWarehouseName} by ${user_name}`;
    
    await req.db.query(
      'INSERT INTO notifications (message, user_name, type) VALUES ($1, $2, $3)',
      [notificationMessage, user_name, 'STOCK_UPDATE']
    ).catch(() => {});

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// REMOVE STOCK
const removeStock = async (req, res) => {
  let { product_id, warehouse_name, warehouse_id, quantity, shelf_code, product_name } = req.body;

  try {
    // Resilience: Resolve product_id if only name was provided
    if (!product_id && product_name) {
      const pRes = await req.db.query('SELECT id FROM products WHERE name = $1 LIMIT 1', [product_name]);
      if (pRes.rows.length > 0) {
        product_id = pRes.rows[0].id;
      } else {
        return res.status(404).json({ message: `Product "${product_name}" not found in catalog.` });
      }
    }

    if (!product_id) return res.status(400).json({ message: 'Product ID or valid Product Name is required.' });

    const qtyNum = Number(quantity);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      return res.status(400).json({ message: 'Quantity must be a positive number.' });
    }

    // Resilience: Map warehouse_id to name if provided by frontend
    const resolvedWarehouseName = warehouse_name || (Number(warehouse_id) === 1 ? 'Warehouse 2' : Number(warehouse_id) === 2 ? 'Warehouse 3' : 'Main Warehouse');

    const existing = await req.db.query(
      'SELECT * FROM stock WHERE product_id=$1 AND warehouse_name=$2 AND shelf_code=$3',
      [product_id, resolvedWarehouseName, shelf_code || 'N/A']
    );

    const onHand = existing.rows[0] ? Number(existing.rows[0].quantity) : 0;
    if (existing.rows.length === 0 || onHand < qtyNum) {
      return res.status(400).json({ message: 'Insufficient stock or record not found in this location.' });
    }

    const updated = await req.db.query(
      'UPDATE stock SET quantity = quantity - $1, updated_at = NOW() WHERE id=$2 RETURNING *',
      [qtyNum, existing.rows[0].id]
    );


    const prodRes = await req.db.query('SELECT name FROM products WHERE id = $1', [product_id]);
    const productName = prodRes.rows[0]?.name || product_id;
    const user_name = req.user?.name || "System";
    const notificationMessage = `Stock REMOVED: ${qtyNum} units from ${productName} in ${resolvedWarehouseName} by ${user_name}`;
    
    await req.db.query(
      'INSERT INTO notifications (message, user_name, type) VALUES ($1, $2, $3)',
      [notificationMessage, user_name, 'STOCK_UPDATE']
    ).catch(() => {});

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET STOCK
const getStock = async (req, res) => {
  try {
    const stock = await req.db.query(
      `SELECT s.id, s.product_id, p.name AS product_name, p.sku AS product_sku, p.category,
              s.warehouse_name, s.quantity, s.shelf_code, s.updated_at
       FROM stock s
       JOIN products p ON s.product_id = p.id
       ORDER BY p.name ASC`
    );
    res.json(stock.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE STOCK ITEM
const updateStockItem = async (req, res) => {
  const { id } = req.params;
  const { quantity, shelf_code } = req.body;

  try {
    const result = await req.db.query(
      'UPDATE stock SET quantity = $1, shelf_code = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [quantity, shelf_code, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Stock record not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE STOCK ITEM
const deleteStockItem = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await req.db.query('DELETE FROM stock WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Stock record not found.' });
    }
    res.json({ message: 'Stock record removed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { addStock, removeStock, getStock, updateStockItem, deleteStockItem };