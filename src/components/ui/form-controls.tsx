import * as React from "react"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface ControlGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  labelWidth?: string
  gap?: string
}

const ControlGroup = React.forwardRef<HTMLDivElement, ControlGroupProps>(
  ({ className, label, labelWidth = "w-40", gap = "gap-3", children, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center", gap, className)} {...props}>
      <Label className={cn("whitespace-nowrap text-white", labelWidth)}>{label}</Label>
      {children}
    </div>
  )
)
ControlGroup.displayName = "ControlGroup"

interface SliderControlProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  onCommit?: (value: number) => void
  className?: string
  labelWidth?: string
  disabled?: boolean
}

const SliderControl = React.forwardRef<HTMLDivElement, SliderControlProps>(
  ({ label, value, min, max, step = 1, onChange, onCommit, className, labelWidth = "w-40", disabled = false }, ref) => {
    const [temp, setTemp] = React.useState(value)
    
    React.useEffect(() => setTemp(value), [value])

    return (
      <ControlGroup ref={ref} label={label} labelWidth={labelWidth} className={className}>
        <Slider
          value={[temp]}
          min={min}
          max={max}
          step={step}
          onValueChange={v => {
            setTemp(v[0])
            onChange(v[0])
          }}
          onValueCommit={onCommit ? v => onCommit(v[0]) : undefined}
          disabled={disabled}
          className="w-full"
        />
        <span className="tabular-nums w-12 text-right text-white">{temp}</span>
      </ControlGroup>
    )
  }
)
SliderControl.displayName = "SliderControl"

interface NumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  className?: string
  labelWidth?: string
}

const NumberInput = React.forwardRef<HTMLDivElement, NumberInputProps>(
  ({ label, value, onChange, className, labelWidth = "w-10" }, ref) => {
    const [text, setText] = React.useState(String(value))
    
    React.useEffect(() => setText(String(value)), [value])

    return (
      <ControlGroup ref={ref} label={label} labelWidth={labelWidth} gap="gap-2" className={className}>
        <Input
          value={text}
          onChange={(e) => {
            const t = e.target.value
            setText(t)
            const v = Number(t)
            if (!Number.isNaN(v)) onChange(v)
          }}
          className="bg-white/10 border-white/20 text-white"
        />
      </ControlGroup>
    )
  }
)
NumberInput.displayName = "NumberInput"

interface SwitchControlProps {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}

const SwitchControl = React.forwardRef<HTMLDivElement, SwitchControlProps>(
  ({ label, checked, onCheckedChange, className }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2", className)}>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <Label className="text-white">{label}</Label>
    </div>
  )
)
SwitchControl.displayName = "SwitchControl"

export { ControlGroup, SliderControl, NumberInput, SwitchControl }
