const BaseService = require('./BaseService');
const path = require('path');
const fs = require('fs');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable');

// Status flow: which transitions are allowed
const ALLOWED_TRANSITIONS = {
  not_started: ['active'],
  active: ['closed'],
  closed: [],
};

class ManufacturingService extends BaseService {
  constructor(projectRepository, itemRepository, inventoryItemRepository, knex) {
    super(projectRepository);
    this.itemRepository = itemRepository;
    this.inventoryItemRepository = inventoryItemRepository;
    this.knex = knex;
  }

  // ──────────────────────────────────────────────────────────────
  // PROJECTS
  // ──────────────────────────────────────────────────────────────

  async createProject({ machine_name, note = null }) {
    if (!machine_name || !machine_name.trim()) {
      throw { statusCode: 400, message: 'Machine name is required.' };
    }
    return this.repository.create({
      machine_name: machine_name.trim(),
      status: 'not_started',
      note: note || null,
    });
  }

  async getAllProjects() {
    return this.repository.findAllWithCost();
  }

  async getProjectDetail(id) {
    const project = await this.repository.findWithItems(id);
    if (!project) throw { statusCode: 404, message: 'Manufacturing project not found.' };
    return project;
  }

  async updateStatus(id, newStatus) {
    const project = await this.repository.findById(id);
    if (!project) throw { statusCode: 404, message: 'Manufacturing project not found.' };

    const allowed = ALLOWED_TRANSITIONS[project.status] || [];
    if (!allowed.includes(newStatus)) {
      throw {
        statusCode: 400,
        message: `Invalid status transition: '${project.status}' → '${newStatus}'. Allowed: ${allowed.length ? allowed.join(', ') : 'none (project is closed).'}`
      };
    }

    return this.repository.update(id, { status: newStatus, updated_at: new Date() });
  }

  // ──────────────────────────────────────────────────────────────
  // BILL OF MATERIALS OPERATIONS
  // ──────────────────────────────────────────────────────────────

  async _assertNotClosed(projectId) {
    const project = await this.repository.findById(projectId);
    if (!project) throw { statusCode: 404, message: 'Manufacturing project not found.' };
    if (project.status === 'closed') {
      throw { statusCode: 403, message: 'This project is closed. No further edits are allowed.' };
    }
    return project;
  }

  async addItemToProject(projectId, inventoryItemId, quantityUsed) {
    quantityUsed = parseFloat(quantityUsed);
    if (!quantityUsed || quantityUsed <= 0) {
      throw { statusCode: 400, message: 'Quantity must be greater than 0.' };
    }

    await this._assertNotClosed(projectId);

    return this.knex.transaction(async (trx) => {
      // Lock and fetch inventory item
      const invItem = await this.knex('inventory_items')
        .transacting(trx)
        .where({ id: inventoryItemId })
        .forUpdate()
        .first();

      if (!invItem) throw { statusCode: 404, message: 'Inventory item not found.' };
      if (parseFloat(invItem.quantity) < quantityUsed) {
        throw {
          statusCode: 400,
          message: `Insufficient stock for "${invItem.name}". Available: ${invItem.quantity}, requested: ${quantityUsed}.`,
        };
      }

      // Deduct stock
      await this.knex('inventory_items')
        .transacting(trx)
        .where({ id: inventoryItemId })
        .update({ quantity: this.knex.raw('quantity - ?', [quantityUsed]), updated_at: this.knex.fn.now() });

      // Upsert manufacturing_items (handle duplication)
      const existing = await this.knex('manufacturing_items')
        .transacting(trx)
        .where({ project_id: projectId, inventory_item_id: inventoryItemId })
        .first();

      const costPerUnit = parseFloat(invItem.cost_per_unit);

      if (existing) {
        const newQtyUsed = parseFloat(existing.quantity_used) + quantityUsed;
        const newCost = newQtyUsed * costPerUnit;
        await this.knex('manufacturing_items')
          .transacting(trx)
          .where({ id: existing.id })
          .update({ quantity_used: newQtyUsed, cost: newCost });
        return { ...existing, quantity_used: newQtyUsed, cost: newCost };
      } else {
        const cost = quantityUsed * costPerUnit;
        const [row] = await this.knex('manufacturing_items')
          .transacting(trx)
          .insert({ project_id: projectId, inventory_item_id: inventoryItemId, quantity_used: quantityUsed, cost })
          .returning('*');
        return row;
      }
    });
  }

