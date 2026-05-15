const BaseService = require('./BaseService');
const path = require('path');
const fs = require('fs');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable');

// Status flow: which transitions are allowed
const ALLOWED_TRANSITIONS = {
  not_started: ['active', 'closed'],
  active:      ['not_started', 'closed'],
  closed:      ['active', 'not_started'],
};

class ManufacturingService extends BaseService {
  constructor(projectRepository, itemRepository, inventoryItemRepository, knex) {
    super(projectRepository);
    this.itemRepository = itemRepository;
    this.inventoryItemRepository = inventoryItemRepository;
    this.knex = knex;
  }

  _checkAccess(project, user) {
    if (!project) throw { statusCode: 404, message: 'Project not found.' };
    const isAdmin = ['admin', 'super_admin'].includes(user?.role);
    const isOwner = project.created_by === user?.id;
    
    if (!isAdmin && !isOwner) {
      throw { statusCode: 403, message: 'You do not have permission to modify this project. Only the creator or an administrator can perform this action.' };
    }
  }

  _checkProjectOpen(project) {
    if (project.status === 'closed') {
      throw { statusCode: 403, message: 'This project is closed and cannot be modified. Please re-open it (set status to Active or Not Started) to make changes.' };
    }
  }


  // ──────────────────────────────────────────────────────────────
  // PROJECTS
  // ──────────────────────────────────────────────────────────────

  async createProject({ machine_name, note = null, budget = 0 }, userId) {
    if (!machine_name || !machine_name.trim()) {
      throw { statusCode: 400, message: 'Machine name is required.' };
    }
    return this.repository.create({
      machine_name: machine_name.trim(),
      status: 'not_started',
      note: note || null,
      budget: parseFloat(budget) || 0,
      created_by: userId
    });
  }

  async updateProject(id, { machine_name, note, budget }, user) {
    const project = await this.repository.findById(id);
    this._checkAccess(project, user);
    

    const updateData = {};
    if (machine_name !== undefined) updateData.machine_name = machine_name.trim();
    if (note !== undefined) updateData.note = note || null;
    if (budget !== undefined) updateData.budget = parseFloat(budget) || 0;
    updateData.updated_at = new Date();

    return this.repository.update(id, updateData);
  }

  async getAllProjects() {
    return this.repository.findAllWithCost();
  }

  async getProjectDetail(id) {
    const project = await this.repository.findWithItems(id);
    if (!project) throw { statusCode: 404, message: 'Manufacturing project not found.' };
    return project;
  }

  async updateStatus(id, newStatus, user) {
    const project = await this.repository.findById(id);
    this._checkAccess(project, user);

    const allowed = ALLOWED_TRANSITIONS[project.status] || [];
    if (!allowed.includes(newStatus)) {
      throw {
        statusCode: 400,
        message: `Invalid status transition: '${project.status}' → '${newStatus}'. Allowed: ${allowed.length ? allowed.join(', ') : 'none (project is closed).'}`
      };
    }

    return this.repository.update(id, { status: newStatus, updated_at: new Date() });
  }

  async deleteProject(id, user) {
    const project = await this.repository.findWithItems(id);
    if (!project) throw { statusCode: 404, message: 'Project not found.' };
    this._checkAccess(project, user);

    return this.knex.transaction(async (trx) => {
      // Restore stock for all items in the project before deleting
      for (const item of project.items) {
        // Try to find a stock record to restore to
        const stockRecord = await trx('stock')
          .where({ product_id: item.product_id })
          .first();
        
        const targetWarehouse = stockRecord ? stockRecord.warehouse_name : 'Main warehouse';
        
        if (stockRecord) {
          await trx('stock')
            .where({ id: stockRecord.id })
            .update({ 
              quantity: trx.raw('quantity + ?', [parseFloat(item.quantity_used)]),
              updated_at: trx.fn.now()
            });
        } else {
          await trx('stock').insert({
            product_id: item.product_id,
            warehouse_name: targetWarehouse,
            quantity: parseFloat(item.quantity_used)
          });
        }

        // Record transaction
        await trx('inventory_transactions').insert({
          product_id: item.product_id,
          warehouse_name: targetWarehouse,
          quantity: parseFloat(item.quantity_used),
          type: 'IN',
          user_id: user.id,
          notes: `Restored from deleted Manufacturing Project #${id} (${project.machine_name})`
        });
      }

      // Delete the project (cascades to manufacturing_items)
      return trx('manufacturing_projects').where({ id }).del();
    });
  }

