import { Search } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { useEffect, useState } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
  debounceMs?: number
}

const SearchBar = ({
  onSearch,
  placeholder = 'Search...',
  debounceMs = 500,
}: SearchBarProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, debounceMs)

  useEffect(() => {
    onSearch(debouncedSearch)
  }, [debouncedSearch, onSearch])

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={placeholder}
        className="input pl-10"
      />
    </div>
  )
}

export default SearchBar
