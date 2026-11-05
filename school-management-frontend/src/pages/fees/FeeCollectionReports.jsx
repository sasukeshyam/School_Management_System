import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Banknote, Smartphone, CreditCard, Landmark, FileText, Wallet,
  TrendingUp, TrendingDown,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import api from '@/api/axios'
import { classSetupsAPI } from '@/api'
import { DataTable } from '@/components/shared/DataTable'
import { Card, CardContent, CardHeader, CardTitle, Input, Avatar } from '@/components/ui/index.jsx'
import { fCurrency, fDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'

// ─── Payment method / type display ────────────────────────────────────────────
export const METHOD_CFG = {
  cash:          { label: 'Cash',          icon: Banknote,   fill: '#10b981', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  upi:           { label: 'UPI',           icon: Smartphone, fill: '#8b5cf6', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  online:        { label: 'Online',        icon: CreditCard, fill: '#3b82f6', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  cheque:        { label: 'Cheque',        icon: FileText,   fill: '#f59e0b', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  bank_transfer: { label: 'Bank transfer', icon: Landmark,   fill: '#06b6d4', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
}
const methodCfg = (m) =>
  METHOD_CFG[m] || { label: m ? String(m).replace(/_/g, ' ') : 'Other', icon: Wallet, fill: '#94a3b8', cls: 'bg-muted text-muted-foreground' }

export const TYPE_CFG = {
  full:        { label: 'Full payment',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  partial:     { label: 'Partial',           cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  final:       { label: 'Final instalment',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  unspecified: { label: 'Not recorded',      cls: 'bg-muted text-muted-foreground' },
}

export const MethodBadge = ({ method }) => {
  const c = methodCfg(method)
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', c.cls)}>
      <c.icon className="h-3 w-3" /> {c.label}
    </span>
  )
}

export const TypeBadge = ({ type }) => {
  const c = TYPE_CFG[type] || TYPE_CFG.unspecified
  return <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', c.cls)}>{c.label}</span>
}

// What the admin sees in the Collection tab: how this fee was paid so far
export const PaidViaCell = ({ row }) => {
  const pays = row.payments || []
  if (!pays.length) return <span className="text-xs text-muted-foreground">—</span>
  const methods = [...new Set(pays.map((p) => p.payment_method))]
  const note = row.status === 'paid'
    ? (pays.length === 1 ? 'Paid in full' : `Paid in ${pays.length} instalments`)
    : 'Partly paid'
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">{methods.map((m) => <MethodBadge key={m} method={m} />)}</div>
      <p className="text-[10px] text-muted-foreground">{note}</p>
    </div>
  )
}

export const useDebouncedValue = (value, delay = 400) => {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad   = (n) => String(n).padStart(2, '0')
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

const fmtDay = (s) => {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}
const fmtMonth = (s) => {
  const [y, m] = s.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
const shortKey = (k, groupBy) => {
  const p = k.split('-')
  return groupBy === 'month' ? `${MONTHS_SHORT[+p[1] - 1]} ${p[0].slice(2)}` : `${p[2]} ${MONTHS_SHORT[+p[1] - 1]}`
}
const longKey = (k, groupBy) => (groupBy === 'month' ? fmtMonth(k) : fmtDay(k))

const PRESETS = [
  { id: 'today',     label: 'Today',       range: () => { const t = new Date(); return [toStr(t), toStr(t)] } },
  { id: 'yesterday', label: 'Yesterday',   range: () => { const y = addDays(new Date(), -1); return [toStr(y), toStr(y)] } },
  { id: 'week',      label: 'Last 7 days', range: () => [toStr(addDays(new Date(), -6)), toStr(new Date())] },
  { id: 'month',     label: 'This month',  range: () => { const n = new Date(); return [toStr(new Date(n.getFullYear(), n.getMonth(), 1)), toStr(n)] } },
  { id: 'lastMonth', label: 'Last month',  range: () => { const n = new Date(); return [toStr(new Date(n.getFullYear(), n.getMonth() - 1, 1)), toStr(new Date(n.getFullYear(), n.getMonth(), 0))] } },
  { id: 'year',      label: 'This year',   range: () => { const n = new Date(); return [toStr(new Date(n.getFullYear(), 0, 1)), toStr(n)] } },
]

const selectCls = 'h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i

// ─── Today's collection (shown at the top of the Fees page) ───────────────────
export const TodayCollectionCard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['fee-today'],
    queryFn: () => api.get('/fees/today').then((r) => r.data.data),
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  })

  if (isLoading) return <div className="mb-5 h-28 animate-pulse rounded-2xl bg-muted/40" />
  if (!data) return null

  const { today, yesterday, month } = data
  const delta = yesterday.total > 0 ? ((today.total - yesterday.total) / yesterday.total) * 100 : null

  return (
    <div className="mb-5 rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-5 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/70">Collected today · {fmtDay(data.date)}</p>
          <p className="mt-1 font-display text-3xl font-bold">{fCurrency(today.total)}</p>
          <p className="mt-0.5 text-sm text-white/80">
            {today.count} payment{today.count !== 1 ? 's' : ''}
            {delta !== null && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs">
                {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {Math.abs(delta).toFixed(0)}% {delta >= 0 ? 'more' : 'less'} than yesterday ({fCurrency(yesterday.total)})
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-white/70">This month</p>
          <p className="text-xl font-bold">{fCurrency(month.total)}</p>
          <p className="text-xs text-white/70">{month.count} payment{month.count !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {today.by_method.length === 0 ? (
          <span className="text-sm text-white/70">No payments received yet today</span>
        ) : (
          today.by_method.map((m) => {
            const c = methodCfg(m.method)
            return (
              <span key={m.method || 'other'} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs">
                <c.icon className="h-3.5 w-3.5" /> {c.label}: <strong>{fCurrency(m.total)}</strong> ({m.count})
              </span>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Collection report: any day / week / month / custom range ─────────────────
export const CollectionReportTab = () => {
  const first = PRESETS[0].range()
  const [preset, setPreset]   = useState('today')
  const [from, setFrom]       = useState(first[0])
  const [to, setTo]           = useState(first[1])
  const [groupBy, setGroupBy] = useState('day')
  const [method, setMethod]   = useState('')
  const [classId, setClassId] = useState('')
  const [searchText, setSearchText] = useState('')
  const search = useDebouncedValue(searchText)
  const [page, setPage] = useState(1)

  const rangeInvalid = !from || !to || from > to
  const params = {
    from, to, group_by: groupBy,
    payment_method: method || undefined,
    class_setup_id: classId || undefined,
    search: search || undefined,
  }

  const { data: classes } = useQuery({
    queryKey: ['class-setups-all'],
    queryFn: () => classSetupsAPI.getAll({ limit: 100 }).then((r) => r.data.data),
  })
  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ['fee-collection-report', params],
    queryFn: () => api.get('/fees/collection-report', { params }).then((r) => r.data.data),
    enabled: !rangeInvalid,
  })
  const { data: list, isLoading: loadingList } = useQuery({
    queryKey: ['fee-collection-payments', params, page],
    queryFn: () => api.get('/fees/payments', { params: { ...params, page, limit: 15 } }).then((r) => r.data),
    enabled: !rangeInvalid,
  })

  const applyPreset = (p) => {
    const [f, t] = p.range()
    setFrom(f); setTo(t); setPreset(p.id); setGroupBy(p.id === 'year' ? 'month' : 'day'); setPage(1)
  }
  const setCustom = (f, t) => { setFrom(f); setTo(t); setPreset('custom'); setPage(1) }
  const drill = (key) => {
    if (groupBy === 'month') {
      const [y, m] = key.split('-').map(Number)
      setCustom(`${key}-01`, `${key}-${pad(new Date(y, m, 0).getDate())}`)
      setGroupBy('day')
    } else {
      setCustom(key, key)
    }
  }

  const rangeLabel = !from || !to ? '' : from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`
  const totals     = report?.totals || { total: 0, count: 0, average: 0 }
  const byMethod   = report?.by_method || []
  const byType     = report?.by_type || []
  const timeline   = report?.timeline || []
  const methodKeys = byMethod.map((m) => m.method || 'other')
  const payments   = list?.data || []
  const pagination = list?.pagination || {}

  const columns = [
    { header: 'Date & time', cell: (r) => (
      <div>
        <p className="text-sm">{fDateTime(r.paid_date)}</p>
        <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{r.receipt_no}</code>
      </div>
    ) },
    { header: 'Student', cell: (r) => {
      const s = r.fee_assign_id?.student_id
      return (
        <div className="flex items-center gap-2">
          <Avatar name={s?.user_id?.name || ''} size="sm" />
          <div>
            <p className="text-sm font-medium">{s?.user_id?.name || '—'}</p>
            <p className="text-xs text-muted-foreground">{s?.admission_no ? `Adm ${s.admission_no}` : ''}</p>
          </div>
        </div>
      )
    } },
    { header: 'Class', cell: (r) => {
      const c = r.fee_assign_id?.student_id?.class_setup_id
      return <p className="text-sm">{`${c?.class_id?.name || ''} ${c?.section_id?.name || ''}`.trim() || '—'}</p>
    } },
    { header: 'Fee', cell: (r) => <p className="text-sm">{r.fee_assign_id?.fee_master_id?.fee_type_id?.name || '—'}</p> },
    { header: 'Method', cell: (r) => {
      const showRef = r.payment_method !== 'cash' && r.transaction_id && !UUID_RE.test(r.transaction_id)
      return (
        <div className="space-y-1">
          <MethodBadge method={r.payment_method} />
          {showRef && <p className="max-w-40 truncate font-mono text-[10px] text-muted-foreground" title={r.transaction_id}>Ref: {r.transaction_id}</p>}
        </div>
      )
    } },
    { header: 'Type', cell: (r) => <TypeBadge type={r.payment_type} /> },
    { header: 'Amount', cell: (r) => <p className="text-sm font-bold text-emerald-600">{fCurrency(r.amount_paid)}</p> },
    { header: 'Received by', cell: (r) => (
      <p className="text-sm text-muted-foreground">
        {r.payment_method === 'online' ? 'Student (online)' : (r.collected_by?.name || '—')}
      </p>
    ) },
  ]

  return (
    <div className="space-y-5">
      {/* Range + filters */}
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p)}
                className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  preset === p.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70')}>
                {p.label}
              </button>
            ))}
            <span className={cn('rounded-lg px-3 py-1.5 text-xs font-medium', preset === 'custom' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
              Custom range
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setCustom(e.target.value, to)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setCustom(from, e.target.value)} />
            </div>
            <select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">All methods</option>
              {Object.entries(METHOD_CFG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
            </select>
            <select value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">All classes</option>
              {(classes || []).map((c) => <option key={c._id} value={c._id}>{c.class_id?.name} {c.section_id?.name}</option>)}
            </select>
            <div className="min-w-56 flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Student</label>
              <Input placeholder="Name, admission no, phone…" value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(1) }} />
            </div>
          </div>
          {rangeInvalid && <p className="text-xs text-destructive">Choose a valid range — the "From" date must be on or before the "To" date.</p>}
        </CardContent>
      </Card>

      {/* Totals */}
      <div>
        <p className="mb-2 text-sm text-muted-foreground">Showing collection for <strong className="text-foreground">{rangeLabel}</strong></p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Total collected',    value: fCurrency(totals.total),   color: 'text-emerald-600' },
            { label: 'Payments received',  value: totals.count,              color: 'text-primary' },
            { label: 'Average per payment', value: fCurrency(totals.average), color: 'text-amber-500' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn('mt-1 font-display text-2xl font-bold', s.color)}>{loadingReport ? '…' : s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* How it was paid */}
      {(byMethod.length > 0 || byType.length > 0) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>By payment method</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {byMethod.map((m) => {
                const share = totals.total > 0 ? (m.total / totals.total) * 100 : 0
                return (
                  <div key={m.method || 'other'}>
                    <div className="flex items-center justify-between text-sm">
                      <MethodBadge method={m.method} />
                      <span><strong>{fCurrency(m.total)}</strong> <span className="text-xs text-muted-foreground">· {m.count} payment{m.count !== 1 ? 's' : ''}</span></span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${share}%`, background: methodCfg(m.method).fill }} />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Full vs partial payments</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {byType.map((t) => (
                <div key={t.type} className="flex items-center justify-between text-sm">
                  <TypeBadge type={t.type} />
                  <span><strong>{fCurrency(t.total)}</strong> <span className="text-xs text-muted-foreground">· {t.count} payment{t.count !== 1 ? 's' : ''}</span></span>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">
                "Final instalment" is the payment that cleared what was left after earlier partial payments. Payments taken before this feature was added show as "Not recorded".
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Collection by {groupBy}</CardTitle>
            <div className="flex gap-1">
              {['day', 'month'].map((g) => (
                <button key={g} onClick={() => setGroupBy(g)}
                  className={cn('rounded-md px-2.5 py-1 text-xs font-medium', groupBy === g ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
                  By {g}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 || totals.count === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No payments in this period.</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="key" tickFormatter={(k) => shortKey(k, groupBy)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip labelFormatter={(k) => longKey(k, groupBy)} formatter={(v, name) => [fCurrency(v), name]}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {methodKeys.map((m) => (
                      <Bar key={m} dataKey={m} stackId="a" fill={methodCfg(m).fill} name={methodCfg(m).label} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto lg:col-span-2">
                <p className="mb-1 text-[11px] text-muted-foreground">Click a {groupBy} to see only its payments</p>
                {[...timeline].reverse().map((row) => {
                  const parts = methodKeys.filter((m) => row[m] > 0)
                  return (
                    <button key={row.key} onClick={() => drill(row.key)} disabled={row.count === 0}
                      className={cn('w-full rounded-lg border border-border px-3 py-2 text-left transition-colors',
                        row.count === 0 ? 'opacity-50' : 'hover:bg-muted/50')}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{longKey(row.key, groupBy)}</span>
                        <span className={cn('font-bold', row.count ? 'text-emerald-600' : 'text-muted-foreground')}>{fCurrency(row.total)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {row.count} payment{row.count !== 1 ? 's' : ''}
                        {parts.length > 0 && ` · ${parts.map((m) => `${methodCfg(m).label} ${fCurrency(row[m])}`).join(' · ')}`}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Every payment in the range */}
      <Card>
        <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={payments}
            total={pagination.total}
            page={pagination.page}
            pages={pagination.pages}
            limit={pagination.limit}
            isLoading={loadingList}
            onPageChange={setPage}
            emptyIcon={Wallet}
            emptyTitle="No payments in this period"
            emptyDescription="Try a wider date range or clear the filters"
          />
        </CardContent>
      </Card>
    </div>
  )
}
