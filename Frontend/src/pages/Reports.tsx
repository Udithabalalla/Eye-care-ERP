import { BarChart07, BarChart02, Download01 } from '@untitledui/icons'

const Reports = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-[40px] font-semibold leading-[1.1] tracking-[-0.28px] text-primary">Reports & Analytics</h1>
          <p className="mt-1 text-[17px] text-secondary">Generate and export reports</p>
        </div>
        <button className="btn-primary">
          <Download01 className="w-5 h-5 mr-2" />
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="card bg-bg-primary ring-1 ring-border">
          <BarChart07 className="mb-3 h-8 w-8 text-brand-600" />
          <h3 className="mb-2 font-display text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-primary">Sales Report</h3>
          <p className="mb-4 text-sm text-secondary">View sales performance and revenue</p>
          <button className="btn-secondary w-full">Generate</button>
        </div>

        <div className="card bg-bg-primary ring-1 ring-border">
          <BarChart07 className="mb-3 h-8 w-8 text-success-600" />
          <h3 className="mb-2 font-display text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-primary">Inventory Report</h3>
          <p className="mb-4 text-sm text-secondary">Check stock levels and products</p>
          <button className="btn-secondary w-full">Generate</button>
        </div>

        <div className="card bg-bg-primary ring-1 ring-border">
          <BarChart02 className="mb-3 h-8 w-8 text-brand-600" />
          <h3 className="mb-2 font-display text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-primary">Patient Report</h3>
          <p className="mb-4 text-sm text-secondary">View patient statistics</p>
          <button className="btn-secondary w-full">Generate</button>
        </div>
      </div>
    </div>
  )
}

export default Reports
