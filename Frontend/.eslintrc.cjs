module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-explicit-any': 'off',
    // UI rules from CLAUDE.md: shadcn components and RemixIcon only
    'no-restricted-imports': ['error', {
      paths: [
        { name: '@/components/ui', message: 'Import the shadcn component from its own file, e.g. @/components/ui/button.' },
        { name: 'lucide-react', message: 'Use @remixicon/react.' },
        { name: '@untitledui/icons', message: 'Use @remixicon/react.' },
        { name: '@radix-ui/react-icons', message: 'Use @remixicon/react.' },
        { name: 'react-aria-components', message: 'Use the shadcn/Radix component instead.' },
        { name: 'react-aria', message: 'Use the shadcn/Radix component instead.' },
        { name: 'react-hot-toast', message: "Use toast from 'sonner' (Toaster is mounted in main.tsx)." },
      ],
      patterns: [
        { group: ['@/components/ui/base/*', '@/components/ui/application/*'], message: 'The Untitled UI wrappers were removed; use the shadcn component.' },
        { group: ['@/components/common/Button', '@/components/common/Input', '@/components/common/Modal'], message: 'Removed wrappers: use @/components/ui/button, input or dialog.' },
      ],
    }],
    // Confirm with useConfirm() from @/hooks/useConfirm (a shadcn AlertDialog)
    'no-restricted-globals': ['error', { name: 'confirm', message: 'Use useConfirm() from @/hooks/useConfirm.' }],
  },
}
