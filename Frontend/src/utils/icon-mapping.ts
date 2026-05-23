/**
 * Untitled UI Icon Mapping Utility
 * 
 * This file provides mappings from lucide-react icons to @untitledui/icons
 * Use this as a reference when migrating components.
 * 
 * Usage:
 * Instead of: import { Search } from 'lucide-react'
 * Use:        import { SearchLg } from '@untitledui/icons'
 * 
 * Icon naming convention in Untitled UI:
 * - Icons are PascalCase with size suffix: Sm, Md, Lg
 * - Use the icon browser: https://untitledui.com/icons
 */

// Common Lucide -> Untitled UI mappings
export const ICON_MAPPING = {
  // Navigation & Actions
  'Search': 'SearchLg',
  'Plus': 'Plus',
  'X': 'XClose',
  'Edit': 'Edit01',
  'Edit2': 'Edit02',
  'Trash': 'Trash01',
  'Trash2': 'Trash02',
  'ChevronLeft': 'ChevronLeft',
  'ChevronRight': 'ChevronRight',
  'ChevronDown': 'ChevronDown',
  'ChevronUp': 'ChevronUp',
  'ArrowLeft': 'ArrowLeft',
  'ArrowRight': 'ArrowRight',
  'Menu': 'Menu01',
  'MoreVertical': 'DotsVertical',
  'MoreHorizontal': 'DotsHorizontal',
  
  // Status & Alerts
  'AlertTriangle': 'AlertTriangle',
  'AlertCircle': 'AlertCircle',
  'CheckCircle': 'CheckCircle',
  'XCircle': 'XCircle',
  'Info': 'InfoCircle',
  'Bell': 'Bell01',
  'Check': 'Check',
  
  // Content & Media
  'Eye': 'Eye',
  'EyeOff': 'EyeOff',
  'FileText': 'File06',
  'File': 'File01',
  'Image': 'Image01',
  'Download': 'Download01',
  'Upload': 'Upload01',
  'Camera': 'Camera01',
  'QrCode': 'QrCode01',
  
  // User & Communication  
  'User': 'User01',
  'Users': 'Users01',
  'Mail': 'Mail01',
  'Phone': 'Phone01',
  'MessageCircle': 'MessageCircle01',
  
  // Business & Commerce
  'DollarSign': 'CurrencyDollar',
  'CreditCard': 'CreditCard01',
  'ShoppingCart': 'ShoppingCart01',
  'Package': 'Package',
  'Briefcase': 'Briefcase01',
  
  // Time & Date
  'Calendar': 'Calendar',
  'Clock': 'Clock',
  
  // Charts & Data
  'BarChart': 'BarChart01',
  'BarChart2': 'BarChart04',
  'BarChart3': 'BarChart07',
  'LineChart': 'LineChartUp01',
  'PieChart': 'PieChart01',
  'TrendingUp': 'TrendUp01',
  'TrendingDown': 'TrendDown01',
  'Activity': 'Activity',
  
  // Layout & Interface
  'Layout': 'LayoutAlt01',
  'Grid': 'Grid01',
  'List': 'List',
  'Home': 'Home01',
  'Settings': 'Settings01',
  'Filter': 'FilterLines',
  
  // Forms
  'Loader2': 'Loading01',
  'RefreshCw': 'RefreshCcw01',
  
  // Medical/Healthcare specific
  'Stethoscope': 'Stethoscope',
  'Heart': 'Heart',
  'Pill': 'Pill01',
  
  // Misc
  'Sun': 'Sun',
  'Moon': 'Moon01',
  'Star': 'Star01',
  'Lock': 'Lock01',
  'Unlock': 'LockUnlocked01',
  'LogOut': 'LogOut01',
  'LogIn': 'LogIn01',
  'Save': 'Save01',
  'Copy': 'Copy01',
  'Printer': 'Printer',
} as const

// Type for the mapping
export type LucideIcon = keyof typeof ICON_MAPPING
export type UntitledIcon = typeof ICON_MAPPING[LucideIcon]
