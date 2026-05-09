import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts'

interface Props {
  data: Array<{ name: string; count: number }>
  title?: string
  dataKey?: string
  barColor?: string
  heightClassName?: string
  formatter?: (value: number) => string
}

const OrderTypeBarChart: React.FC<Props> = ({
  data,
  title = 'Visits & Orders',
  dataKey = 'count',
  barColor = '#0f766e',
  heightClassName = 'min-h-[22rem]',
  formatter,
}) => {
  const tooltipFormatter = formatter
    ? ((value: number) => [value, ''] as [number, string])
    : undefined

  return (
    <Card className={heightClassName}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[18rem] pb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <XAxis dataKey="name" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" tickFormatter={formatter} />
            <Tooltip formatter={tooltipFormatter as any} />
            <Legend />
            <Bar dataKey={dataKey} fill={barColor} radius={[8, 8, 0, 0]}>
              <LabelList dataKey={dataKey} position="top" formatter={formatter as any} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export default OrderTypeBarChart
