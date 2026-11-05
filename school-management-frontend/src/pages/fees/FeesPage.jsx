import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Plus, DollarSign, CreditCard, BarChart3, Trash2, Pencil,
  CheckCircle2, AlertCircle, Clock, XCircle, Receipt, Users,
  TrendingUp, ChevronRight, Search, CalendarDays
} from 'lucide-react'
import { feesAPI, classSetupsAPI, sessionsAPI } from '@/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/Button'
import {
  Card, CardHeader, CardTitle, CardContent,
  Badge, Input, Label, Select, Textarea, Spinner, Avatar
} from '@/components/ui/index.jsx'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { fCurrency, fDate, fDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { toast } from '@/hooks/useToast'
import { CollectionReportTab, TodayCollectionCard, PaidViaCell, useDebouncedValue } from './FeeCollectionReports'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

const TABS = [
  { label: 'Fee Groups',  icon: DollarSign  },
  { label: 'Fee Types',   icon: CreditCard  },
  { label: 'Fee Masters', icon: Receipt     },
  { label: 'Collection',  icon: CheckCircle2},
  { label: 'Report',      icon: BarChart3   },
  { label: 'Collection Report', icon: CalendarDays },
]

const STATUS_CFG = {
  unpaid:   { color: 'bg-red-100 text-red-700 dark:bg-red-900/30',     icon: XCircle,      label: 'Unpaid'        },
  partial:  { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30', icon: AlertCircle,  label: 'Partial'       },
  paid:     { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30', icon: CheckCircle2, label: 'Paid'    },
  overdue:  { color: 'bg-red-200 text-red-800 dark:bg-red-900/50',     icon: AlertCircle,  label: 'Overdue'       },
}

// ─── Fee Group Form ───────────────────────────────────────────────────────────
const FeeGroupForm = ({ initial, onSuccess, onCancel }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { name: initial?.name || '', description: initial?.description || '' }
  })
  const mutation = useMutation({
    mutationFn: d => initial ? feesAPI.updateGroup(initial._id, d) : feesAPI.createGroup(d),
    onSuccess: () => { toast.success(initial ? 'Updated' : 'Fee group created'); onSuccess?.() },
    onError:   e  => toast.error(e.response?.data?.message || 'Failed'),
  })
  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Group Name *</Label>
        <Input placeholder="e.g. Monthly Fees" {...register('name', { required: true })} />
        {errors.name && <p className="text-xs text-destructive">Required</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea placeholder="Description..." {...register('description')} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>{initial ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  )
}

// ─── Fee Type Form ────────────────────────────────────────────────────────────
const FeeTypeForm = ({ initial, onSuccess, onCancel }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { name: initial?.name || '', code: initial?.code || '', description: initial?.description || '' }
  })
  const mutation = useMutation({
    mutationFn: d => initial ? feesAPI.updateType(initial._id, d) : feesAPI.createType(d),
    onSuccess: () => { toast.success(initial ? 'Updated' : 'Fee type created'); onSuccess?.() },
    onError:   e  => toast.error(e.response?.data?.message || 'Failed'),
  })
  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <Label>Type Name *</Label>
          <Input placeholder="e.g. Tuition Fee" {...register('name', { required: true })} />
          {errors.name && <p className="text-xs text-destructive">Required</p>}
        </div>
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <Label>Code *</Label>
          <Input placeholder="e.g. TF001" {...register('code', { required: true })} className="uppercase" />
          {errors.code && <p className="text-xs text-destructive">Required</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea placeholder="Description..." {...register('description')} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>{initial ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  )
}

// ─── Fee Master Form ──────────────────────────────────────────────────────────
const FeeMasterForm = ({ initial, onSuccess, onCancel }) => {
  const { data: groups }   = useQuery({ queryKey: ['fee-groups-all'],  queryFn: () => feesAPI.getGroups({ limit: 100 }).then(r => r.data.data)  })
  const { data: types }    = useQuery({ queryKey: ['fee-types-all'],   queryFn: () => feesAPI.getTypes({ limit: 100 }).then(r => r.data.data)   })
  const { data: classes }  = useQuery({ queryKey: ['class-setups-all'],queryFn: () => classSetupsAPI.getAll({ limit: 100 }).then(r => r.data.data) })
  const { data: sessions } = useQuery({ queryKey: ['sessions-all'],    queryFn: () => sessionsAPI.getAll({ limit: 100 }).then(r => r.data.data) })

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      fee_group_id:   initial?.fee_group_id?._id   || '',
      fee_type_id:    initial?.fee_type_id?._id    || '',
      session_id:     initial?.session_id?._id     || '',
      class_setup_id: initial?.class_setup_id?._id || '',
      amount:         initial?.amount              || '',
      due_date:       initial?.due_date ? new Date(initial.due_date).toISOString().split('T')[0] : '',
    }
  })
  const mutation = useMutation({
    mutationFn: d => initial ? feesAPI.updateMaster(initial._id, d) : feesAPI.createMaster(d),
    onSuccess: () => { toast.success(initial ? 'Updated' : 'Fee master created'); onSuccess?.() },
    onError:   e  => toast.error(e.response?.data?.message || 'Failed'),
  })
  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Fee Group *</Label>
          <select {...register('fee_group_id', { required: true })}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">Select group</option>
            {(groups || []).map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
          </select>
          {errors.fee_group_id && <p className="text-xs text-destructive">Required</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Fee Type *</Label>
          <select {...register('fee_type_id', { required: true })}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">Select type</option>
            {(types || []).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          {errors.fee_type_id && <p className="text-xs text-destructive">Required</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Session *</Label>
          <select {...register('session_id', { required: true })}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">Select session</option>
            {(sessions || []).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Class (optional — leave blank for all)</Label>
          <select {...register('class_setup_id')}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">All Classes</option>
            {(classes || []).map(c => <option key={c._id} value={c._id}>{c.class_id?.name} {c.section_id?.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Amount (₹) *</Label>
          <Input type="number" min="0" placeholder="e.g. 1000" {...register('amount', { required: true, min: 0 })} />
          {errors.amount && <p className="text-xs text-destructive">Required</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Due Date</Label>
          <Input type="date" {...register('due_date')} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>{initial ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  )
}

// ─── Collect Payment Modal ────────────────────────────────────────────────────
const CollectPaymentModal = ({ assign, onSuccess, onCancel }) => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { amount_paid: '', payment_method: 'cash', transaction_id: '', note: '' }
  })
  const balance = assign?.balance || 0
  const mutation = useMutation({
    mutationFn: d => feesAPI.collectFee({ fee_assign_id: assign._id, ...d, amount_paid: Number(d.amount_paid) }),
    onSuccess: (res) => {
      toast.success(`Payment collected! Receipt: ${res.data.data?.receipt_no}`)
      onSuccess?.()
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  return (
    <div className="space-y-4">
      {/* Student info */}
      <div className="p-4 rounded-xl bg-muted/50 border border-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={assign?.student_id?.user_id?.name || ''} size="sm" />
          <div>
            <p className="text-sm font-semibold">{assign?.student_id?.user_id?.name}</p>
            <p className="text-xs text-muted-foreground">{assign?.fee_master_id?.fee_type_id?.name}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Total',   value: fCurrency(assign?.net_amount || assign?.amount),    color: 'text-foreground' },
            { label: 'Paid',    value: fCurrency(assign?.total_paid || 0),                  color: 'text-emerald-600' },
            { label: 'Balance', value: fCurrency(balance),                                  color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="p-2 rounded-lg bg-background border border-border">
              <p className={cn('text-base font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Amount to Pay (₹) *</Label>
          <Input type="number" min="1" max={balance} placeholder={`Max: ${fCurrency(balance)}`}
            {...register('amount_paid', { required: true, min: 1, max: balance })} />
          {errors.amount_paid && <p className="text-xs text-destructive">Enter valid amount (max {fCurrency(balance)})</p>}
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={() => {}} className="text-xs text-primary hover:underline">Pay full balance ({fCurrency(balance)})</button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Payment Method *</Label>
          <select {...register('payment_method')}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="online">Online</option>
          </select>
        </div>
        {watch('payment_method') !== 'cash' && (
          <div className="space-y-1.5">
            <Label>Transaction ID / Reference</Label>
            <Input placeholder="Transaction reference" {...register('transaction_id')} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Note (optional)</Label>
          <Input placeholder="Any note..." {...register('note')} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Collect Payment</Button>
        </div>
      </form>
    </div>
  )
}


// ─── Edit Fee Assignment Modal ─────────────────────────────────────────────────
const EditAssignmentModal = ({ assign, onSuccess, onCancel }) => {
  const netAmount = assign?.net_amount || assign?.amount || 0
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      amount:        assign?.amount     || '',
      discount:      assign?.discount   || 0,
      fine:          assign?.fine       || 0,
      due_date:      assign?.due_date ? new Date(assign.due_date).toISOString().split('T')[0] : '',
      label:         assign?.label      || '',
    }
  })
  const mutation = useMutation({
    mutationFn: d => feesAPI.editAssign(assign._id, {
      ...d,
      amount:   Number(d.amount),
      discount: Number(d.discount),
      fine:     Number(d.fine),
    }),
    onSuccess: () => { toast.success('Fee assignment updated'); onSuccess?.() },
    onError:   e  => toast.error(e.response?.data?.message || 'Failed'),
  })
  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      {/* Student info */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
        <Avatar name={assign?.student_id?.user_id?.name || ''} size="sm" />
        <div>
          <p className="text-sm font-semibold">{assign?.student_id?.user_id?.name}</p>
          <p className="text-xs text-muted-foreground">
            {assign?.fee_master_id?.fee_type_id?.name} — {assign?.fee_master_id?.fee_group_id?.name}
          </p>
        </div>
      </div>

      {/* Carry forward info */}
      {assign?.carry_forward > 0 && (
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            ⚠ Includes carry forward balance of {fCurrency(assign.carry_forward)} from previous period
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Amount (₹) *</Label>
          <Input type="number" min="0" step="0.01"
            {...register('amount', { required: true, min: 0 })} />
          {errors.amount && <p className="text-xs text-destructive">Required</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Due Date</Label>
          <Input type="date" {...register('due_date')} />
        </div>
        <div className="space-y-1.5">
          <Label>Discount (₹)</Label>
          <Input type="number" min="0" step="0.01" {...register('discount')} />
        </div>
        <div className="space-y-1.5">
          <Label>Fine / Late Fee (₹)</Label>
          <Input type="number" min="0" step="0.01" {...register('fine')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Label / Note</Label>
        <Input placeholder="e.g. July Installment, Q1 Fee..." {...register('label')} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>Update Fee</Button>
      </div>
    </form>
  )
}

// ─── Collection Tab ───────────────────────────────────────────────────────────
const CollectionTab = () => {
  const qc = useQueryClient()
  const [searchText,    setSearchText]    = useState('')
  const search = useDebouncedValue(searchText)
  const [classFilter,   setClassFilter]   = useState('')
  const [typeFilter,    setTypeFilter]    = useState('')
  const [statusFilter,  setStatus]        = useState('')
  const [collecting,    setCollecting]    = useState(null)
  const [editingAssign, setEditingAssign] = useState(null)
  const [page,          setPage]          = useState(1)

  const { data: classes } = useQuery({
    queryKey: ['class-setups-all'],
    queryFn:  () => classSetupsAPI.getAll({ limit: 100 }).then(r => r.data.data),
  })
  const { data: feeTypes } = useQuery({
    queryKey: ['fee-types-all'],
    queryFn:  () => feesAPI.getTypes({ limit: 100 }).then(r => r.data.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['fee-assigns', page, search, classFilter, typeFilter, statusFilter],
    queryFn:  () => feesAPI.getAssigns({
      page, limit: 15,
      search:         search       || undefined,
      class_setup_id: classFilter  || undefined,
      fee_type_id:    typeFilter   || undefined,
      status:         statusFilter || undefined,
    }).then(r => r.data),
  })

  const assigns    = data?.data       || []
  const pagination = data?.pagination || {}
  const summary    = data?.summary
  const filtersActive = !!(searchText || classFilter || typeFilter || statusFilter)

  const clearFilters = () => { setSearchText(''); setClassFilter(''); setTypeFilter(''); setStatus(''); setPage(1) }
  const refresh = () => {
    qc.invalidateQueries(['fee-assigns'])
    qc.invalidateQueries(['fee-today'])
    qc.invalidateQueries(['fee-collection-report'])
    qc.invalidateQueries(['fee-collection-payments'])
  }

  const selectCls = 'h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  const columns = [
    { header: 'Student', cell: r => {
      const s   = r.student_id
      const cls = `${s?.class_setup_id?.class_id?.name || ''} ${s?.class_setup_id?.section_id?.name || ''}`.trim()
      const meta = [cls, s?.admission_no && `Adm ${s.admission_no}`, s?.roll_number && `Roll ${s.roll_number}`].filter(Boolean).join(' · ')
      return (
        <div className="flex items-center gap-2.5">
          <Avatar name={s?.user_id?.name || ''} size="sm" />
          <div>
            <p className="text-sm font-medium">{s?.user_id?.name}</p>
            <p className="text-xs text-muted-foreground">{meta}</p>
          </div>
        </div>
      )
    }},
    { header: 'Fee', cell: r => (
      <div>
        <p className="text-sm font-medium">{r.fee_master_id?.fee_type_id?.name}</p>
        <p className="text-xs text-muted-foreground">{r.fee_master_id?.fee_group_id?.name}</p>
      </div>
    )},
    { header: 'Due Date', cell: r => (
      <p className={cn('text-sm', r.due_date && new Date(r.due_date) < new Date() && r.status !== 'paid' ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
        {fDate(r.due_date) || '—'}
      </p>
    )},
    { header: 'Total',   cell: r => <p className="text-sm font-semibold">{fCurrency(r.net_amount || r.amount)}</p> },
    { header: 'Paid',    cell: r => <p className="text-sm text-emerald-600 font-medium">{fCurrency(r.total_paid || 0)}</p> },
    { header: 'Balance', cell: r => <p className={cn('text-sm font-medium', r.balance > 0 ? 'text-red-500' : 'text-emerald-600')}>{fCurrency(r.balance || 0)}</p> },
    { header: 'Paid Via', cell: r => <PaidViaCell row={r} /> },
    { header: 'Status',  cell: r => {
      const cfg = STATUS_CFG[r.status] || STATUS_CFG.unpaid
      return (
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1 w-fit', cfg.color)}>
          <cfg.icon className="h-3 w-3" /> {cfg.label}
        </span>
      )
    }},
    { header: 'Action', className: 'text-right', cellClassName: 'text-right', cell: r => (
      <div className="flex items-center justify-end gap-1">
        {r.status !== 'paid' && (
          <Button size="sm" variant="ghost" onClick={() => setEditingAssign(r)} title="Edit fee">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {r.status !== 'paid'
          ? <Button size="sm" onClick={() => setCollecting(r)}>Collect</Button>
          : <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Paid
            </span>
        }
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, admission no, roll no, phone or email…" className="pl-8"
            value={searchText} onChange={e => { setSearchText(e.target.value); setPage(1) }} />
        </div>
        <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(1) }} className={selectCls}>
          <option value="">All Classes</option>
          {(classes || []).map(c => <option key={c._id} value={c._id}>{c.class_id?.name} {c.section_id?.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }} className={selectCls}>
          <option value="">All Fee Types</option>
          {(feeTypes || []).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }} className={selectCls}>
          <option value="">All Status</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
        {filtersActive && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
        <Button variant="outline" size="sm" onClick={() =>
          feesAPI.updateOverdue().then(() => { toast.success('Overdue status updated'); refresh() })
        }>
          Update Overdue
        </Button>
      </div>

      {/* Totals across ALL matching records, not just this page */}
      {summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Fee records', value: summary.records,                  color: 'text-primary'     },
              { label: 'Total fees',  value: fCurrency(summary.total_amount),  color: 'text-foreground'  },
              { label: 'Collected',   value: fCurrency(summary.total_paid),    color: 'text-emerald-600' },
              { label: 'Pending',     value: fCurrency(summary.total_balance), color: 'text-red-500'     },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-3 pb-3">
                  <p className={cn('text-lg font-bold font-display', s.color)}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Totals cover all {summary.records} matching records, not only the rows on this page.
          </p>
        </>
      )}

      <Card><CardContent className="pt-5">
        <DataTable
          columns={columns}
          data={assigns}
          total={pagination.total}
          page={pagination.page}
          pages={pagination.pages}
          limit={pagination.limit}
          isLoading={isLoading}
          onPageChange={setPage}
          emptyIcon={CreditCard}
          emptyTitle={filtersActive ? 'No fees match your search' : 'No fee assignments'}
          emptyDescription={filtersActive ? 'Try a different name, number or filter' : 'Assign fees from the Fee Masters tab'}
        />
      </CardContent></Card>

      {/* Collect Payment Modal */}
      <Modal open={!!collecting} onClose={() => setCollecting(null)} title="Collect Payment" size="md">
        {collecting && <CollectPaymentModal
          assign={collecting}
          onSuccess={() => { setCollecting(null); refresh() }}
          onCancel={() => setCollecting(null)}
        />}
      </Modal>

      {/* Edit Assignment Modal */}
      <Modal open={!!editingAssign} onClose={() => setEditingAssign(null)} title="Edit Fee Assignment" size="md">
        {editingAssign && <EditAssignmentModal
          assign={editingAssign}
          onSuccess={() => { setEditingAssign(null); refresh() }}
          onCancel={() => setEditingAssign(null)}
        />}
      </Modal>
    </div>
  )
}

// ─── Report Tab ───────────────────────────────────────────────────────────────
const ReportTab = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['fee-report'],
    queryFn:  () => feesAPI.getReport({}).then(r => r.data.data),
  })

  const { data: paymentsData } = useQuery({
    queryKey: ['fee-payments'],
    queryFn:  () => feesAPI.getPayments({ limit: 10 }).then(r => r.data),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  const summary    = data?.summary || []
  const monthly    = data?.monthlyCollection || []
  const defaulters = data?.defaulters || []
  const payments   = paymentsData?.data || []

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const chartData = monthly.map(m => ({ month: MONTHS[m._id.month - 1], total: m.total, count: m.count }))

  const summaryMap = {}
  summary.forEach(s => { summaryMap[s._id] = s })
  const totalAssigned = summary.reduce((s, i) => s + i.total_amount, 0)
  const totalPaid     = summaryMap['paid']?.total_amount     || 0
  const totalUnpaid   = summaryMap['unpaid']?.total_amount   || 0
  const totalPartial  = summaryMap['partial']?.total_amount  || 0

  const PIE_COLORS = { paid: '#10b981', unpaid: '#ef4444', partial: '#f59e0b', overdue: '#f97316' }
  const pieData = summary.map(s => ({ name: s._id, value: s.count, color: PIE_COLORS[s._id] || '#94a3b8' }))

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Assigned', value: fCurrency(totalAssigned),  color: 'text-primary'     },
          { label: 'Total Collected',value: fCurrency(totalPaid),       color: 'text-emerald-600' },
          { label: 'Outstanding',    value: fCurrency(totalUnpaid + totalPartial), color: 'text-red-500' },
          { label: 'Defaulters',     value: defaulters.length,          color: 'text-amber-500'   },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn('text-2xl font-bold font-display mt-1', s.color)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Monthly chart */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Monthly Collection</CardTitle></CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v/1000}k`} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={v => [fCurrency(v), 'Collected']} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4,4,0,0]} name="Collected" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No collection data yet</p>}
          </CardContent>
        </Card>

        {/* Status pie */}
        <Card>
          <CardHeader><CardTitle>Status Overview</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value" label={false}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                        <span className="capitalize">{d.name}</span>
                      </div>
                      <span className="font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
          </CardContent>
        </Card>
      </div>

      {/* Defaulters */}
      {defaulters.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Defaulters ({defaulters.length})</CardTitle>
              <Button size="sm" variant="outline"
                onClick={() => feesAPI.sendReminders()
                  .then(r => toast.success(`Reminders sent to ${r.data.data?.sent} students`))
                  .catch(() => toast.error('Failed to send reminders'))
                }>
                Send Email Reminders
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {defaulters.slice(0, 10).map(d => (
                <div key={d._id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={d.student_id?.user_id?.name || ''} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{d.student_id?.user_id?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.student_id?.class_setup_id?.class_id?.name} {d.student_id?.class_setup_id?.section_id?.name}
                        · Due: {fDate(d.due_date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-500">{fCurrency(d.amount)}</p>
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded capitalize', STATUS_CFG[d.status]?.color)}>
                      {d.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent payments */}
      {payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Payments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p._id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.fee_assign_id?.student_id?.user_id?.name}</p>
                      <p className="text-xs text-muted-foreground">{p.receipt_no} · {fDateTime(p.paid_date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">{fCurrency(p.amount_paid)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.payment_method}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


// ─── Generate Installment Modal ───────────────────────────────────────────────
// Admin generates a partial/installment fee for a whole class
const GenerateInstallmentModal = ({ onSuccess, onCancel }) => {
  const { data: masters }  = useQuery({ queryKey: ['fee-masters-all'],  queryFn: () => feesAPI.getMasters({ limit: 100 }).then(r => r.data.data) })
  const { data: classes }  = useQuery({ queryKey: ['class-setups-all'], queryFn: () => classSetupsAPI.getAll({ limit: 100 }).then(r => r.data.data) })
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { fee_master_id: '', class_setup_id: '', installment_amount: '', due_date: '', note: '' }
  })

  const selectedMaster = masters?.find(m => m._id === watch('fee_master_id'))

  const mutation = useMutation({
    mutationFn: async (d) => {
      // 1. Create a temporary fee master with installment amount
      const masterRes = await feesAPI.createMaster({
        fee_group_id:   selectedMaster?.fee_group_id?._id || selectedMaster?.fee_group_id,
        fee_type_id:    selectedMaster?.fee_type_id?._id  || selectedMaster?.fee_type_id,
        session_id:     selectedMaster?.session_id?._id   || selectedMaster?.session_id,
        class_setup_id: d.class_setup_id || selectedMaster?.class_setup_id,
        amount:         Number(d.installment_amount),
        due_date:       d.due_date,
      })
      const newMasterId = masterRes.data.data._id

      // 2. Bulk assign to all students in the class
      return feesAPI.bulkAssign({
        fee_master_id: newMasterId,
        note:          d.note,
      })
    },
    onSuccess: (r) => {
      toast.success(`Installment fee generated for ${r.data.data?.assigned} students!`)
      onSuccess?.()
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-400">
          This will generate a new installment fee for all students in the selected class.
          The student will see this as a separate payment due.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Base Fee Master *</Label>
        <select {...register('fee_master_id', { required: true })}
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <option value="">Select fee master</option>
          {(masters || []).map(m => (
            <option key={m._id} value={m._id}>
              {m.fee_type_id?.name} — {m.fee_group_id?.name} (₹{m.amount})
            </option>
          ))}
        </select>
        {errors.fee_master_id && <p className="text-xs text-destructive">Required</p>}
      </div>

      {selectedMaster && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs space-y-1">
          <p><span className="text-muted-foreground">Original Amount:</span> <strong>{fCurrency(selectedMaster.amount)}</strong></p>
          <p><span className="text-muted-foreground">Class:</span> <strong>{selectedMaster.class_setup_id?.class_id?.name} {selectedMaster.class_setup_id?.section_id?.name || 'All'}</strong></p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Override Class (optional)</Label>
        <select {...register('class_setup_id')}
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <option value="">Use class from fee master</option>
          {(classes || []).map(c => (
            <option key={c._id} value={c._id}>{c.class_id?.name} {c.section_id?.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Installment Amount (₹) *</Label>
          <Input type="number" min="1" placeholder="e.g. 500"
            {...register('installment_amount', { required: true, min: 1 })} />
          {errors.installment_amount && <p className="text-xs text-destructive">Required</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Due Date *</Label>
          <Input type="date" {...register('due_date', { required: true })} />
          {errors.due_date && <p className="text-xs text-destructive">Required</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Note (optional)</Label>
        <Input placeholder="e.g. July Installment, Q1 Fee..." {...register('note')} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>
          Generate for Whole Class
        </Button>
      </div>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export const FeesPage = () => {
  const qc = useQueryClient()
  const [tab,      setTab]     = useState(0)
  const [page,     setPage]    = useState(1)
  const [search,   setSearch]  = useState('')
  const [showForm, setShowForm]= useState(false)
  const [editing,  setEditing] = useState(null)
  const [deleting,     setDeleting]    = useState(null)
  const [showInstallment, setInstallment] = useState(false)

  const { data: groupsData, isLoading: loadingGroups } = useQuery({
    queryKey: ['fee-groups', page, search],
    queryFn:  () => feesAPI.getGroups({ page, limit: 10, search }).then(r => r.data),
    enabled: tab === 0,
  })
  const { data: typesData, isLoading: loadingTypes } = useQuery({
    queryKey: ['fee-types', page, search],
    queryFn:  () => feesAPI.getTypes({ page, limit: 10, search }).then(r => r.data),
    enabled: tab === 1,
  })
  const { data: mastersData, isLoading: loadingMasters } = useQuery({
    queryKey: ['fee-masters', page],
    queryFn:  () => feesAPI.getMasters({ page, limit: 10 }).then(r => r.data),
    enabled: tab === 2,
  })

  const deleteMutation = useMutation({
    mutationFn: (item) => {
      if (tab === 0) return feesAPI.deleteGroup(item._id)
      if (tab === 1) return feesAPI.deleteType(item._id)
      if (tab === 2) return feesAPI.deleteMaster(item._id)
    },
    onSuccess: () => {
      toast.success('Deleted')
      qc.invalidateQueries(['fee-groups','fee-types','fee-masters'])
      setDeleting(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const bulkAssignMutation = useMutation({
    mutationFn: id => feesAPI.bulkAssign({ fee_master_id: id }),
    onSuccess: r => toast.success(`Fee assigned to ${r.data.data?.assigned} students`),
    onError:   e  => toast.error(e.response?.data?.message || 'Failed'),
  })

  const groupColumns = [
    { header: 'Name',        cell: r => <p className="text-sm font-medium">{r.name}</p> },
    { header: 'Description', cell: r => <p className="text-sm text-muted-foreground">{r.description || '—'}</p> },
    { header: 'Status',      cell: r => <Badge variant={r.is_active ? 'success' : 'secondary'}>{r.is_active ? 'Active' : 'Inactive'}</Badge> },
    { header: 'Actions', className: 'text-right', cellClassName: 'text-right', cell: r => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(r); setShowForm(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeleting(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ]

  const typeColumns = [
    { header: 'Name', cell: r => <p className="text-sm font-medium">{r.name}</p> },
    { header: 'Code', cell: r => <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{r.code}</code> },
    { header: 'Description', cell: r => <p className="text-sm text-muted-foreground truncate max-w-48">{r.description || '—'}</p> },
    { header: 'Status', cell: r => <Badge variant={r.is_active ? 'success' : 'secondary'}>{r.is_active ? 'Active' : 'Inactive'}</Badge> },
    { header: 'Actions', className: 'text-right', cellClassName: 'text-right', cell: r => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(r); setShowForm(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeleting(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ]

  const masterColumns = [
    { header: 'Fee Group', cell: r => <p className="text-sm font-medium">{r.fee_group_id?.name}</p> },
    { header: 'Fee Type',  cell: r => <div><p className="text-sm">{r.fee_type_id?.name}</p><code className="text-[10px] bg-muted px-1 rounded">{r.fee_type_id?.code}</code></div> },
    { header: 'Class',     cell: r => <p className="text-sm">{r.class_setup_id ? `${r.class_setup_id?.class_id?.name} ${r.class_setup_id?.section_id?.name || ''}` : <span className="text-muted-foreground">All Classes</span>}</p> },
    { header: 'Amount',    cell: r => <p className="text-sm font-bold text-primary">{fCurrency(r.amount)}</p> },
    { header: 'Due Date',  cell: r => <p className="text-sm text-muted-foreground">{fDate(r.due_date) || '—'}</p> },
    { header: 'Actions', className: 'text-right', cellClassName: 'text-right', cell: r => (
      <div className="flex justify-end gap-1 flex-wrap">
        <Button variant="outline" size="sm" className="text-xs"
          onClick={() => bulkAssignMutation.mutate(r._id)}
          loading={bulkAssignMutation.isPending}>
          <Users className="h-3 w-3" /> Assign
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(r); setShowForm(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeleting(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ]

  const getTitle = () => ['Fee Groups', 'Fee Types', 'Fee Masters'][tab] || ''
  const getAddLabel = () => ['Add Group', 'Add Type', 'Add Master'][tab] || ''

  return (
    <div>
      <PageHeader
        title="Fee Management"
        description="Manage fee structures, collect payments and track outstanding dues"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Fees' }]}
        action={
          <div className="flex gap-2">
            {tab === 3 && (
              <Button size="sm" variant="outline" onClick={() => setInstallment(true)}>
                <Plus className="h-4 w-4" /> Generate Installment
              </Button>
            )}
            {tab < 3 && (
              <Button size="sm" onClick={() => { setEditing(null); setShowForm(true) }}>
                <Plus className="h-4 w-4" /> {getAddLabel()}
              </Button>
            )}
          </div>
        }
      />

      {/* Today's collection — shown on every Fees tab */}
      <TodayCollectionCard />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit mb-5 flex-wrap">
        {TABS.map((t, i) => (
          <button key={t.label} onClick={() => { setTab(i); setPage(1); setSearch('') }}
            className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === i ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Tab 0 — Fee Groups */}
      {tab === 0 && (
        <Card><CardContent className="pt-5">
          <DataTable columns={groupColumns} data={groupsData?.data || []}
            total={groupsData?.pagination?.total} page={groupsData?.pagination?.page}
            pages={groupsData?.pagination?.pages} limit={groupsData?.pagination?.limit}
            isLoading={loadingGroups} onPageChange={setPage}
            onSearch={v => { setSearch(v); setPage(1) }} searchPlaceholder="Search fee groups..."
            emptyIcon={DollarSign} emptyTitle="No fee groups" emptyDescription="Create a fee group first" />
        </CardContent></Card>
      )}

      {/* Tab 1 — Fee Types */}
      {tab === 1 && (
        <Card><CardContent className="pt-5">
          <DataTable columns={typeColumns} data={typesData?.data || []}
            total={typesData?.pagination?.total} page={typesData?.pagination?.page}
            pages={typesData?.pagination?.pages} limit={typesData?.pagination?.limit}
            isLoading={loadingTypes} onPageChange={setPage}
            onSearch={v => { setSearch(v); setPage(1) }} searchPlaceholder="Search fee types..."
            emptyIcon={CreditCard} emptyTitle="No fee types" emptyDescription="Create fee types like Tuition, Transport etc." />
        </CardContent></Card>
      )}

      {/* Tab 2 — Fee Masters */}
      {tab === 2 && (
        <Card><CardContent className="pt-5">
          <DataTable columns={masterColumns} data={mastersData?.data || []}
            total={mastersData?.pagination?.total} page={mastersData?.pagination?.page}
            pages={mastersData?.pagination?.pages} limit={mastersData?.pagination?.limit}
            isLoading={loadingMasters} onPageChange={setPage}
            emptyIcon={Receipt} emptyTitle="No fee masters" emptyDescription="Create fee masters and assign to classes" />
        </CardContent></Card>
      )}

      {/* Tab 3 — Collection */}
      {tab === 3 && <CollectionTab />}

      {/* Tab 4 — Report */}
      {tab === 4 && <ReportTab />}

      {/* Tab 5 — Collection report (day / week / month / custom range) */}
      {tab === 5 && <CollectionReportTab />}

      {/* Create/Edit Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }}
        title={editing ? `Edit ${getTitle().slice(0,-1)}` : `Add ${getTitle().slice(0,-1)}`} size="md">
        {tab === 0 && <FeeGroupForm  initial={editing} onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries(['fee-groups'])  }} onCancel={() => { setShowForm(false); setEditing(null) }} />}
        {tab === 1 && <FeeTypeForm   initial={editing} onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries(['fee-types'])   }} onCancel={() => { setShowForm(false); setEditing(null) }} />}
        {tab === 2 && <FeeMasterForm initial={editing} onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries(['fee-masters']) }} onCancel={() => { setShowForm(false); setEditing(null) }} />}
      </Modal>

      {/* Generate Installment Modal */}
      <Modal open={showInstallment} onClose={() => setInstallment(false)}
        title="Generate Installment Fee" description="Create a partial fee for the whole class" size="md">
        <GenerateInstallmentModal
          onSuccess={() => { setInstallment(false); qc.invalidateQueries(['fee-assigns']) }}
          onCancel={() => setInstallment(false)}
        />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal open={!!deleting} onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate(deleting)}
        loading={deleteMutation.isPending}
        title="Confirm Delete"
        description={`Are you sure you want to delete "${deleting?.name}"?`} />
    </div>
  )
}
