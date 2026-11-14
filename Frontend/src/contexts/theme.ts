import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark'
// 'system' follows the operating system's light/dark setting and updates when it changes
export type ThemePreference = Theme | 'system'

interface ThemeContextType {
    /** The theme actually on screen */
    theme: Theme
    /** What the user picked */
    preference: ThemePreference
    setPreference: (preference: ThemePreference) => void
    toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
