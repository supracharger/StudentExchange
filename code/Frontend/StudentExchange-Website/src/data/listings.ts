export const categories = [
  'All items',
  'Textbooks',
  'Electronics',
  'School supplies',
  'Campus living',
] as const
export type Category = (typeof categories)[number]

export interface Listing {
  id: number
  title: string
  category: Exclude<Category, 'All items'>
  price: number
  condition: string
  school: string
  cover: string
  label: string
}

// Illustrative data for the starter UI; these are not real sale offers.
export const listings: Listing[] = [
  {
    id: 1,
    title: 'Calculus: Early Transcendentals',
    category: 'Textbooks',
    price: 45,
    condition: 'Good',
    school: 'CU Denver',
    cover: 'calculus',
    label: 'CALCULUS',
  },
  {
    id: 2,
    title: 'Notebook & stationery bundle',
    category: 'School supplies',
    price: 10,
    condition: 'Like new',
    school: 'MSU Denver',
    cover: 'notebooks',
    label: 'MAKE NOTES',
  },
  {
    id: 3,
    title: 'Scientific calculator',
    category: 'Electronics',
    price: 25,
    condition: 'Good',
    school: 'CU Denver',
    cover: 'calculator',
    label: '123.45',
  },
  {
    id: 4,
    title: 'Biology: Exploring Life',
    category: 'Textbooks',
    price: 35,
    condition: 'Like new',
    school: 'MSU Denver',
    cover: 'biology',
    label: 'BIOLOGY',
  },
  {
    id: 5,
    title: 'Adjustable desk lamp',
    category: 'Campus living',
    price: 15,
    condition: 'Good',
    school: 'CU Denver',
    cover: 'lamp',
    label: 'BRIGHT IDEAS',
  },
  {
    id: 6,
    title: 'Introduction to Psychology',
    category: 'Textbooks',
    price: 30,
    condition: 'Good',
    school: 'MSU Denver',
    cover: 'psychology',
    label: 'PSYCHOLOGY',
  },
]
