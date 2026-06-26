import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { AppLayout } from '@/components/layout/AppLayout'

// Auth
import { LoginPage }         from '@/pages/auth/LoginPage'

// Master — completely separate, no school_id needed
import { MasterLoginPage }   from '@/pages/master/MasterLoginPage'
import { MasterDashboard }   from '@/pages/master/MasterDashboard'

// Student Portal
import { StudentPortal }     from '@/pages/student/StudentPortal'
import { QuizAttemptPage }   from '@/pages/quizzes/QuizAttemptPage'

// School pages
import { DashboardPage }     from '@/pages/dashboard/DashboardPage'
import { StudentsPage }      from '@/pages/students/StudentsPage'
import { StudentDetailPage } from '@/pages/students/StudentDetailPage'
import { ParentsPage }       from '@/pages/parents/ParentsPage'
import { TeachersPage }      from '@/pages/teachers/TeachersPage'
import { StaffPage }         from '@/pages/staff/StaffPage'
import { ClassesPage }       from '@/pages/classes/ClassesPage'
import { SubjectsPage }      from '@/pages/subjects/SubjectsPage'
import { ClassRoutinesPage } from '@/pages/classes/ClassRoutinesPage'
import { AttendancePage }    from '@/pages/attendance/AttendancePage'
import { AssignmentsPage }   from '@/pages/assignments/AssignmentsPage'
import { ExamsPage }         from '@/pages/exams/ExamsPage'
import { ExamDetailPage }    from '@/pages/exams/ExamDetailPage'
import { AdmitCardsPage }    from '@/pages/exams/AdmitCardsPage'
import { MarksheetsPage }    from '@/pages/exams/MarksheetsPage'
import { FeesPage }          from '@/pages/fees/FeesPage'
import { LibraryPage }       from '@/pages/library/LibraryPage'
import { EventsPage }        from '@/pages/events/EventsPage'
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'
import { RolesPage }         from '@/pages/settings/RolesPage'
import { SettingsPage }      from '@/pages/settings/SettingsPage'
import { QuizzesPage }       from '@/pages/quizzes/QuizzesPage'
import { QuizBuilderPage }   from '@/pages/quizzes/QuizBuilderPage'
import { QuizResultsPage }   from '@/pages/quizzes/QuizResultsPage'
import { NotFoundPage }      from '@/pages/NotFoundPage'

// ─── Guards ───────────────────────────────────────────────────────────────────

// Already logged in → redirect away from login
const GuestGuard = () => {
  const token = useAuthStore(s => s.accessToken)
  const roles = useAuthStore(s => s.roles)
  if (!token) return <Outlet />
  // Master admin should never land on school login
  if (roles.includes('master')) return <Navigate to="/master/dashboard" replace />
  if (roles.includes('student') || roles.includes('parent')) return <Navigate to="/student" replace />
  return <Navigate to="/dashboard" replace />
}

// Prevent logged-in school users from accessing /master
const MasterPageGuard = () => {
  const token = useAuthStore(s => s.accessToken)
  const roles = useAuthStore(s => s.roles)
  // If already logged in as super_admin go to master dashboard
  if (token && roles.includes('master')) return <Navigate to="/master/dashboard" replace />
  return <Outlet />
}

// Must be logged in
const AuthGuard = () => {
  const token = useAuthStore(s => s.accessToken)
  return token ? <Outlet /> : <Navigate to="/login" replace />
}

// Master panel — uses its own separate auth, stored separately
// Master login does NOT set the main authStore — it uses masterAuthStore
// For simplicity: master dashboard is accessible if user has any token
// (Master login page handles its own auth check)
const MasterGuard = () => {
  const token = useAuthStore(s => s.accessToken)
  const roles = useAuthStore(s => s.roles)

  console.log('MASTER GUARD - token:', !!token, 'roles:', roles)

  if (!token) return <Navigate to="/master" replace />
  if (!roles.includes('master')) return <Navigate to="/master" replace />
  return <Outlet />
}

// School users only (not student/parent)
const SchoolGuard = () => {
  const token = useAuthStore(s => s.accessToken)
  const roles = useAuthStore(s => s.roles)
  if (!token) return <Navigate to="/login" replace />
  // Master admin should not access school routes
  if (roles.includes('master')) return <Navigate to="/master/dashboard" replace />
  if (roles.includes('student') || roles.includes('parent')) return <Navigate to="/student" replace />
  return <Outlet />
}

// Student / Parent only
const StudentGuard = () => {
  const token = useAuthStore(s => s.accessToken)
  const roles = useAuthStore(s => s.roles)
  if (!token) return <Navigate to="/login" replace />
  if (roles.includes('student') || roles.includes('parent')) return <Outlet />
  return <Navigate to="/dashboard" replace />
}

const router = createBrowserRouter([

  // ── Root ─────────────────────────────────────────────────────────────────
  { path: '/', element: <Navigate to="/login" replace /> },

  // ── Master Admin panel — separate login, separate auth ────────────────────
  {
    element: <MasterPageGuard />,
    children: [{ path: '/master', element: <MasterLoginPage /> }],
  },
  {
    element: <MasterGuard />,
    children: [
      { path: '/master/dashboard', element: <MasterDashboard /> },
    ],
  },

  // ── School login ──────────────────────────────────────────────────────────
  {
    element: <GuestGuard />,
    children: [
      { path: '/login', element: <LoginPage /> },
    ],
  },

  // ── Student Portal ────────────────────────────────────────────────────────
  {
    element: <StudentGuard />,
    children: [
      { path: '/student',  element: <StudentPortal /> },
      { path: '/quiz/:id', element: <QuizAttemptPage /> },
    ],
  },

  // ── School App (super_admin, admin, teacher, accountant, librarian) ────────
  {
    element: <SchoolGuard />,
    children: [{
      element: <AppLayout />,
      children: [
        { path: '/dashboard',           element: <DashboardPage />    },
        { path: '/students',            element: <StudentsPage />     },
        { path: '/students/:id',        element: <StudentDetailPage />},
        { path: '/parents',             element: <ParentsPage />      },
        { path: '/teachers',            element: <TeachersPage />     },
        { path: '/staff',               element: <StaffPage />        },
        { path: '/classes',             element: <ClassesPage />      },
        { path: '/subjects',            element: <SubjectsPage />     },
        { path: '/class-routines',      element: <ClassRoutinesPage />},
        { path: '/attendance',          element: <AttendancePage />   },
        { path: '/assignments',         element: <AssignmentsPage />  },
        { path: '/exams',               element: <ExamsPage />        },
        { path: '/exams/:id',           element: <ExamDetailPage />   },
        { path: '/admit-cards',         element: <AdmitCardsPage />   },
        { path: '/marksheets',          element: <MarksheetsPage />   },
        { path: '/fees',                element: <FeesPage />         },
        { path: '/library',             element: <LibraryPage />      },
        { path: '/events',              element: <EventsPage />       },
        { path: '/notifications',       element: <NotificationsPage />},
        { path: '/roles',               element: <RolesPage />        },
        { path: '/settings',            element: <SettingsPage />     },
        { path: '/quizzes',             element: <QuizzesPage />      },
        { path: '/quizzes/:id/builder', element: <QuizBuilderPage />  },
        { path: '/quizzes/:id/results', element: <QuizResultsPage />  },
      ],
    }],
  },

  // ── 404 ───────────────────────────────────────────────────────────────────
  { path: '*', element: <NotFoundPage /> },
])

export const AppRouter = () => <RouterProvider router={router} />
