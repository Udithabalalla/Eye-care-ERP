import { RiBarChartLine, RiBarChart2Line, RiDownloadLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const Reports = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Generate and export reports</p>
        </div>
        <Button>
          <RiDownloadLine className="w-5 h-5 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <RiBarChartLine className="w-8 h-8 text-brand-600 mb-3" />
            <h3 className="font-semibold text-foreground mb-2">Sales Report</h3>
            <p className="text-sm text-muted-foreground mb-4">View sales performance and revenue</p>
            <Button variant="outline" className="w-full">Generate</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <RiBarChartLine className="w-8 h-8 text-success-600 mb-3" />
            <h3 className="font-semibold text-foreground mb-2">Inventory Report</h3>
            <p className="text-sm text-muted-foreground mb-4">Check stock levels and products</p>
            <Button variant="outline" className="w-full">Generate</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <RiBarChart2Line className="w-8 h-8 text-brand-600 mb-3" />
            <h3 className="font-semibold text-foreground mb-2">Patient Report</h3>
            <p className="text-sm text-muted-foreground mb-4">View patient statistics</p>
            <Button variant="outline" className="w-full">Generate</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Reports
