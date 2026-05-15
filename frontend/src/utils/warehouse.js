/** Utility for stock row deduplication — location is now free-text, no hardcoded warehouses. */

export function stockRowKey(item) {
  return `${item.source || 'inv'}-${item.id}`;
}

/**
 * Groups an array of stock items by their warehouse_name field.
 * Returns an object like: { "Main Store": [...items], "Shelf A": [...items] }
 */
export function groupByLocation(items) {
  return items.reduce((groups, item) => {
    const location = item.warehouse_name || 'Unassigned';
    if (!groups[location]) groups[location] = [];
    groups[location].push(item);
    return groups;
  }, {});
}