  // ──────────────────────────────────────────────────────────────
  // BILL OF MATERIALS OPERATIONS (INTEGRATED WITH STOCK)
  // ──────────────────────────────────────────────────────────────


  async addItemToProject(projectId, productId, quantityUsed, cost, user) {
    quantityUsed = parseFloat(quantityUsed);
    cost = parseFloat(cost) || 0;
    if (!quantityUsed || quantityUsed <= 0) {
      throw { statusCode: 400, message: 'Quantity must be greater than 0.' };
    }

    const project = await this.repository.findById(projectId);
    this._checkAccess(project, user);
    this._checkProjectOpen(project);

    return this.knex.transaction(async (trx) => {
      // 1. Fetch item and total stock
      const product = await this.knex('products')
        .transacting(trx)
        .where({ id: productId })
        .forUpdate()
        .first();

      if (!product) throw { statusCode: 404, message: 'Item not found in catalog.' };

      const stocks = await this.knex('stock')
        .transacting(trx)
        .where({ product_id: productId })
        .orderBy('quantity', 'desc')
        .forUpdate();

      const totalAvail = stocks.reduce((sum, s) => sum + parseFloat(s.quantity), 0);

      if (totalAvail < quantityUsed) {
        throw {
          statusCode: 400,
          message: `Insufficient stock for "${product.name}". Total available across warehouses: ${totalAvail}, requested: ${quantityUsed}.`,
        };
      }

      // 2. Deduct from warehouses (FIFO-ish, highest quantity first)
      let remainingToDeduct = quantityUsed;
      for (const stockRecord of stocks) {
        if (remainingToDeduct <= 0) break;
        
        const deductFromThis = Math.min(parseFloat(stockRecord.quantity), remainingToDeduct);
        
        await this.knex('stock')
          .transacting(trx)
          .where({ id: stockRecord.id })
          .update({ 
            quantity: this.knex.raw('quantity - ?', [deductFromThis]), 
            updated_at: this.knex.fn.now() 
          });

        // Record transaction for audit
        await this.knex('inventory_transactions')
          .transacting(trx)
          .insert({
            product_id: productId,
            warehouse_name: stockRecord.warehouse_name,
            shelf_code: stockRecord.shelf_code,
            quantity: -deductFromThis,
            type: 'OUT',
            user_id: user.id,
            notes: `Consumption for Manufacturing Project #${projectId}`
          });

        remainingToDeduct -= deductFromThis;
      }

      // 3. Update Bill of Materials (manufacturing_items)
      const existing = await this.knex('manufacturing_items')
        .transacting(trx)
        .where({ project_id: projectId, product_id: productId })
        .first();

      if (existing) {
        const newQtyUsed = parseFloat(existing.quantity_used) + quantityUsed;
        await this.knex('manufacturing_items')
          .transacting(trx)
          .where({ id: existing.id })
          .update({ quantity_used: newQtyUsed, cost: cost });
        return { ...existing, quantity_used: newQtyUsed, cost: cost };
      } else {
        const [row] = await this.knex('manufacturing_items')
          .transacting(trx)
          .insert({ project_id: projectId, product_id: productId, quantity_used: quantityUsed, cost: cost })
          .returning('*');
        return row[0] || row;
      }
    });
  }

  async removeItemFromProject(projectId, bomItemId, user) {
    const project = await this.repository.findById(projectId);
    this._checkAccess(project, user);
    this._checkProjectOpen(project);

    return this.knex.transaction(async (trx) => {

      const bomRow = await this.knex('manufacturing_items')
        .transacting(trx)
        .where({ id: bomItemId, project_id: projectId })
        .first();
      if (!bomRow) throw { statusCode: 404, message: 'BOM item not found.' };

      // Restore stock - we'll restore to the warehouse it was most likely taken from, or just the first one
      const stockRecord = await this.knex('stock')
        .transacting(trx)
        .where({ product_id: bomRow.product_id })
        .first() || await this.knex('stock')
          .transacting(trx)
          .insert({ product_id: bomRow.product_id, warehouse_name: 'Main warehouse', quantity: 0 })
          .returning('*')
          .then(rows => rows[0]);

      await this.knex('stock')
        .transacting(trx)
        .where({ id: stockRecord.id })
        .update({ 
          quantity: this.knex.raw('quantity + ?', [parseFloat(bomRow.quantity_used)]), 
          updated_at: this.knex.fn.now() 
        });

      // Record transaction
      await this.knex('inventory_transactions')
        .transacting(trx)
        .insert({
          product_id: bomRow.product_id,
          warehouse_name: stockRecord.warehouse_name,
          quantity: parseFloat(bomRow.quantity_used),
          type: 'IN',
          user_id: user.id,
          notes: `Restored from deleted Manufacturing Project #${projectId}`
        });

      await this.knex('manufacturing_items')
        .transacting(trx)
        .where({ id: bomItemId })
        .del();

      return { deleted: true };
    });
  }

