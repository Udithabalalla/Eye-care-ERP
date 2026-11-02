import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { ACTION_LABELS, type PermissionAction, type PermissionModule } from '@/api/roles.api'

const ACTIONS: PermissionAction[] = ['read', 'write', 'delete']

interface PermissionGridProps {
  modules: PermissionModule[]
  checked: Set<string>
  onToggle?: (code: string, next: boolean) => void
  disabled?: boolean
  /** Marks a permission that differs from the role, e.g. on a user's own permissions */
  changeOf?: (code: string) => 'added' | 'removed' | undefined
}

// One row per area of the system, one column per action
export function PermissionGrid({ modules, checked, onToggle, disabled, changeOf }: PermissionGridProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Area</TableHead>
          {ACTIONS.map((action) => (
            <TableHead key={action} className="w-28 text-center">{ACTION_LABELS[action]}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {modules.map((module) => (
          <TableRow key={module.module}>
            <TableCell className="whitespace-normal">
              <span className="block font-medium text-foreground">{module.label}</span>
              <span className="block text-xs text-muted-foreground">{module.description}</span>
            </TableCell>
            {ACTIONS.map((action) => {
              const code = `${module.module}.${action}`
              if (!module.actions.includes(action)) {
                return <TableCell key={action} className="text-center text-muted-foreground/50">—</TableCell>
              }
              const change = changeOf?.(code)
              return (
                <TableCell key={action} className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <Checkbox
                      checked={checked.has(code)}
                      disabled={disabled}
                      onCheckedChange={(value) => onToggle?.(code, value === true)}
                      aria-label={`${ACTION_LABELS[action]} ${module.label.toLowerCase()}`}
                      className={cn(change === 'added' && 'border-primary', change === 'removed' && 'border-destructive')}
                    />
                    {change && (
                      <Badge variant={change === 'added' ? 'secondary' : 'destructive'} className="h-4 px-1.5 text-[10px]">
                        {change === 'added' ? 'Added' : 'Removed'}
                      </Badge>
                    )}
                  </div>
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default PermissionGrid
