import React, { useState } from 'react';
import { ArrowDownUp, ArrowLeftRight, Plus, Truck, Warehouse } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { EmptyState } from '@/src/components/ui/StateViews';
import { Surface } from '@/src/components/ui/Surface';
import { CHART_PALETTE, DonutChart, GroupedBarChart } from '@/src/components/charts/ErpCharts';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { ShipmentRecord, StockMovement, StockTransfer } from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

type InventoryTab = 'stock' | 'warehouses' | 'logistics';

export function InventoryView({ onNavigate }: { onNavigate: (routeId: string) => void }) {
  const { activeCompany } = useTenant();
  const {
    data,
    adjustStock,
    addWarehouse,
    transferStock,
    addShipment,
    updateShipmentStatus,
  } = useErpData();
  const currency = activeCompany.baseCurrency;
  const stockedItems = data.catalogue.filter((i) => i.trackStock);

  const [tab, setTab] = useState<InventoryTab>('stock');
  const [showAdjust, setShowAdjust] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [direction, setDirection] = useState<'in' | 'out' | 'adjustment'>('in');
  const [quantity, setQuantity] = useState('1');
  const [batchNumber, setBatchNumber] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Warehouse & Transfer State
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');
  const [whLoc, setWhLoc] = useState('');
  const [trItemId, setTrItemId] = useState('');
  const [trFrom, setTrFrom] = useState('Main Warehouse');
  const [trTo, setTrTo] = useState('');
  const [trQty, setTrQty] = useState('1');
  const [trNotes, setTrNotes] = useState('');

  // Logistics / Fleet State
  const [shpOrder, setShpOrder] = useState('');
  const [shpCarrier, setShpCarrier] = useState('In-House Fleet');
  const [shpVehicle, setShpVehicle] = useState('');
  const [shpDriver, setShpDriver] = useState('');
  const [shpOrigin, setShpOrigin] = useState('Central Hub');
  const [shpDest, setShpDest] = useState('');
  const [shpCost, setShpCost] = useState('0');

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

  const handleAddWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim()) return;
    addWarehouse({
      code: whCode.trim().toUpperCase() || `WH-${data.warehouses.length + 1}`,
      name: whName.trim(),
      location: whLoc.trim() || 'Primary Facility',
      isDefault: data.warehouses.length === 0,
    });
    setWhCode('');
    setWhName('');
    setWhLoc('');
    setNotice('Added warehouse location.');
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const targetId = trItemId || stockedItems[0]?.id;
    if (!targetId) {
      setError('Add a stock-tracked item first.');
      return;
    }
    try {
      const tr = transferStock({
        itemId: targetId,
        fromWarehouse: trFrom || 'Main Warehouse',
        toWarehouse: trTo || 'Secondary Depot',
        quantity: Math.max(1, Number(trQty) || 1),
        notes: trNotes.trim(),
      });
      setTrQty('1');
      setTrNotes('');
      setNotice(`Posted inter-warehouse transfer ${tr.transferNumber}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed.');
    }
  };

  const handleAddShipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shpDest.trim()) return;
    const created = addShipment({
      orderNumber: shpOrder.trim() || 'DISPATCH',
      carrier: shpCarrier.trim() || 'In-House Fleet',
      vehicleReg: shpVehicle.trim() || '—',
      driverName: shpDriver.trim() || 'Assigned Driver',
      origin: shpOrigin.trim() || 'Warehouse',
      destination: shpDest.trim(),
      status: 'scheduled',
      dispatchDate: new Date().toISOString().slice(0, 10),
      cost: Math.max(0, Number(shpCost) || 0),
      notes: '',
    });
    setShpOrder('');
    setShpDest('');
    setShpCost('0');
    setNotice(`Scheduled shipment ${created.trackingNumber}.`);
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
                  : 'text-[#DC2626]'
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

  const transferColumns: DataColumn<StockTransfer>[] = [
    {
      key: 'num',
      header: 'Transfer #',
      render: (r) => <span className="font-mono text-xs font-semibold">{r.transferNumber}</span>,
    },
    {
      key: 'item',
      header: 'SKU & Product',
      render: (r) => (
        <div>
          <div className="font-semibold">{r.itemName}</div>
          <div className="font-mono text-[11px] text-[#718096]">{r.sku}</div>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Warehouse Route',
      render: (r) => (
        <span className="text-xs">
          {r.fromWarehouse} → <strong>{r.toWarehouse}</strong>
        </span>
      ),
    },
    {
      key: 'qty',
      header: 'Qty',
      align: 'right',
      numeric: true,
      render: (r) => <span className="font-semibold">{r.quantity}</span>,
    },
  ];

  const shipmentColumns: DataColumn<ShipmentRecord>[] = [
    {
      key: 'trk',
      header: 'Tracking & Order',
      render: (r) => (
        <div>
          <div className="font-mono text-xs font-semibold">{r.trackingNumber}</div>
          <div className="text-[11px] text-[#718096]">Order: {r.orderNumber} · {r.dispatchDate}</div>
        </div>
      ),
    },
    {
      key: 'carrier',
      header: 'Carrier / Fleet',
      render: (r) => (
        <div>
          <div className="font-medium">{r.carrier}</div>
          <div className="text-[11px] text-[#718096]">
            Vehicle: {r.vehicleReg} · Driver: {r.driverName}
          </div>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (r) => (
        <span className="text-xs">
          {r.origin} → {r.destination}
        </span>
      ),
    },
    {
      key: 'cost',
      header: `Freight (${currency})`,
      align: 'right',
      numeric: true,
      render: (r) => <span>{formatNumericCurrency(r.cost, currency, 2)}</span>,
    },
    {
      key: 'status',
      header: 'Delivery Status',
      render: (r) => (
        <select
          value={r.status}
          onChange={(e) => updateShipmentStatus(r.id, e.target.value as ShipmentRecord['status'])}
          className="h-7 px-2 rounded-md text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A] cursor-pointer"
        >
          <option value="scheduled">Scheduled</option>
          <option value="in_transit">In Transit</option>
          <option value="delivered">Delivered</option>
        </select>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            Inventory, WMS & Fleet Logistics
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Multi-warehouse stock ledger, invoice reservations, FIFO batches, inter-warehouse transfers, and fleet shipment tracking.
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

      {/* Sub-navigation Tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#251B20]">
        <button
          type="button"
          onClick={() => setTab('stock')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'stock'
              ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
              : 'text-[#718096] dark:text-slate-400'
          }`}
        >
          Stock & Movements ({data.stockMovements.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('warehouses')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'warehouses'
              ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
              : 'text-[#718096] dark:text-slate-400'
          }`}
        >
          Warehouses & Transfers ({data.warehouses.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('logistics')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'logistics'
              ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
              : 'text-[#718096] dark:text-slate-400'
          }`}
        >
          Logistics & Fleet ({data.shipments.length})
        </button>
      </div>

      {error && (
        <Surface padding="sm" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </Surface>
      )}
      {notice && (
        <Surface padding="sm" className="text-xs font-medium text-[#16B8A6]">
          {notice}
        </Surface>
      )}

      {showAdjust && stockedItems.length > 0 && (
        <Surface padding="lg">
          <form onSubmit={handleAdjust} className="space-y-4">
            <h2 className="text-sm font-semibold">Manual Stock Adjustment (Optimistic Lock)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Item / SKU</label>
                <select
                  value={selectedItemId || stockedItems[0]?.id}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
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
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
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
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Batch / Lot (Optional)</label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. BATCH-2026-01"
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Reason / Audit Note</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Cycle count or damaged goods"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
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

      {tab === 'stock' && (
        <>
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
                    <div className="mt-1 font-semibold text-sm text-[#1C1917] dark:text-slate-100 truncate">
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

          {stockedItems.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Surface padding="lg" className="lg:col-span-2 space-y-3">
                <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                  Stock On Hand vs Reorder Level
                </h2>
                <GroupedBarChart
                  data={stockedItems.slice(0, 8).map((item) => ({
                    label: item.sku,
                    primary: item.stockOnHand,
                    secondary: item.reorderLevel,
                  }))}
                  primaryLabel="On Hand"
                  secondaryLabel="Reorder Level"
                  primaryColor="#16B8A6"
                  secondaryColor="#F59E0B"
                  formatValue={(v) => `${v} units`}
                  height={190}
                />
              </Surface>

              <Surface padding="lg" className="space-y-3">
                <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                  Inventory Asset Allocation
                </h2>
                <DonutChart
                  slices={stockedItems
                    .filter((i) => i.inventoryAssetValue > 0)
                    .sort((a, b) => b.inventoryAssetValue - a.inventoryAssetValue)
                    .slice(0, 6)
                    .map((item, idx) => ({
                      label: item.sku,
                      value: item.inventoryAssetValue,
                      color: CHART_PALETTE[idx % CHART_PALETTE.length],
                    }))}
                  centerLabel="Stock Value"
                  centerValue={formatNumericCurrency(
                    stockedItems.reduce((s, i) => s + i.inventoryAssetValue, 0),
                    currency,
                    0,
                  )}
                  formatValue={(v) => formatNumericCurrency(v, currency, 0)}
                />
              </Surface>
            </div>
          )}

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
        </>
      )}

      {tab === 'warehouses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Surface padding="lg">
              <form onSubmit={handleAddWarehouse} className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-[#DC2626]" />
                  Add Warehouse / Bin Location
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value)}
                    placeholder="Code (e.g. WH-BLR)"
                    className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <input
                    type="text"
                    required
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    placeholder="Warehouse Name *"
                    className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <input
                    type="text"
                    value={whLoc}
                    onChange={(e) => setWhLoc(e.target.value)}
                    placeholder="City / Zone"
                    className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="primary" size="sm">
                    Save Warehouse
                  </Button>
                </div>
              </form>
            </Surface>

            <Surface padding="lg">
              <form onSubmit={handleTransfer} className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-[#16B8A6]" />
                  Inter-Warehouse Stock Transfer
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <select
                    value={trItemId || stockedItems[0]?.id || ''}
                    onChange={(e) => setTrItemId(e.target.value)}
                    className="sm:col-span-2 h-9 px-2.5 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  >
                    {stockedItems.length === 0 ? (
                      <option value="">No stock SKUs</option>
                    ) : (
                      stockedItems.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.sku} · {i.name} ({i.stockOnHand})
                        </option>
                      ))
                    )}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={trQty}
                    onChange={(e) => setTrQty(e.target.value)}
                    placeholder="Qty"
                    className="h-9 px-2.5 rounded-lg text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <input
                    type="text"
                    value={trFrom}
                    onChange={(e) => setTrFrom(e.target.value)}
                    placeholder="From Warehouse"
                    className="h-9 px-2.5 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <input
                    type="text"
                    required
                    value={trTo}
                    onChange={(e) => setTrTo(e.target.value)}
                    placeholder="To Warehouse *"
                    className="sm:col-span-2 h-9 px-2.5 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <input
                    type="text"
                    value={trNotes}
                    onChange={(e) => setTrNotes(e.target.value)}
                    placeholder="Transfer notes"
                    className="h-9 px-2.5 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <Button type="submit" variant="primary" size="sm" disabled={stockedItems.length === 0}>
                    Transfer
                  </Button>
                </div>
              </form>
            </Surface>
          </div>

          {data.warehouses.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.warehouses.map((w) => (
                <Surface key={w.id}>
                  <div className="font-mono text-xs text-[#DC2626] font-semibold">{w.code}</div>
                  <div className="text-sm font-bold mt-0.5">{w.name}</div>
                  <div className="text-xs text-[#718096] dark:text-slate-400">{w.location}</div>
                </Surface>
              ))}
            </div>
          )}

          <DataTable
            data={data.stockTransfers}
            columns={transferColumns}
            getRowKey={(r) => r.id}
            searchPlaceholder="Search transfers..."
            searchPredicate={(r, q) =>
              `${r.transferNumber} ${r.sku} ${r.fromWarehouse} ${r.toWarehouse}`.toLowerCase().includes(q)
            }
            emptyTitle="No inter-warehouse transfers yet"
            emptyDescription="Transfer available stock between warehouses while preserving immutable stock movement audit logs."
          />
        </div>
      )}

      {tab === 'logistics' && (
        <div className="space-y-6">
          <Surface padding="lg">
            <form onSubmit={handleAddShipment} className="space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-[#DC2626]" />
                Schedule Dispatch / Fleet Shipment
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  value={shpOrder}
                  onChange={(e) => setShpOrder(e.target.value)}
                  placeholder="Order / Reference #"
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={shpCarrier}
                  onChange={(e) => setShpCarrier(e.target.value)}
                  placeholder="Carrier / Fleet"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={shpVehicle}
                  onChange={(e) => setShpVehicle(e.target.value)}
                  placeholder="Vehicle Reg #"
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={shpDriver}
                  onChange={(e) => setShpDriver(e.target.value)}
                  placeholder="Driver Name"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={shpOrigin}
                  onChange={(e) => setShpOrigin(e.target.value)}
                  placeholder="Origin Hub"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  required
                  value={shpDest}
                  onChange={(e) => setShpDest(e.target.value)}
                  placeholder="Destination Address / City *"
                  className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={shpCost}
                    onChange={(e) => setShpCost(e.target.value)}
                    placeholder="Freight Cost"
                    className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <Button type="submit" variant="primary" size="sm" className="h-9 shrink-0">
                    Dispatch
                  </Button>
                </div>
              </div>
            </form>
          </Surface>

          <DataTable
            data={data.shipments}
            columns={shipmentColumns}
            getRowKey={(r) => r.id}
            searchPlaceholder="Search tracking number, carrier, driver, or route..."
            searchPredicate={(r, q) =>
              `${r.trackingNumber} ${r.orderNumber} ${r.carrier} ${r.driverName} ${r.destination}`
                .toLowerCase()
                .includes(q)
            }
            emptyTitle="No fleet or carrier shipments yet"
            emptyDescription="Create dispatch manifests, assign vehicles & drivers, and track delivery status."
          />
        </div>
      )}
    </div>
  );
}
