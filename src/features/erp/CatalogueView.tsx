import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { CatalogueItem, CatalogueItemType } from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

export function CatalogueView() {
  const { activeCompany } = useTenant();
  const { data, addCatalogueItem, deleteCatalogueItem } = useErpData();

  const [showForm, setShowForm] = useState(false);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<CatalogueItemType>('physical');
  const [category, setCategory] = useState('General');
  const [unit, setUnit] = useState('Nos');
  const [costPrice, setCostPrice] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [taxRate, setTaxRate] = useState('18');
  const [trackStock, setTrackStock] = useState(true);
  const [stockOnHand, setStockOnHand] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [formError, setFormError] = useState<string | null>(null);

  const currency = activeCompany.baseCurrency;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Item or service name is required.');
      return;
    }
    const generatedSku =
      sku.trim().toUpperCase() ||
      `SKU-${String(data.catalogue.length + 1).padStart(4, '0')}`;

    try {
      addCatalogueItem({
        sku: generatedSku,
        name: name.trim(),
        type,
        category: category.trim() || 'General',
        unit: unit.trim() || 'Nos',
        costPrice: Math.max(0, Number(costPrice) || 0),
        sellingPrice: Math.max(0, Number(sellingPrice) || 0),
        taxRate: Math.max(0, Number(taxRate) || 0),
        trackStock: type === 'physical' ? trackStock : false,
        stockOnHand: type === 'physical' && trackStock ? Math.max(0, Number(stockOnHand) || 0) : 0,
        reorderLevel: Math.max(0, Number(reorderLevel) || 0),
      });

      setSku('');
      setName('');
      setCostPrice('0');
      setSellingPrice('0');
      setStockOnHand('0');
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save item.');
    }
  };

  const columns: DataColumn<CatalogueItem>[] = [
    {
      key: 'sku',
      header: 'SKU',
      sortable: true,
      sortValue: (r) => r.sku,
      render: (r) => <span className="font-mono text-xs font-semibold">{r.sku}</span>,
    },
    {
      key: 'name',
      header: 'Item / Service',
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <div className="font-medium text-[#182238] dark:text-slate-100">{r.name}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400 capitalize">
            {r.type} · {r.category} · {r.unit}
          </div>
        </div>
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      numeric: true,
      render: (r) => <span>{formatNumericCurrency(r.costPrice, currency, 2)}</span>,
    },
    {
      key: 'price',
      header: 'Selling Price',
      align: 'right',
      numeric: true,
      sortable: true,
      sortValue: (r) => r.sellingPrice,
      render: (r) => (
        <span className="font-semibold">
          {formatNumericCurrency(r.sellingPrice, currency, 2)}
        </span>
      ),
    },
    {
      key: 'tax',
      header: 'Tax %',
      align: 'right',
      numeric: true,
      render: (r) => <span>{r.taxRate}%</span>,
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      numeric: true,
      render: (r) =>
        r.trackStock ? (
          <span
            className={
              r.stockOnHand <= r.reorderLevel
                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                : 'text-[#16B8A6] font-semibold'
            }
          >
            {r.stockOnHand} {r.unit}
          </span>
        ) : (
          <span className="text-[#718096] dark:text-slate-400 font-sans text-xs">
            Non-stock
          </span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => deleteCatalogueItem(r.id)}
          aria-label={`Delete ${r.name}`}
          className="p-1.5 rounded-md text-[#718096] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            Universal Catalogue
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Manage physical goods, services, digital products, and subscriptions with GST/tax rates and stock tracking.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          {showForm ? 'Close Form' : 'Add Product / Service'}
        </Button>
      </div>

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
              New Catalogue Entry
            </h2>
            {formError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{formError}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Item / Service Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Consulting Retainer or Laptop Pro"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">SKU (Auto if blank)</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="e.g. PRD-001"
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => {
                    const nextType = e.target.value as CatalogueItemType;
                    setType(nextType);
                    if (nextType !== 'physical') setTrackStock(false);
                  }}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                >
                  <option value="physical">Physical Product</option>
                  <option value="service">Service</option>
                  <option value="digital">Digital Product</option>
                  <option value="subscription">Subscription</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Unit (Nos, Kg, Hrs)</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Cost Price ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Selling Price ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Tax / GST Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
            </div>

            {type === 'physical' && (
              <div className="pt-2 flex flex-wrap items-center gap-6">
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trackStock}
                    onChange={(e) => setTrackStock(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Track Inventory Stock
                </label>
                {trackStock && (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[#718096] dark:text-slate-400">
                        Opening Qty:
                      </label>
                      <input
                        type="number"
                        value={stockOnHand}
                        onChange={(e) => setStockOnHand(e.target.value)}
                        className="w-24 h-8 px-2.5 rounded-lg text-xs font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[#718096] dark:text-slate-400">
                        Reorder Alert At:
                      </label>
                      <input
                        type="number"
                        value={reorderLevel}
                        onChange={(e) => setReorderLevel(e.target.value)}
                        className="w-24 h-8 px-2.5 rounded-lg text-xs font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save to Catalogue
              </Button>
            </div>
          </form>
        </Surface>
      )}

      <DataTable
        data={data.catalogue}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search SKU, product name, or category..."
        searchPredicate={(r, q) =>
          `${r.sku} ${r.name} ${r.category} ${r.type}`.toLowerCase().includes(q)
        }
        emptyTitle="Your catalogue is empty"
        emptyDescription="Add your products, services, or subscriptions so they can be billed in Sales Invoices and tracked in Inventory."
        emptyActionLabel="Add Product / Service"
        onEmptyAction={() => setShowForm(true)}
      />
    </div>
  );
}