  async updateItemQuantity(projectId, bomItemId, newQuantity, newCost, user) {
    newQuantity = parseFloat(newQuantity);
    if (newQuantity <= 0) throw { statusCode: 400, message: 'Quantity must be greater than 0.' };
    const cost = newCost !== undefined ? parseFloat(newCost) : undefined;
    
    const project = await this.repository.findById(projectId);
    this._checkAccess(project, user);
    this._checkProjectOpen(project);

    return this.knex.transaction(async (trx) => {
      const bomRow = await this.knex('manufacturing_items')
        .transacting(trx)
        .where({ id: bomItemId, project_id: projectId })
        .forUpdate()
        .first();

      if (!bomRow) throw { statusCode: 404, message: 'BOM item not found.' };

      const diff = newQuantity - parseFloat(bomRow.quantity_used);
      if (diff === 0) return bomRow;

      if (diff > 0) {
        // Deduct more stock
        const stocks = await this.knex('stock')
          .transacting(trx)
          .where({ product_id: bomRow.product_id })
          .orderBy('quantity', 'desc')
          .forUpdate();

        const totalAvail = stocks.reduce((sum, s) => sum + parseFloat(s.quantity), 0);
        if (totalAvail < diff) throw { statusCode: 400, message: 'Insufficient stock for adjustment.' };

        let remainingToDeduct = diff;
        for (const s of stocks) {
          if (remainingToDeduct <= 0) break;
          const deduct = Math.min(parseFloat(s.quantity), remainingToDeduct);
          await this.knex('stock').transacting(trx).where({ id: s.id }).update({ quantity: this.knex.raw('quantity - ?', [deduct]) });
          
          await this.knex('inventory_transactions')
            .transacting(trx)
            .insert({
              product_id: bomRow.product_id,
              warehouse_name: s.warehouse_name,
              quantity: -deduct,
              type: 'OUT',
              user_id: user.id,
              notes: `Additional consumption for Project #${projectId} (Adjustment)`
            });

          remainingToDeduct -= deduct;
        }
      } else {
        // Restore stock
        const restoreQty = Math.abs(diff);
        // Try to find a stock record for this product to restore to
        const stockRecord = await this.knex('stock')
          .transacting(trx)
          .where({ product_id: bomRow.product_id })
          .first();
        
        const targetWarehouse = stockRecord ? stockRecord.warehouse_name : 'Main warehouse';
        
        if (stockRecord) {
          await this.knex('stock').transacting(trx).where({ id: stockRecord.id }).update({ quantity: this.knex.raw('quantity + ?', [restoreQty]) });
        } else {
          await this.knex('stock').transacting(trx).insert({
            product_id: bomRow.product_id,
            warehouse_name: targetWarehouse,
            quantity: restoreQty
          });
        }

        await this.knex('inventory_transactions')
          .transacting(trx)
          .insert({
            product_id: bomRow.product_id,
            warehouse_name: targetWarehouse,
            quantity: restoreQty,
            type: 'IN',
            user_id: user.id,
            notes: `Restored from Project #${projectId} (Adjustment)`
          });
      }

      const updateData = { quantity_used: newQuantity };
      if (cost !== undefined) updateData.cost = cost;

      const updated = await this.knex('manufacturing_items')
        .transacting(trx)
        .where({ id: bomItemId })
        .update(updateData)
        .returning('*');

      return updated[0];
    });
  }

  // ──────────────────────────────────────────────────────────────
  // PDF REPORT
  // ──────────────────────────────────────────────────────────────

