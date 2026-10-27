import {
  RiBuilding4Line,
  RiEyeLine,
  RiGiftLine,
  RiHistoryLine,
  RiPriceTag3Line,
  RiShieldCheckLine,
  RiTeamLine,
  RiToolsLine,
} from '@remixicon/react'

export interface SettingsItem {
  name: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

export interface SettingsGroup {
  id: string
  title: string
  description: string
  items: SettingsItem[]
}

export const SETTINGS_HOME = '/settings'

// One place for every set-up screen: the hub page, the settings side menu and the
// app sidebar all read from this list, so names and descriptions never drift apart.
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'master-data',
    title: 'Master data',
    description: 'The lists and rules that sales orders and inventory pick from.',
    items: [
      {
        name: 'Lenses',
        path: '/basic-data/lenses',
        icon: RiEyeLine,
        description: 'Lens types, colours, sizes and their selling prices.',
      },
      {
        name: 'Product Categories',
        path: '/basic-data/product-categories',
        icon: RiPriceTag3Line,
        description: 'Groups that organise the products in your inventory.',
      },
      {
        name: 'Charge Types',
        path: '/basic-data/other-expenses',
        icon: RiToolsLine,
        description: 'Extra services added to an order, like soldering, with a default cost.',
      },
      {
        name: 'Free Item Rules',
        path: '/basic-data/complimentary-items',
        icon: RiGiftLine,
        description: 'Items given free with an order, based on the frame price.',
      },
    ],
  },
  {
    id: 'administration',
    title: 'Administration',
    description: 'Your business details, the people who use the system and what they can do.',
    items: [
      {
        name: 'Company Profile',
        path: '/settings/company',
        icon: RiBuilding4Line,
        description: 'Business name, address, logo and purchase order defaults.',
      },
      {
        name: 'Users',
        path: '/users',
        icon: RiTeamLine,
        description: 'Staff accounts, their roles and who can sign in.',
      },
      {
        name: 'Roles & Permissions',
        path: '/roles-permissions',
        icon: RiShieldCheckLine,
        description: 'What each role is allowed to see and do.',
      },
      {
        name: 'Activity Logs',
        path: '/activity-logs',
        icon: RiHistoryLine,
        description: 'A record of who changed what, and when.',
      },
    ],
  },
]

export const isSettingsPath = (pathname: string) =>
  pathname === SETTINGS_HOME ||
  pathname.startsWith(`${SETTINGS_HOME}/`) ||
  SETTINGS_GROUPS.some((group) => group.items.some((item) => pathname === item.path || pathname.startsWith(`${item.path}/`)))
