import api from './axios'

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:          (data) => api.post('/auth/login', data),
  logout:         ()     => api.post('/auth/logout'),
  refresh:        ()     => api.post('/auth/refresh'),
  me:             ()     => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  get:        ()     => api.get('/dashboard'),
  getAdmin:   ()     => api.get('/dashboard/admin'),
  getTeacher: ()     => api.get('/dashboard/teacher'),
  getStudent: ()     => api.get('/dashboard/student'),
  getParent:  ()     => api.get('/dashboard/parent'),
}

// ─── Generic CRUD factory ─────────────────────────────────────────────────────
const crud = (base) => ({
  getAll:  (params) => api.get(base,           { params }),
  getById: (id)     => api.get(`${base}/${id}`),
  create:  (data)   => api.post(base,           data),
  update:  (id, d)  => api.put(`${base}/${id}`, d),
  remove:  (id)     => api.delete(`${base}/${id}`),
})

// ─── People ───────────────────────────────────────────────────────────────────
export const studentsAPI = {
  ...crud('/students'),
  bulkImport: (data) => api.post('/students/bulk-import', data),
}
export const parentsAPI    = crud('/parents')
export const teachersAPI   = crud('/teachers')
export const staffAPI      = crud('/staff')

// ─── Admissions ───────────────────────────────────────────────────────────────
export const admissionsAPI = {
  getSchools: ()        => api.get('/admissions/schools'),
  apply:      (data)    => api.post('/admissions/apply', data),
  getAll:     (params)  => api.get('/admissions', { params }),
  getOne:     (id)      => api.get(`/admissions/${id}`),
  approve:    (id)      => api.put(`/admissions/${id}/approve`),
  reject:     (id, reason) => api.put(`/admissions/${id}/reject`, { reason }),
}
export const leavesAPI = crud('/leaves')

// ─── Academic ─────────────────────────────────────────────────────────────────
export const sessionsAPI       = crud('/sessions')
export const classesAPI        = crud('/classes')
export const sectionsAPI       = crud('/sections')
export const shiftsAPI         = crud('/shifts')
export const classSetupsAPI    = crud('/class-setups')
export const subjectsAPI       = crud('/subjects')
export const subjectAssignsAPI = crud('/subject-assigns')
export const classRoutinesAPI  = crud('/class-routines')
export const lessonPlansAPI    = crud('/lesson-plans')
export const studyMaterialsAPI = crud('/study-materials')

// ─── Attendance ───────────────────────────────────────────────────────────────
export const attendanceAPI = {
  mark:            (data)           => api.post('/attendance/mark', data),
  getByClass:      (params)         => api.get('/attendance/class', { params }),
  studentReport:   (id, params)     => api.get(`/attendance/student/${id}/report`, { params }),
  classReport:     (id, params)     => api.get(`/attendance/class/${id}/report`, { params }),
}

// ─── Exams ────────────────────────────────────────────────────────────────────
export const examTypesAPI  = crud('/exam-types')
export const markGradesAPI = crud('/mark-grades')
export const examAssignsAPI = crud('/exam-assigns')
export const examRoutinesAPI = crud('/exam-routines')
export const markRegistersAPI = crud('/mark-registers')
export const admitCardsAPI = crud('/admit-cards')
export const marksheetsAPI = crud('/marksheets')

export const examsAPI = {
  ...crud('/exams'),
  updateStatus:      (id, status)   => api.patch(`/exams/${id}/status`, { status }),
  generateAdmitCards:(id)           => api.post(`/exams/${id}/admit-cards/generate`),
  approveAdmitCard:  (id, cardId)   => api.patch(`/exams/${id}/admit-cards/${cardId}/approve`),
  enterMarks:        (assignId, d)  => api.post(`/exams/assigns/${assignId}/marks`, d),
  generateMarksheets:(id)           => api.post(`/exams/${id}/marksheets/generate`),
  approveMarksheet:  (id)           => api.patch(`/exams/${id}/marksheets/approve`),
  publishMarksheets: (id)           => api.patch(`/exams/${id}/marksheets/publish`),
}

// ─────────────────────────────────────────────────────────────
// Fees
// ─────────────────────────────────────────────────────────────

