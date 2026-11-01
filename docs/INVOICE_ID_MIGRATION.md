# Invoice ID migration

## What changed

`invoice_id` (for example `INV000042`) used to be built from the yearly `invoice_number`
(`INV-2026-000042`). The yearly number restarts at `000001` every January, so
`INV-2025-000001` and `INV-2026-000001` both got `invoice_id` `INV000001`. Anything that
looks an invoice up or updates it by `invoice_id` then hit whichever of the two MongoDB
returned first. That includes payments, the sales order advance and invoice pages.

`invoice_id` now comes from a global counter, `counters` document `_id: "invoice_id_sequence"`.
`invoice_number` keeps its `INV-YYYY-NNNNNN` format and still restarts each year.

## What happens to an existing database

- **Counter:** nothing to do. If the counter is missing or behind the stored ids, the next
  invoice moves it past the highest stored `INV…` id before taking a number.
  `scripts/seed_data.py` also leaves the counter past the ids it inserts.
- **Unique index:** at startup the backend makes `invoices.invoice_id` unique, replacing the
  old plain index, but only if no id repeats. If an id repeats, it keeps the plain
  index and logs:

  ```
  [WARN] Repeated invoice_id values (INV000001, ...); invoice_id index left non-unique. See docs/INVOICE_ID_MIGRATION.md
  ```

  This happens in any database that issued invoices in more than one calendar year
  under the old scheme. New invoices are still safe because they never reuse an id. The
  repeated ids stay ambiguous until you fix them by hand, as described below.

## Fixing repeated ids

Back up the database first. Then, in `mongosh`:

1. List the repeats:

   ```js
   db.invoices.aggregate([
     { $group: { _id: "$invoice_id", docs: { $push: { _id: "$_id", number: "$invoice_number", created_at: "$created_at", sales_order_id: "$sales_order_id" } }, n: { $sum: 1 } } },
     { $match: { n: { $gt: 1 } } }
   ])
   ```

2. For each repeated id, the earliest invoice by `created_at` keeps the id. Give each later
   one a new id:

   ```js
   // Run once to move the counter past every stored id
   const max = db.invoices.aggregate([
     { $match: { invoice_id: /^INV\d+$/ } },
     { $project: { n: { $toInt: { $substr: ["$invoice_id", 3, -1] } } } },
     { $sort: { n: -1 } }, { $limit: 1 }
   ]).toArray()[0].n;
   db.counters.updateOne({ _id: "invoice_id_sequence" }, { $max: { value: max } }, { upsert: true });

   // Per invoice that has to move (match it by _id, never by invoice_id)
   const seq = db.counters.findOneAndUpdate({ _id: "invoice_id_sequence" }, { $inc: { value: 1 } }, { returnDocument: "after" }).value;
   const newId = "INV" + String(seq).padStart(6, "0");
   db.invoices.updateOne({ _id: ObjectId("<moved invoice _id>") }, { $set: { invoice_id: newId } });
   ```

3. Repoint what belongs to the moved invoice:
   - `sales_orders.invoice_id`: update the order named by the moved invoice's
     `sales_order_id`. That link is unambiguous.
   - `payments`, `transactions` and `inventory_movements` with `reference_type: "INVOICE"` and
     `reference_id` set to the old id. These are ambiguous, so decide per record by date, amount and
     patient which invoice it belongs to, and update only those that belong to the moved one.
   - `audit_logs`: leave them. They record what happened at the time.

4. Check the invoices' `paid_amount` / `balance_due`. An update meant for one invoice may have
   landed on the other. Recompute from that invoice's payments where needed.

5. Restart the backend. The warning should be gone and `invoices.invoice_id` should be
   unique (`db.invoices.getIndexes()`).
