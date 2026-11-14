import React, { useState } from 'react';
import { ArrowDownUp, Plus } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { EmptyState } from '@/src/components/ui/StateViews';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { StockMovement } from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

export function InventoryView({ onNavigate }: { onNavigate: (routeId: string) => void }) {
  const { activeCompany } = useTenant();
  const { data, adjustStock } = useErpData();
  const currency = activeCompany.baseCurrency;
  const stockedItems = data.catalogue.filter((i) => i.trackStock);

  const [showAdjust, setShowAdjust] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [direction, setDirection] = useState<'in' | 'out' | 'adjustment'>('in');
  const [quantity, setQuantity] = useState('1');
  const [batchNumber, setBatchNumber] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const targetId = selectedItemId || stockedItems[0]?.id;
    const targetItem = stockedItems.find((i) => i.id === targetId);
    if (!targetId || !targetItem) {
      setError('Select a stock-tracked item first.');
      return;
    }
    const qty = Math.max(0, Number(quantity) || 0);
    if (qty <= 0 && direction !== 'adjustment') {
      setError('Quantity must be greater than zero.');
      return;
    }
    try {
      const updated = adjustStock({
        itemId: targetId,
        direction,
        quantity: qty,
        reason,
        expectedVersion: targetItem.version,
        batchNumber: batchNumber.trim() || undefined,
      });
      setQuantity('1');
      setBatchNumber('');
      setReason('');
      setShowAdjust(false);
      setNotice(`Updated ${updated.sku} stock balance to ${updated.stockOnHand} (v${updated.version}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stock adjustment failed.');
    }
  };

  const movementColumns: DataColumn<StockMovement>[] = [
    {
      key: 'sku',
      header: 'SKU & Product',
      sortable: true,
      sortValue: (r) => r.sku,
      render: (r) => (
        <div>
          <div className="font-mono text-xs font-semibold">{r.sku}</div>
          <div className="text-xs text-[#718096] dark:text-slate-400">{r.itemName}</div>
        </div>
      ),
    },
    {
      key: 'direction',
      header: 'Movement',
      render: (r) => (
        <div>
          <span
            className={`text-xs font-semibold capitalize ${
              r.direction === 'in'
                ? 'text-[#16B8A6]'
                : r.direction === 'out'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-[#4169F5]'
            }`}
          >
            {r.movementType.replace('_', ' ')}
          </span>
          {r.batchNumber && (
            <div className="font-mono text-[10px] text-[#718096] dark:text-slate-400">
              Batch: {r.batchNumber}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'qty',
      header: 'Qty',
      align: 'right',
      numeric: true,
      render: (r) => (
        <span>
          {r.direction === 'out' ? '-' : ''}
          {r.quantity}
        </span>
      ),
    },
    {
      key: 'value',
      header: `Value (${currency})`,
      align: 'right',
      numeric: true,
      render: (r) => <span>{formatNumericCurrency(r.totalValue, currency, 2)}</span>,
    },
    {
      key: 'balance',
      header: 'On Hand / Res.',
      align: 'right',
      numeric: true,
      render: (r) => (
        <div>
          <span className="font-semibold">{r.balanceAfter}</span>
          <span className="text-[11px] text-[#718096] dark:text-slate-400 ml-1">
            ({r.reservedAfter} res.)
          </span>
        </div>
      ),
    },
    {
      key: 'ref',
      header: 'Reference & Reason',
      render: (r) => (
        <div className="text-xs">
          <div className="font-mono text-[11px]">{r.reference}</div>
          <div className="text-[#718096] dark:text-slate-400">{r.reason}</div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            Inventory, Reservations & Valuation
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Live stock on hand, invoice reservations, FIFO batches, weighted-average asset valuation, and versioned stock adjustments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onNavigate('module:catalogue')}>
            <Plus className="h-3.5 w-3.5" />
            Add SKU
          </Button>
          {stockedItems.length > 0 && (
            <Button variant="primary" size="sm" onClick={() => setShowAdjust((v) => !v)}>
              <ArrowDownUp className="h-3.5 w-3.5" />
              {showAdjust ? 'Close Adjustment' : 'Adjust Stock'}
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <Surface padding="sm" className="text-xs font-medium text-[#16B8A6]">
          {notice}
        </Surface>
      )}

      {showAdjust && stockedItems.length > 0 && (
        <Surface padding="lg">
          <form onSubmit={handleAdjust} className="space-y-4">
            <h2 className="text-sm font-semibold">Manual Stock Adjustment (Optimistic Lock)</h2>
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Item / SKU</label>
                <select
                  value={selectedItemId || stockedItems[0]?.id}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                >
                  {stockedItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} · {item.name} (OnHand: {item.stockOnHand}, Res: {item.reservedQty})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Action</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as typeof direction)}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                >
                  <option value="in">Stock In (+)</option>
                  <option value="out">Stock Out (-)</option>
                  <option value="adjustment">Set Exact Count</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  {direction === 'adjustment' ? 'New Stock Balance' : 'Quantity'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Batch / Lot (Optional)</label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. BATCH-2026-01"
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Reason / Audit Note</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Cycle count or damaged goods"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAdjust(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Post Stock Movement
              </Button>
            </div>
          </form>
        </Surface>
      )}

      {/* Current Stock Balances */}
      {stockedItems.length === 0 ? (
        <EmptyState
          title="No inventory-tracked SKUs yet"
          description="Add a physical product with inventory tracking enabled in Universal Catalogue to manage stock levels here."
          actionLabel="Go to Catalogue"
          onAction={() => onNavigate('module:catalogue')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stockedItems.map((item) => {
            const available = item.stockOnHand - item.reservedQty;
            const isLow = available <= item.reorderLevel;
            return (
              <Surface key={item.id}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-[#718096] dark:text-slate-400">
                    {item.sku} · v{item.version}
                  </span>
                  <span
                    className={`font-medium ${
                      isLow ? 'text-amber-600 dark:text-amber-400' : 'text-[#16B8A6]'
                    }`}
                  >
                    {available <= 0 ? 'No Available' : isLow ? 'Low Stock' : 'Available'}
                  </span>
                </div>
                <div className="mt-1 font-semibold text-sm text-[#182238] dark:text-slate-100 truncate">
                  {item.name}
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl font-bold font-mono tabular-nums">
                    {item.stockOnHand}{' '}
                    <span className="text-xs font-normal text-[#718096]">{item.unit}</span>
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-[#718096] dark:text-slate-400">
                    {formatNumericCurrency(item.inventoryAssetValue, currency, 2)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-[#718096] dark:text-slate-400 font-mono tabular-nums">
                  <span>Reserved: {item.reservedQty}</span>
                  <span>Avail: {available}</span>
                </div>
              </Surface>
            );
          })}
        </div>
      )}

      {/* Movement Ledger */}
      <DataTable
        data={data.stockMovements}
        columns={movementColumns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search movements by SKU, product, batch, or reference..."
        searchPredicate={(r, q) =>
          `${r.sku} ${r.itemName} ${r.reference} ${r.reason} ${r.batchNumber ?? ''}`
            .toLowerCase()
            .includes(q)
        }
        emptyTitle="No stock movements recorded yet"
        emptyDescription="Stock openings, reservations, Sales dispatches, Purchase GRNs, and manual adjustments are logged here."
      />
    </div>
  );
}
