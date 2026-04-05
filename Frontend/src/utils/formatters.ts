import { format, parseISO } from 'date-fns'

export const formatDate = (date: string | Date, formatStr: string = 'MMM dd, yyyy'): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date
    return format(dateObj, formatStr)
  } catch (error) {
    return 'Invalid date'
  }
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'LKR',
  }).format(amount)
}

export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '')
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`
  }
  return phone
}

export const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`
}

export const truncate = (str: string, length: number = 50): string => {
  if (str.length <= length) return str
  return str.substring(0, length) + '...'
}

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

export const safeDate = (date: string | undefined | null, fallback: string = new Date().toISOString().split('T')[0]): string => {
  if (!date) return fallback
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return fallback
    return d.toISOString().split('T')[0]
  } catch (error) {
    return fallback
  }
}
