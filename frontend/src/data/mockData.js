export const mockUser = {
  id: 'user-1',
  name: 'Maya Rahman',
  email: 'maya@example.com'
}

export const mockNotes = [
  {
    id: 'note-1',
    originalText: 'Tomorrow class at 10, buy eggs afterwards, and spent ৳250 on books.',
    createdAt: '2026-09-20T09:15:00+06:00',
    processingStatus: 'Processed',
    confidence: 94,
    domains: ['Education', 'Shopping', 'Finance'],
    itemIds: ['item-1', 'item-2', 'item-3']
  },
  {
    id: 'note-2',
    originalText: 'I have an EM quiz on September 23.',
    createdAt: '2026-09-19T16:30:00+06:00',
    processingStatus: 'Processed',
    confidence: 97,
    domains: ['Education'],
    itemIds: ['item-4']
  },
  {
    id: 'note-3',
    originalText: 'Register for the gaming show before Friday.',
    createdAt: '2026-09-18T12:00:00+06:00',
    processingStatus: 'Processed',
    confidence: 91,
    domains: ['Entertainment'],
    itemIds: ['item-5']
  }
]

export const mockNoteItems = [
  { id: 'item-1', noteId: 'note-1', type: 'EVENT', title: 'Class tomorrow at 10 AM', domain: 'Education', deadline: 'Tomorrow, 10:00 AM' },
  { id: 'item-2', noteId: 'note-1', type: 'TASK', title: 'Buy eggs', domain: 'Shopping', place: 'Agora', status: 'PENDING', importance: 'Medium' },
  { id: 'item-3', noteId: 'note-1', type: 'EXPENSE', title: 'Books', domain: 'Finance', amount: 250, quantity: null },
  { id: 'item-4', noteId: 'note-2', type: 'EVENT', title: 'EM Quiz', domain: 'Education', deadline: 'September 23' },
  { id: 'item-5', noteId: 'note-3', type: 'TASK', title: 'Register for gaming show', domain: 'Entertainment', deadline: 'Friday', status: 'PENDING', importance: 'High' }
]

export const mockTasks = [
  { id: 'task-1', title: 'Buy eggs', deadline: 'Today', status: 'PENDING', importance: 'Medium', domains: ['Shopping'], place: 'Agora' },
  { id: 'task-2', title: 'Submit database assignment', deadline: 'Tomorrow', status: 'PENDING', importance: 'High', domains: ['Education'], place: null },
  { id: 'task-3', title: 'Register for gaming show', deadline: 'Friday', status: 'PENDING', importance: 'High', domains: ['Entertainment'], place: null }
]

export const mockEvents = [
  { id: 'event-1', title: 'EM Quiz-1', date: 'September 23', domain: 'Education', time: '10:00 AM' },
  { id: 'event-2', title: 'Gaming Show', date: 'September 25', domain: 'Entertainment', time: '6:30 PM' }
]

export const mockExpenses = [
  { id: 'expense-1', title: 'Chilli', quantity: '300g', amount: 50, date: 'Sep 20', domain: 'Shopping' },
  { id: 'expense-2', title: 'Books', quantity: null, amount: 250, date: 'Sep 20', domain: 'Education' },
  { id: 'expense-3', title: 'Bus fare', quantity: null, amount: 120, date: 'Sep 18', domain: 'Transport' }
]

export const mockPlaces = [
  { id: 'place-1', name: 'Agora', address: 'Dhanmondi 27, Dhaka', radius: 250 },
  { id: 'place-2', name: 'University', address: 'Bashundhara Campus', radius: 500 },
  { id: 'place-3', name: 'Home', address: 'Mohammadpur, Dhaka', radius: 150 },
  { id: 'place-4', name: 'Rahman Grocery', address: 'Lalmatia, Dhaka', radius: 200 }
]

export const mockShoppingGroups = [
  { id: 'shopping-1', placeName: 'Agora', items: ['Eggs', 'Bread', 'Shampoo'] },
  { id: 'shopping-2', placeName: 'Rahman Grocery', items: ['Rice', 'Oil'] },
  { id: 'shopping-3', placeName: 'No Location', items: ['Notebook', 'Pen'] }
]

export const mockDashboardItems = [
  { id: 'matter-1', title: 'Gaming show registration', reason: 'Due in 45 minutes', type: 'TASK', domain: 'Entertainment', priority: 'High' },
  { id: 'matter-2', title: 'EM Quiz', reason: 'September 23', type: 'EVENT', domain: 'Education', priority: 'Medium' },
  { id: 'matter-3', title: 'Buy eggs', reason: 'At Agora', type: 'TASK', domain: 'Shopping', priority: 'Low' }
]

export const mockSearchResults = [
  { id: 'result-1', title: 'EM Quiz', excerpt: 'I have an EM quiz on September 23.', domain: 'Education', noteId: 'note-2' },
  { id: 'result-2', title: 'Database Assignment', excerpt: 'Submit the database assignment this week.', domain: 'Education', noteId: 'note-1' }
]

export const mockAskResponse = {
  answer: 'You have an EM Quiz on September 23 and a database assignment due this week.',
  sources: ['EM Quiz note', 'Database Assignment note']
}