  async generatePdfReport(projectId) {
    const project = await this.repository.findWithItems(projectId);
    if (!project) throw { statusCode: 404, message: 'Project not found.' };

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // ── Logo
    const logoPath = path.join(__dirname, '../../..', 'frontend/src/assets/inpack-logo.png');
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath);
      const base64Logo = `data:image/png;base64,${logoData.toString('base64')}`;
      doc.addImage(base64Logo, 'PNG', 14, 10, 40, 18);
    }

    // ── Header bar background
    doc.setFillColor(10, 36, 99);
    doc.rect(0, 0, pageW, 8, 'F');

    // ── Title
    doc.setFontSize(18);
    doc.setTextColor(10, 36, 99);
    doc.setFont('helvetica', 'bold');
    doc.text('Manufacturing Project Report', 60, 20);

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.setFont('helvetica', 'normal');
    doc.text('Inpack Manufacturing System', 60, 26);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 60, 31);

    // ── Status label colour
    const STATUS_COLORS = {
      not_started: [107, 114, 128],
      active:      [37, 99, 235],
      closed:      [22, 163, 74],
    };
    const statusColor = STATUS_COLORS[project.status] || [80, 80, 80];
    const statusLabel = (project.status || 'not_started').replace('_', ' ').toUpperCase();

    // ── Project Info box
    doc.setFillColor(245, 247, 252);
    doc.roundedRect(14, 37, 182, 38, 3, 3, 'F');
    doc.setDrawColor(220, 228, 245);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, 37, 182, 38, 3, 3, 'S');

    const labelX = 18;
    const valueX = 60;
    const col2LabelX = 118;
    const col2ValueX = 148;

    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.setFont('helvetica', 'bold');
    doc.text('MACHINE / PROJECT', labelX, 45);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(project.machine_name || '—', labelX, 52);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80);
    doc.text('STATUS', labelX, 62);
    doc.setTextColor(...statusColor);
    doc.setFont('helvetica', 'bold');
    doc.text(statusLabel, labelX, 69);

    doc.setTextColor(80);
    doc.setFont('helvetica', 'bold');
    doc.text('CREATED BY', col2LabelX, 45);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20);
    doc.text(project.creator_name || '—', col2LabelX, 52);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80);
    doc.text('DATE', col2LabelX, 62);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20);
    const dateStr = project.created_at
      ? new Date(project.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    doc.text(dateStr, col2LabelX, 69);

    // ── Operational Notes
    if (project.note) {
      doc.setFillColor(255, 251, 235);
      doc.roundedRect(14, 79, 182, 14, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 80, 0);
      doc.text('OPERATIONAL NOTES:', 18, 85);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 50, 0);
      doc.text(doc.splitTextToSize(project.note, 160), 18, 90);
    }

    // ── Bill of Materials table
    const tableStartY = project.note ? 97 : 82;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(10, 36, 99);
    doc.text('Bill of Materials', 14, tableStartY);

    const tableRows = project.items.map((item, i) => {
      const qty    = parseFloat(item.quantity_used) || 0;
      const cost   = parseFloat(item.cost) || 0;
      const amount = qty * cost;
      return [
        i + 1,
        item.item_name || '—',
        item.category === 'spare_part' ? 'Spare Part' : 'Raw Material',
        item.unit || 'pcs',
        qty.toLocaleString('en-IN'),
        cost > 0 ? `Rs. ${cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—',
        amount > 0 ? `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—',
      ];
    });

    autoTable.default(doc, {
      startY: tableStartY + 4,
      head: [['#', 'Item Name', 'Category', 'Unit', 'Qty Used', 'Unit Cost', 'Amount']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [10, 36, 99], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: 30 },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 26 },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 26, halign: 'right' },
        6: { cellWidth: 28, halign: 'right' },
      },
      didDrawPage: (data) => {
        // footer on each page
        doc.setFontSize(7);
        doc.setTextColor(160);
        doc.setFont('helvetica', 'normal');
        doc.text('Inpack Manufacturing System — Confidential', 14, pageH - 8);
        doc.text(`Page ${data.pageNumber}`, pageW - 14, pageH - 8, { align: 'right' });
      },
    });

    // ── Financial Summary
    const finalY = doc.lastAutoTable.finalY + 8;
    const budget     = parseFloat(project.budget)     || 0;
    const totalCost  = parseFloat(project.total_cost) || 0;
    const variance   = budget - totalCost;

    doc.setFillColor(10, 36, 99);
    doc.roundedRect(14, finalY, 182, 34, 3, 3, 'F');

    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('FINANCIAL SUMMARY', 20, finalY + 8);

    // Budget
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 210, 255);
    doc.text('Budget Allocation', 20, finalY + 16);
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Rs. ${budget.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 20, finalY + 23);

    // Total Cost
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 210, 255);
    doc.text('Total Project Cost', 80, finalY + 16);
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Rs. ${totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 80, finalY + 23);

    // Variance
    const varianceColor = variance >= 0 ? [134, 239, 172] : [252, 165, 165];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 210, 255);
    doc.text('Variance (Budget - Cost)', 148, finalY + 16);
    doc.setTextColor(...varianceColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Rs. ${variance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 148, finalY + 23);

    return Buffer.from(doc.output('arraybuffer'));
  }
}

module.exports = ManufacturingService;
