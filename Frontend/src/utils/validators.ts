export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '')
  return cleaned.length >= 10
}

export const validateRequired = (value: any): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  return value !== null && value !== undefined
}

export const validateMinLength = (value: string, min: number): boolean => {
  return value.length >= min
}

export const validateMaxLength = (value: string, max: number): boolean => {
  return value.length <= max
}

export const validateNumber = (value: any): boolean => {
  return !isNaN(parseFloat(value)) && isFinite(value)
}

export const validatePositiveNumber = (value: number): boolean => {
  return validateNumber(value) && value > 0
}

export const validateDateRange = (startDate: Date, endDate: Date): boolean => {
  return startDate <= endDate
}
