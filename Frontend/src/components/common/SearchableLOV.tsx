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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                    {required && <span className="text-red-600 ml-1">*</span>}
                </label>
            )}

            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
          w-full px-4 py-2 text-left bg-white border rounded-lg
          flex items-center justify-between
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-primary-500 cursor-pointer'}
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${isOpen ? 'ring-2 ring-primary-500 border-primary-500' : ''}
        `}
            >
                <div className="flex-1 truncate">
                    {selectedOption ? (
                        <div>
                            <div className="text-gray-900">{selectedOption.label}</div>
                            {selectedOption.subtitle && (
                                <div className="text-sm text-gray-500">{selectedOption.subtitle}</div>
                            )}
                        </div>
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    {value && !disabled && (
                        <X
                            className="w-4 h-4 text-gray-400 hover:text-gray-600"
                            onClick={handleClear}
                        />
                    )}
                    <ChevronDown
                        className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''
                            }`}
                    />
                </div>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                    w-full px-4 py-3 text-left hover:bg-primary-50 transition-colors
                    ${value === option.value ? 'bg-primary-100' : ''}
                  `}
                                >
                                    <div className="font-medium text-gray-900">{option.label}</div>
                                    {option.subtitle && (
                                        <div className="text-sm text-gray-500">{option.subtitle}</div>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-gray-500">
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
