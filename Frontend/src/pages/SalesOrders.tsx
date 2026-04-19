import SalesOrderIntakeForm from '@/components/sales-orders/SalesOrderIntakeForm'

const SalesOrders = () => {
  return <SalesOrderIntakeForm />
}

export default SalesOrders
/*
import SalesOrderIntakeForm from '@/components/sales-orders/SalesOrderIntakeForm'

import SalesOrderIntakeForm from '@/components/sales-orders/SalesOrderIntakeForm'

const SalesOrders = () => {
  return <SalesOrderIntakeForm />
}

export default SalesOrders
*/
/*
            <Table.Header>
              <Table.Head label="Order #" isRowHeader />
              <Table.Head label="Patient" />
              <Table.Head label="Items" />
              <Table.Head label="Total" />
              <Table.Head label="Prescription" />
              <Table.Head label="Created" />
              <Table.Head label="Actions" />
            </Table.Header>
            <Table.Body>
              {rows.map((order) => (
                <Table.Row key={order.order_id}>
                  <Table.Cell>{order.order_number}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span>{order.patient_name || patientNameMap[order.patient_id] || order.patient_id}</span>
                      <span className="text-xs text-tertiary">{order.patient_id}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{order.items.length}</Table.Cell>
                  <Table.Cell>{formatCurrency(order.total_amount || order.subtotal || 0)}</Table.Cell>
                  <Table.Cell>{order.prescription_id || '-'}</Table.Cell>
                  <Table.Cell>{formatDate(order.created_at)}</Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(order)}
                        disabled={Boolean(order.invoice_id)}
                      >
                        Edit
                      </Button>
                      {!order.invoice_id && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => convertMutation.mutate(order.order_id)}
                          disabled={convertMutation.isPending}
                        >
                          Generate Invoice
                        </Button>
                      )}
                      {order.invoice_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate('/invoices')}
                        >
                          View Invoice
                        </Button>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingOrder(null)
          setForm(defaultForm)
        }}
        title={editingOrder ? 'Edit Sales Order' : 'Create Sales Order'}
        size="xl"
        footer={(
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsModalOpen(false)
                setEditingOrder(null)
                setForm(defaultForm)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={saveMutation.isPending}>
              {editingOrder ? 'Update Sales Order' : 'Create Sales Order'}
            </Button>
          </>
        )}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Patient</label>
              <select
                className="input w-full"
                value={form.patient_id}
                onChange={(event) => setForm((current) => ({ ...current, patient_id: event.target.value }))}
              >
                <option value="">Select patient</option>
                {(patientsData?.data || []).map((patient) => (
                  <option key={patient.patient_id} value={patient.patient_id}>
                    {patient.name} ({patient.patient_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Prescription ID (optional)</label>
              <input
                className="input w-full"
                value={form.prescription_id}
                onChange={(event) => setForm((current) => ({ ...current, prescription_id: event.target.value }))}
                placeholder="PRE000001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Tested By (optional)</label>
              <input
                className="input w-full"
                value={form.tested_by}
                onChange={(event) => setForm((current) => ({ ...current, tested_by: event.target.value }))}
                placeholder="Optometrist / Staff"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Expected Delivery Date (optional)</label>
              <input
                type="date"
                className="input w-full"
                value={form.expected_delivery_date}
                onChange={(event) => setForm((current) => ({ ...current, expected_delivery_date: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-secondary mb-2">Notes</label>
              <input
                className="input w-full"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Any notes for this order"
              />
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-primary mb-3">Optical Measurements</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">PD</label>
                <input
                  className="input w-full"
                  value={form.measurements.pd}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    measurements: { ...current.measurements, pd: event.target.value },
                  }))}
                  placeholder="e.g. 63"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Fitting Height</label>
                <input
                  className="input w-full"
                  value={form.measurements.fitting_height}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    measurements: { ...current.measurements, fitting_height: event.target.value },
                  }))}
                  placeholder="e.g. 18"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Segment Height</label>
                <input
                  className="input w-full"
                  value={form.measurements.segment_height}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    measurements: { ...current.measurements, segment_height: event.target.value },
                  }))}
                  placeholder="e.g. 16"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-primary">Items</h3>
              <Button variant="outline" size="sm" onClick={addItem}>Add Item</Button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end rounded-lg border border-border p-3">
                  <div className="md:col-span-5">
                    <label className="block text-xs text-tertiary mb-1">Product</label>
                    <select
                      className="input w-full"
                      value={item.product_id}
                      onChange={(event) => handleItemChange(index, 'product_id', event.target.value)}
                    >
                      <option value="">Select product</option>
                      {(productsData?.data || []).map((product) => (
                        <option key={product.product_id} value={product.product_id}>
                          {product.name} ({product.product_id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs text-tertiary mb-1">Barcode / SKU</label>
                    <div className="flex gap-2">
                      <input
                        className="input w-full"
                        value={item.barcode}
                        onChange={(event) => handleItemChange(index, 'barcode', event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            applyBarcode(index)
                          }
                        }}
                        placeholder="Scan or type code"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyBarcode(index)}
                        isLoading={barcodeLookupIndex === index}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs text-tertiary mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      className="input w-full"
                      value={item.quantity}
                      onChange={(event) => handleItemChange(index, 'quantity', Number(event.target.value || 0))}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs text-tertiary mb-1">Unit Price</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="input w-full"
                      value={item.unit_price}
                      onChange={(event) => handleItemChange(index, 'unit_price', Number(event.target.value || 0))}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs text-tertiary mb-1">Line Total</label>
                    <div className="h-10 rounded-lg border border-border px-3 flex items-center bg-secondary">{formatCurrency(item.quantity * item.unit_price)}</div>
                  </div>
                  <div className="md:col-span-1">
                    <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <div className="text-right">
                <div className="text-sm text-tertiary">Subtotal</div>
                <div className="text-lg font-bold text-primary">{formatCurrency(formSubtotal)}</div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default SalesOrders
*/
