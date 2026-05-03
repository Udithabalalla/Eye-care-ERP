import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Props {
  data: Array<{ name: string; count: number }>
}

const OrderTypeBarChart: React.FC<Props> = ({ data }) => {
  return (
    <Card className="h-64">
      <CardHeader>
        <CardTitle>Visits & Orders</CardTitle>
      </CardHeader>
      <CardContent className="h-[18rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <XAxis dataKey="name" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#0f766e" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export default OrderTypeBarChart
