import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

interface ChartData {
  bin: string
  count: number
}

interface BaseChartProps {
  data: ChartData[]
  height?: number | string
  animated?: boolean
  className?: string
}

const chartGradientDefs = (
  <defs>
    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#10b981" />
      <stop offset="100%" stopColor="#065f46" />
    </linearGradient>
    <linearGradient id="miniBarGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#10b981" />
      <stop offset="100%" stopColor="#065f46" />
    </linearGradient>
  </defs>
)

const defaultTooltipStyle = {
  backgroundColor: 'rgba(30, 41, 59, 0.95)',
  border: '1px solid rgba(71, 85, 105, 0.5)',
  borderRadius: '12px',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  color: '#ffffff'
}

const miniTooltipStyle = {
  ...defaultTooltipStyle,
  borderRadius: '8px',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
}

const BaseChart = React.forwardRef<HTMLDivElement, BaseChartProps>(
  ({ data, height = "100%", animated = false, className }, ref) => (
    <div ref={ref} className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis 
            dataKey="bin" 
            tick={{ fontSize: 12, fill: '#cbd5e1' }} 
            angle={-20} 
            textAnchor="end" 
            height={50}
          />
          <YAxis 
            allowDecimals={false} 
            tick={{ fill: '#cbd5e1' }}
          />
          <Tooltip contentStyle={defaultTooltipStyle} />
          <Bar 
            dataKey="count" 
            fill="url(#barGradient)"
            isAnimationActive={animated}
          />
          {chartGradientDefs}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
)
BaseChart.displayName = "BaseChart"

const MiniChart = React.forwardRef<HTMLDivElement, Omit<BaseChartProps, 'height'>>(
  ({ data, animated = false, className }, ref) => (
    <div ref={ref} className={className} style={{ height: '160px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis 
            dataKey="bin" 
            tick={{ fontSize: 10, fill: '#cbd5e1' }} 
            angle={-20} 
            textAnchor="end" 
            height={40} 
          />
          <YAxis allowDecimals={false} tick={{ fill: '#cbd5e1' }} />
          <Tooltip contentStyle={miniTooltipStyle} />
          <Bar 
            dataKey="count" 
            fill="url(#miniBarGradient)"
            isAnimationActive={animated}
          />
          {chartGradientDefs}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
)
MiniChart.displayName = "MiniChart"

export { BaseChart, MiniChart, type ChartData }