  async updateItemInProject(projectId, bomItemId, newQuantityUsed) {
    newQuantityUsed = parseFloat(newQuantityUsed);
    if (!newQuantityUsed || newQuantityUsed <= 0) {
      throw { statusCode: 400, message: 'Quantity must be greater than 0.' };
    }

    await this._assertNotClosed(projectId);

    return this.knex.transaction(async (trx) => {
      const bomRow = await this.knex('manufacturing_items')
        .transacting(trx)
        .where({ id: bomItemId, project_id: projectId })
        .first();
      if (!bomRow) throw { statusCode: 404, message: 'BOM item not found.' };

      const invItem = await this.knex('inventory_items')
        .transacting(trx)
        .where({ id: bomRow.inventory_item_id })
        .forUpdate()
        .first();

      // Restore old quantity back to stock
      const restoredQty = parseFloat(invItem.quantity) + parseFloat(bomRow.quantity_used);

      // Validate new quantity against restored stock
      if (restoredQty < newQuantityUsed) {
        throw {
          statusCode: 400,
          message: `Insufficient stock for "${invItem.name}". Available (after restore): ${restoredQty}, requested: ${newQuantityUsed}.`,
        };
      }

      // Apply new deduction
      const finalQty = restoredQty - newQuantityUsed;
      await this.knex('inventory_items')
        .transacting(trx)
        .where({ id: invItem.id })
        .update({ quantity: finalQty, updated_at: this.knex.fn.now() });

      const newCost = newQuantityUsed * parseFloat(invItem.cost_per_unit);
      await this.knex('manufacturing_items')
        .transacting(trx)
        .where({ id: bomItemId })
        .update({ quantity_used: newQuantityUsed, cost: newCost });

      return { ...bomRow, quantity_used: newQuantityUsed, cost: newCost };
    });
  }

  async removeItemFromProject(projectId, bomItemId) {
    await this._assertNotClosed(projectId);

    return this.knex.transaction(async (trx) => {
      const bomRow = await this.knex('manufacturing_items')
        .transacting(trx)
        .where({ id: bomItemId, project_id: projectId })
        .first();
      if (!bomRow) throw { statusCode: 404, message: 'BOM item not found.' };

      // Restore stock
      await this.knex('inventory_items')
        .transacting(trx)
        .where({ id: bomRow.inventory_item_id })
        .update({ quantity: this.knex.raw('quantity + ?', [bomRow.quantity_used]), updated_at: this.knex.fn.now() });

      await this.knex('manufacturing_items')
        .transacting(trx)
        .where({ id: bomItemId })
        .del();

      return { deleted: true };
    });
  }

  // ──────────────────────────────────────────────────────────────
  // PDF REPORT
  // ──────────────────────────────────────────────────────────────

  async generatePdfReport(projectId) {
    const project = await this.repository.findWithItems(projectId);
    if (!project) throw { statusCode: 404, message: 'Project not found.' };
    if (project.status !== 'closed') {
      throw { statusCode: 403, message: 'PDF report is only available for closed projects.' };
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // ── Logo
    const logoPath = path.join(__dirname, '../../..', 'frontend/src/assets/inpack-logo.png');
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath);
      const base64Logo = `data:image/png;base64,${logoData.toString('base64')}`;
      doc.addImage(base64Logo, 'PNG', 14, 10, 40, 18);
    }

    // ── Header
    doc.setFontSize(20);
    doc.setTextColor(10, 36, 99);
    doc.setFont('helvetica', 'bold');
    doc.text('Inpack — Manufacturing Report', 60, 20);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 60, 26);

    // ── Project Info box
    doc.setFillColor(245, 247, 252);
    doc.roundedRect(14, 34, 182, 28, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.setFont('helvetica', 'bold');
    doc.text('Machine Name:', 18, 43);
    doc.setFont('helvetica', 'normal');
    doc.text(project.machine_name, 55, 43);

    doc.setFont('helvetica', 'bold');
    doc.text('Status:', 18, 51);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(22, 163, 74);
    doc.text('CLOSED', 55, 51);

    doc.setTextColor(30);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', 110, 43);
    doc.setFont('helvetica', 'normal');
    const noteText = project.note || '—';
    doc.text(doc.splitTextToSize(noteText, 80), 128, 43);

    // ── Bill of Materials table
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(10, 36, 99);
    doc.text('Bill of Materials', 14, 72);

    const tableRows = project.items.map((item, i) => [
      i + 1,
      item.item_name,
      item.category === 'spare_part' ? 'Spare Part' : 'Raw Material',
      `${item.quantity_used} ${item.unit}`,
      `₹ ${parseFloat(item.cost_per_unit).toFixed(2)}`,
      `₹ ${parseFloat(item.cost).toFixed(2)}`,
    ]);

    autoTable.default(doc, {
      startY: 76,
      head: [['#', 'Item Name', 'Category', 'Qty Used', 'Cost / Unit', 'Total Cost']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [10, 36, 99], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: 30 },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
    });

    // ── Grand Total
    const finalY = doc.previousAutoTable.finalY + 6;
    doc.setFillColor(10, 36, 99);
    doc.roundedRect(130, finalY, 66, 12, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255);
    doc.text('GRAND TOTAL:', 134, finalY + 8);
    doc.text(`₹ ${project.total_cost.toFixed(2)}`, 185, finalY + 8, { align: 'right' });

    // ── Footer
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated by Inpack Manufacturing System', 14, 285);
    doc.text(`Page 1`, 196, 285, { align: 'right' });

    return Buffer.from(doc.output('arraybuffer'));
  }
}

module.exports = ManufacturingService;
