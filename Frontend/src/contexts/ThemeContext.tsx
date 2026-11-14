import React, { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { ThemeContext, type Theme, type ThemePreference } from './theme'

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

const applyTheme = (theme: Theme) => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
}

const readPreference = (): ThemePreference => {
    try {
        const saved = localStorage.getItem('theme')
        if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
    } catch { /* storage blocked: fall through */ }
    return 'system'
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [preference, setPreference] = useState<ThemePreference>(readPreference)
    const [systemDark, setSystemDark] = useState(() => darkQuery().matches)

    useEffect(() => {
        const query = darkQuery()
        const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
        query.addEventListener('change', onChange)
        return () => query.removeEventListener('change', onChange)
    }, [])

    const theme: Theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

    useEffect(() => {
        applyTheme(theme)
        try {
            localStorage.setItem('theme', preference)
        } catch { /* ignore */ }
    }, [theme, preference])

    // A picked theme cross-fades in where the browser supports View Transitions
    // (a plain fade, so it stays on with the OS "reduce motion" setting too)
    const choosePreference = (next: ThemePreference) => {
        const nextTheme: Theme = next === 'system' ? (systemDark ? 'dark' : 'light') : next
        const doc = document as Document & { startViewTransition?: (update: () => void) => unknown }
        if (nextTheme === theme || !doc.startViewTransition) {
            setPreference(next)
            return
        }
        doc.startViewTransition(() => {
            applyTheme(nextTheme)
            flushSync(() => setPreference(next))
        })
    }

    const toggleTheme = () => {
        choosePreference(theme === 'light' ? 'dark' : 'light')
    }

    return (
        <ThemeContext.Provider value={{ theme, preference, setPreference: choosePreference, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
