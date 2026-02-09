import { useState, useRef, useEffect } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'

export interface LOVOption {
    value: string
    label: string
    subtitle?: string
}

interface SearchableLOVProps {
    options: LOVOption[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    label?: string
    error?: string
    disabled?: boolean
    required?: boolean
}

const SearchableLOV = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    label,
    error,
    disabled = false,
    required = false,
}: SearchableLOVProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
                setSearchTerm('')
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Filter options based on search term
    const filteredOptions = options.filter((option) => {
        const searchLower = searchTerm.toLowerCase()
        return (
            option.label.toLowerCase().includes(searchLower) ||
            option.value.toLowerCase().includes(searchLower) ||
            option.subtitle?.toLowerCase().includes(searchLower)
        )
    })

    // Get selected option
    const selectedOption = options.find((opt) => opt.value === value)

    const handleSelect = (optionValue: string) => {
        onChange(optionValue)
        setIsOpen(false)
        setSearchTerm('')
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange('')
        setSearchTerm('')
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {label && (
                <label className="label">
                    {label}
                    {required && <span className="text-red-600 ml-1">*</span>}
                </label>
            )}

            {/* Trigger Button */}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
          w-full px-4 py-2.5 text-left bg-white dark:bg-gray-800 border rounded-lg
          flex items-center justify-between transition-all
          ${disabled ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed opacity-60' : 'hover:border-border-hover cursor-pointer'}
          ${error ? 'border-red-500' : 'border-border'}
          ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-500' : ''}
        `}
            >
                <div className="flex-1 truncate">
                    {selectedOption ? (
                        <div>
                            <div className="text-text-primary font-medium">{selectedOption.label}</div>
                            {selectedOption.subtitle && (
                                <div className="text-sm text-text-tertiary">{selectedOption.subtitle}</div>
                            )}
                        </div>
                    ) : (
                        <span className="text-text-tertiary">{placeholder}</span>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    {value && !disabled && (
                        <X
                            className="w-4 h-4 text-text-tertiary hover:text-text-secondary"
                            onClick={handleClear}
                        />
                    )}
                    <ChevronDown
                        className={`w-5 h-5 text-text-tertiary transition-transform ${isOpen ? 'transform rotate-180' : ''
                            }`}
                    />
                </div>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-border rounded-xl shadow-lg max-h-80 overflow-hidden">
                    {/* Search Input */}
                    <div className="p-3 border-b border-border sticky top-0 bg-white dark:bg-gray-800">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-10 pr-4 py-2 border border-border bg-gray-50 dark:bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-text-primary placeholder-text-tertiary"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto max-h-64">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={`
                    w-full px-4 py-3 text-left hover:bg-bg-tertiary transition-colors
                    ${value === option.value ? 'bg-blue-500/10 border-l-2 border-blue-500' : ''}
                  `}
                                >
                                    <div className="font-medium text-text-primary">{option.label}</div>
                                    {option.subtitle && (
                                        <div className="text-sm text-text-tertiary">{option.subtitle}</div>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-text-tertiary">
                                No results found
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </div>
    )
}

export default SearchableLOV