export const feesAPI = {
  // Groups
  getGroups: (params) => api.get('/fees/groups', { params }),
  createGroup: (data) => api.post('/fees/groups', data),
  updateGroup: (id, data) => api.put(`/fees/groups/${id}`, data),
  deleteGroup: (id) => api.delete(`/fees/groups/${id}`),

  // Types
  getTypes: (params) => api.get('/fees/types', { params }),
  createType: (data) => api.post('/fees/types', data),
  updateType: (id, data) => api.put(`/fees/types/${id}`, data),
  deleteType: (id) => api.delete(`/fees/types/${id}`),

  // Masters
  getMasters: (params) => api.get('/fees/masters', { params }),
  createMaster: (data) => api.post('/fees/masters', data),
  updateMaster: (id, data) => api.put(`/fees/masters/${id}`, data),
  deleteMaster: (id) => api.delete(`/fees/masters/${id}`),

  // Assignments
  getAssigns:   (p)    => api.get('/fees/assigns', { params: p }),
  editAssign:   (id,d) => api.put(`/fees/assigns/${id}`, d),
  bulkAssign: (data) => api.post('/fees/assigns/bulk', data),

  // Collection
  collectFee: (data) => api.post('/fees/collect', data),
  // collect: (data) => api.post('/fees/collect', data),
  getPayments: (params) => api.get('/fees/payments', { params }),

  // Reports
  getReport: (params) => api.get('/fees/report', { params }),
  updateOverdue: () => api.post('/fees/update-overdue'),

  // Student
  myFees:       (p)    => api.get('/fees/student/my-fees', { params: p }),
  myPayments:   (p)    => api.get('/fees/student/my-payments', { params: p }),
  payFee:       (d)    => api.post('/fees/student/pay', d),

  // Receipt & extras
  getReceipt:      (id) => api.get(`/fees/receipt/${id}`, { responseType: 'text' }),
  sendReminders:   ()   => api.post('/fees/send-reminders'),
  applyDiscount:   (id,data)=> api.post(`/fees/assigns/${id}/discount`, data),

  // Razorpay
  createOrder:     (data)  => api.post('/fees/razorpay/create-order', data),
  verifyPayment:   (data)  => api.post('/fees/razorpay/verify', data),
}




// ─── Assignments ──────────────────────────────────────────────────────────────
export const assignmentsAPI = {
  ...crud('/assignments'),
  myAssignments: (params)        => api.get('/assignments/my', { params }),
  submit:        (id, data)      => api.post(`/assignments/${id}/submit`, data),
  grade:         (id, subId, d)  => api.patch(`/assignments/${id}/submissions/${subId}/grade`, d),
}
export const submissionsAPI = crud('/submissions')

// ─── Library ─────────────────────────────────────────────────────────────────
export const bookCategoriesAPI  = crud('/book-categories')
export const booksAPI           = crud('/books')
export const libraryMembersAPI  = crud('/library-members')
export const bookIssuesAPI      = crud('/book-issues')

// ─── Events & Notifications ───────────────────────────────────────────────────
export const eventsAPI = crud('/events')

export const notificationsAPI = {
  send:       (data)   => api.post('/notifications', data),
  my:         (params) => api.get('/notifications/my', { params }),
  markRead:   (id)     => api.patch(`/notifications/${id}/read`),
  markAllRead:()       => api.patch('/notifications/read-all'),
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────
export const quizzesAPI = {
  // Teacher/Admin
  getAll:        (params)         => api.get('/quizzes', { params }),
  getById:       (id)             => api.get(`/quizzes/${id}`),
  create:        (data)           => api.post('/quizzes', data),
  update:        (id, data)       => api.put(`/quizzes/${id}`, data),
  remove:        (id)             => api.delete(`/quizzes/${id}`),
  getQuestions:  (id)             => api.get(`/quizzes/${id}/questions`),
  saveQuestions: (id, questions)  => api.post(`/quizzes/${id}/questions`, { questions }),
  publish:       (id)             => api.patch(`/quizzes/${id}/publish`),
  end:           (id)             => api.patch(`/quizzes/${id}/end`),
  getResults:    (id, params)     => api.get(`/quizzes/${id}/results`, { params }),
  // Student
  studentQuizzes: ()              => api.get('/quizzes/student/available'),
  startQuiz:      (id)            => api.post(`/quizzes/student/${id}/start`),
  submitQuiz:     (attemptId, d)  => api.post(`/quizzes/student/attempt/${attemptId}/submit`, d),
  myAttempt:      (id)            => api.get(`/quizzes/student/${id}/my-attempt`),
}

// ─── Roles & Permissions ──────────────────────────────────────────────────────
export const rolesAPI = {
  ...crud('/roles'),
  assignPermissions: (id, ids)         => api.put(`/roles/${id}/permissions`, { permission_ids: ids }),
  assignToUser:      (userId, roleId)  => api.post('/roles/assign', { user_id: userId, role_id: roleId }),
  revokeFromUser:    (userId, roleId)  => api.post('/roles/revoke', { user_id: userId, role_id: roleId }),
  userRoles:         (userId)          => api.get(`/roles/user/${userId}`),
}
export const permissionsAPI = { getAll: () => api.get('/permissions') }
