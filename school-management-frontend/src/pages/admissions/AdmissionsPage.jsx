import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, XCircle, Clock, Eye, User,
  Users, BookOpen, Phone, Mail, Calendar, ChevronRight
} from 'lucide-react'
import api from '@/api/axios'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, Badge, Avatar, Input, Label } from '@/components/ui/index.jsx'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/hooks/useToast'
import { fDate, fDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { useForm } from 'react-hook-form'

const STATUS_CFG = {
  pending:  { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',   icon: Clock,        label: 'Pending'  },
  approved: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30', icon: CheckCircle2, label: 'Approved' },
  rejected: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30',         icon: XCircle,      label: 'Rejected' },
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
const AdmissionDetail = ({ admission, onApprove, onReject, approving, rejecting }) => {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const { register, handleSubmit } = useForm()
  const cfg = STATUS_CFG[admission.status] || STATUS_CFG.pending

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <div className={cn('flex items-center gap-2 p-3 rounded-xl', cfg.color)}>
        <cfg.icon className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">Status: {cfg.label}</span>
        {admission.reviewed_at && (
          <span className="text-xs ml-auto">{fDateTime(admission.reviewed_at)}</span>
        )}
      </div>

      {/* Student Info */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Student Information</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Full Name',    value: admission.student_name,         icon: User },
            { label: 'Date of Birth',value: fDate(admission.dob),           icon: Calendar },
            { label: 'Gender',       value: admission.gender,               icon: User },
            { label: 'Blood Group',  value: admission.blood_group || '—',  icon: User },
            { label: 'Religion',     value: admission.religion || '—',     icon: User },
            { label: 'Address',      value: admission.address || '—',      icon: User },
          ].map(item => (
            <div key={item.label} className="p-2.5 rounded-lg bg-muted/40 border border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
              <p className="text-sm font-medium capitalize mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Parent Info */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Parent / Guardian</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Father Name',     value: admission.father_name     || '—' },
            { label: 'Father Phone',    value: admission.father_phone    || '—' },
            { label: 'Mother Name',     value: admission.mother_name     || '—' },
            { label: 'Mother Phone',    value: admission.mother_phone    || '—' },
            { label: 'Guardian Email',  value: admission.guardian_email  || '—' },
            { label: 'Guardian Phone',  value: admission.guardian_phone  || '—' },
          ].map(item => (
            <div key={item.label} className="p-2.5 rounded-lg bg-muted/40 border border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
              <p className="text-sm font-medium mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Academic Info */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Academic</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Class Applying For', value: admission.class_applying_for || '—' },
            { label: 'Previous School',    value: admission.previous_school    || '—' },
            { label: 'Previous Class',     value: admission.previous_class     || '—' },
            { label: 'Applied On',         value: fDateTime(admission.applied_at) },
          ].map(item => (
            <div key={item.label} className="p-2.5 rounded-lg bg-muted/40 border border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
              <p className="text-sm font-medium mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rejection reason if rejected */}
      {admission.status === 'rejected' && admission.rejection_reason && (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Rejection Reason</p>
          <p className="text-sm text-red-600 dark:text-red-400">{admission.rejection_reason}</p>
        </div>
      )}

      {/* Admission number if approved */}
      {admission.status === 'approved' && admission.admission_number && (
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Admission Number</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono">{admission.admission_number}</p>
          <p className="text-xs text-emerald-600 mt-1">Credentials sent to: {admission.guardian_email}</p>
        </div>
      )}

      {/* Action buttons — only for pending */}
      {admission.status === 'pending' && (
        <div className="space-y-3 pt-2 border-t border-border">
          {!showRejectForm ? (
            <div className="flex gap-3">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={onApprove} loading={approving}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
              <Button variant="outline" className="flex-1 text-red-500 border-red-300 hover:bg-red-50"
                onClick={() => setShowRejectForm(true)}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(d => onReject(d.reason))} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Rejection Reason *</Label>
                <Input placeholder="Reason for rejection..."
                  {...register('reason', { required: true })} />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1"
                  onClick={() => setShowRejectForm(false)}>Cancel</Button>
                <Button type="submit" variant="destructive" className="flex-1" loading={rejecting}>
                  Confirm Reject
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export const AdmissionsPage = () => {
  const qc  = useQueryClient()
  const [page,     setPage]     = useState(1)
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState('')
  const [viewing,  setViewing]  = useState(null)
  const [selected, setSelected] = useState([])

  const { data, isLoading } = useQuery({
    queryKey: ['admissions', page, search, status],
    queryFn:  () => api.get('/admissions', { params: { page, limit: 10, search, status: status || undefined } }).then(r => r.data),
  })

  const admissions = data?.data        || []
  const counts     = data?.counts      || { pending: 0, approved: 0, rejected: 0 }
  const pagination = data?.pagination  || {}

  const approveMutation = useMutation({
    mutationFn: (id) => api.put(`/admissions/${id}/approve`),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Admission approved!')
      qc.invalidateQueries(['admissions'])
      setViewing(null)
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to approve'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => api.put(`/admissions/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Admission rejected')
      qc.invalidateQueries(['admissions'])
      setViewing(null)
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to reject'),
  })

  const bulkApproveMutation = useMutation({
    mutationFn: (ids) => api.post('/admissions/bulk-approve', { ids }),
    onSuccess: (res) => {
      const { approved, failed } = res.data.data
      toast.success(`${approved.length} student(s) approved${failed.length ? `, ${failed.length} failed` : ''}`)
      if (failed.length) failed.forEach(f => toast.error(f.reason))
      setSelected([])
      qc.invalidateQueries(['admissions'])
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Bulk approve failed'),
  })

  const pendingList  = admissions.filter(a => a.status === 'pending')
  const allSelected  = pendingList.length > 0 && pendingList.every(a => selected.includes(a._id))
  const toggleOne    = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleAll    = () => setSelected(allSelected ? [] : pendingList.map(a => a._id))

  const columns = [
    { header: (
        <input type="checkbox" checked={allSelected} onChange={toggleAll}
          disabled={pendingList.length === 0}
          className="h-4 w-4 rounded cursor-pointer" title="Select all pending" />
      ),
      cell: r => r.status === 'pending'
        ? <input type="checkbox" checked={selected.includes(r._id)} onChange={() => toggleOne(r._id)}
            className="h-4 w-4 rounded cursor-pointer" />
        : <span className="w-4 inline-block" />
    },
    { header: 'Student', cell: r => (
      <div className="flex items-center gap-2.5">
        <Avatar name={r.student_name} size="sm" />
        <div>
          <p className="text-sm font-medium">{r.student_name}</p>
          <p className="text-xs text-muted-foreground">{r.guardian_email}</p>
        </div>
      </div>
    )},
    { header: 'Class', cell: r => (
      <p className="text-sm">{r.class_applying_for}</p>
    )},
    { header: 'Applied On', cell: r => (
      <p className="text-sm text-muted-foreground">{fDate(r.applied_at)}</p>
    )},
    { header: 'Contact', cell: r => (
      <p className="text-xs text-muted-foreground">{r.father_phone || r.guardian_phone || '—'}</p>
    )},
    { header: 'Status', cell: r => {
      const cfg = STATUS_CFG[r.status] || STATUS_CFG.pending
      return (
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1 w-fit', cfg.color)}>
          <cfg.icon className="h-3 w-3" /> {cfg.label}
        </span>
      )
    }},
    { header: 'Action', className: 'text-right', cellClassName: 'text-right', cell: r => (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => setViewing(r)}>
          <Eye className="h-3.5 w-3.5" /> View
        </Button>
        {r.status === 'pending' && (
          <>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs"
              onClick={() => approveMutation.mutate(r._id)}
              loading={approveMutation.isPending}>
              Approve
            </Button>
            <Button size="sm" variant="outline" className="text-red-500 border-red-300 text-xs"
              onClick={() => setViewing(r)}>
              Reject
            </Button>
          </>
        )}
      </div>
    )},
  ]

  return (
    <div>
      <PageHeader
        title="Admissions"
        description="Review and manage student admission applications"
        breadcrumbs={[{ label: 'People' }, { label: 'Admissions' }]}
        action={
          <a href="/apply" target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-colors">
            View Apply Page <ChevronRight className="h-4 w-4" />
          </a>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Pending Review', value: counts.pending,  color: 'text-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/20',   icon: Clock        },
          { label: 'Approved',       value: counts.approved, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20',icon: CheckCircle2 },
          { label: 'Rejected',       value: counts.rejected, color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-900/20',       icon: XCircle      },
        ].map(s => (
          <button key={s.label}
            onClick={() => setStatus(s.label === 'Pending Review' ? 'pending' : s.label.toLowerCase())}
            className={cn('p-4 rounded-xl border border-border text-left transition-all hover:shadow-sm', s.bg)}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn('text-2xl font-bold font-display', s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
              <s.icon className={cn('h-6 w-6', s.color)} />
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

        {/* Bulk action bar */}
      {pendingList.length > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 mb-4 rounded-xl border border-border bg-card flex-wrap">
          <p className="text-sm text-muted-foreground">
            {selected.length > 0
              ? <><strong className="text-foreground">{selected.length}</strong> selected</>
              : <>{pendingList.length} pending on this page</>}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={toggleAll}>
              {allSelected ? 'Deselect All' : 'Select All Pending'}
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
              disabled={selected.length === 0}
              loading={bulkApproveMutation.isPending}
              onClick={() => bulkApproveMutation.mutate(selected)}>
              <CheckCircle2 className="h-4 w-4" />
              Approve Selected ({selected.length})
            </Button>
            <Button size="sm" variant="outline" className="border-emerald-500 text-emerald-600"
              loading={bulkApproveMutation.isPending}
              onClick={() => bulkApproveMutation.mutate(pendingList.map(a => a._id))}>
              Approve All Pending ({pendingList.length})
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card><CardContent className="pt-5">
        <DataTable
          columns={columns}
          data={admissions}
          total={pagination.total}
          page={pagination.page}
          pages={pagination.pages}
          limit={pagination.limit}
          isLoading={isLoading}
          onPageChange={setPage}
          onSearch={v => { setSearch(v); setPage(1) }}
          searchPlaceholder="Search by name, email..."
          emptyIcon={User}
          emptyTitle="No admission applications"
          emptyDescription="Share the apply page link with prospective students"
        />
      </CardContent></Card>

      {/* Detail Modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)}
        title="Admission Application" size="lg">
        {viewing && (
          <AdmissionDetail
            admission={viewing}
            onApprove={() => approveMutation.mutate(viewing._id)}
            onReject={(reason) => rejectMutation.mutate({ id: viewing._id, reason })}
            approving={approveMutation.isPending}
            rejecting={rejectMutation.isPending}
          />
        )}
      </Modal>
    </div>
  )
}