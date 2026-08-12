import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, AlertCircle, XCircle, Clock, CreditCard,
  Download, Receipt, TrendingUp, DollarSign, ChevronDown, ChevronUp,
  RefreshCw
} from 'lucide-react'
import { feesAPI } from '@/api'
import { Card, CardContent, CardHeader, CardTitle, Badge, Spinner } from '@/components/ui/index.jsx'
import { Button } from '@/components/ui/Button'
import { fCurrency, fDate, fDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { toast } from '@/hooks/useToast'

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  unpaid:  { color: 'bg-red-100 text-red-700 dark:bg-red-900/30',      icon: XCircle,      label: 'Unpaid',   border: 'border-red-200 dark:border-red-800'    },
  partial: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30', icon: AlertCircle,  label: 'Partial',  border: 'border-amber-200 dark:border-amber-800' },
  paid:    { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30', icon: CheckCircle2, label: 'Paid', border: 'border-emerald-200 dark:border-emerald-800' },
  overdue: { color: 'bg-red-200 text-red-800 dark:bg-red-900/50',       icon: AlertCircle,  label: 'Overdue',  border: 'border-red-300 dark:border-red-700'     },
}

// ─── Load Razorpay script ─────────────────────────────────────────────────────
const loadRazorpay = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true)
  const script = document.createElement('script')
  script.src = 'https://checkout.razorpay.com/v1/checkout.js'
  script.onload  = () => resolve(true)
  script.onerror = () => resolve(false)
  document.body.appendChild(script)
})

// ─── Razorpay Payment Handler ─────────────────────────────────────────────────
const handleRazorpayPayment = async ({ assign, amount, onSuccess, onError }) => {
  const loaded = await loadRazorpay()
  if (!loaded) { toast.error('Payment gateway failed to load'); return }

  try {
    // Create order
    const orderRes = await feesAPI.createOrder({
      fee_assign_id: assign._id,
      amount:        amount,
    })
    const { order_id, key_id, student_name } = orderRes.data.data

    const options = {
      key:         key_id,
      amount:      Math.round(amount * 100), // paise
      currency:    'INR',
      name:        'EduCore School',
      description: assign.fee_master_id?.fee_type_id?.name || 'Fee Payment',
      order_id,
      prefill:     { name: student_name },
      theme:       { color: '#4f46e5' },
      handler: async (response) => {
        try {
          await feesAPI.verifyPayment({
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
            fee_assign_id:       assign._id,
            amount_paid:         Math.round(amount * 100),
          })
          toast.success('Payment successful!')
          onSuccess?.()
        } catch (err) {
          toast.error('Payment verification failed')
          onError?.()
        }
      },
      modal: { ondismiss: () => toast.info('Payment cancelled') },
    }

    const rzp = new window.Razorpay(options)
    rzp.on('payment.failed', () => { toast.error('Payment failed'); onError?.() })
    rzp.open()
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to initiate payment')
    onError?.()
  }
}

// ─── Fee Invoice Card ─────────────────────────────────────────────────────────
const FeeCard = ({ fee, onPaySuccess }) => {
  const [expanded, setExpanded]     = useState(false)
  const [paying, setPaying]         = useState(false)
  const qc = useQueryClient()

  const cfg       = STATUS_CFG[fee.status] || STATUS_CFG.unpaid
  const StatusIcon= cfg.icon
  const netAmount = fee.net_amount || fee.amount
  const balance   = fee.balance || 0
  const paid      = fee.total_paid || 0
  const pct       = netAmount > 0 ? Math.min(100, (paid / netAmount) * 100) : 0
  const isOverdue = fee.due_date && new Date(fee.due_date) < new Date() && fee.status !== 'paid'

  const handlePay = async (amount) => {
    setPaying(true)
    await handleRazorpayPayment({
      assign: fee,
      amount,
      onSuccess: () => {
        setPaying(false)
        setShowPay(false)
        setPayAmount('')
        qc.invalidateQueries(['student-my-fees'])
        onPaySuccess?.()
      },
      onError: () => setPaying(false),
    })
  }

  const downloadReceipt = async (paymentId) => {
    try {
      const res = await feesAPI.getReceipt(paymentId)
      const w   = window.open('', '_blank')
      w.document.write(res.data)
      w.document.close()
      w.print()
    } catch { toast.error('Receipt not available') }
  }

  return (
    <Card className={cn('overflow-hidden border-2 transition-all', cfg.border, isOverdue && 'border-red-400 dark:border-red-600')}>
      <CardContent className="pt-4 pb-0">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3">
            <div className={cn('p-2 rounded-xl shrink-0', cfg.color)}>
              <StatusIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{fee.fee_master_id?.fee_type_id?.name || 'Fee'}</p>
              <p className="text-xs text-muted-foreground">{fee.fee_master_id?.fee_group_id?.name}</p>
              {fee.due_date && (
                <p className={cn('text-xs mt-0.5', isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                  {isOverdue ? '⚠ Overdue: ' : 'Due: '}{fDate(fee.due_date)}
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-right">
            <p className="text-xl font-bold font-display">{fCurrency(netAmount)}</p>
            {fee.carry_forward > 0 && (
              <p className="text-[10px] text-amber-500">incl. ₹{fee.carry_forward} b/f</p>
            )}
          </div>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {fee.status !== 'unpaid' && netAmount > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Paid: <strong className="text-emerald-600">{fCurrency(paid)}</strong></span>
              <span className="text-muted-foreground">Balance: <strong className="text-red-500">{fCurrency(balance)}</strong></span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-500', pct >= 100 ? 'bg-emerald-500' : 'bg-primary')}
                style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{pct.toFixed(0)}% paid</p>
          </div>
        )}

        {/* Carry forward badge */}
        {fee.carry_forward > 0 && (
          <div className="mb-2 flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Includes <strong>{fCurrency(fee.carry_forward)}</strong> carried forward from previous period
            </p>
          </div>
        )}

        {/* Label / installment note */}
        {fee.label && (
          <div className="mb-2">
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{fee.label}</span>
          </div>
        )}

        {/* Discount badge */}
        {fee.discount > 0 && (
          <div className="mb-2 flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Discount: <strong>{fCurrency(fee.discount)}</strong>
            </p>
          </div>
        )}

        {/* Fine badge */}
        {fee.fine > 0 && (
          <div className="mb-2 flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
            <p className="text-xs text-red-700 dark:text-red-400">
              Late fee: <strong>{fCurrency(fee.fine)}</strong>
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pb-4 flex-wrap">
          {/* Pay button — student pays exact balance assigned by admin */}
          {fee.status !== 'paid' && balance > 0 && (
            <div className="flex-1">
              <Button size="sm" className="w-full" onClick={() => handlePay(balance)} loading={paying}>
                <CreditCard className="h-3.5 w-3.5" />
                Pay {fCurrency(balance)}
              </Button>
            </div>
          )}

          {/* Expand/collapse */}
          {fee.payments?.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded(v => !v)}
              className="text-xs text-muted-foreground">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {fee.payments.length} payment{fee.payments.length !== 1 ? 's' : ''}
            </Button>
          )}
        </div>

        {/* Payment history expanded */}
        {expanded && fee.payments?.length > 0 && (
          <div className="border-t border-border pt-3 pb-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment History</p>
            {fee.payments.map((p, i) => (
              <div key={p._id || i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">{p.receipt_no}</p>
                    <p className="text-[10px] text-muted-foreground">{fDateTime(p.paid_date)} · {p.payment_method}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-emerald-600">{fCurrency(p.amount_paid)}</p>
                  <button onClick={() => downloadReceipt(p._id)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main FeeTab ──────────────────────────────────────────────────────────────
export const FeeTab = () => {
  const [statusFilter, setStatus] = useState('')
  const [activeView,  setView]    = useState('fees') // fees | history
  const qc = useQueryClient()

  const { data: feeResult, isLoading, refetch } = useQuery({
    queryKey: ['student-my-fees', statusFilter],
    queryFn:  () => feesAPI.myFees({ status: statusFilter || undefined, limit: 50 }).then(r => r.data.data),
    staleTime:          0,
    refetchOnWindowFocus: true,
    refetchInterval:    30000,
  })

  const { data: histResult, isLoading: loadingHist } = useQuery({
    queryKey: ['student-my-payments'],
    queryFn:  () => feesAPI.myPayments({ limit: 50 }).then(r => r.data.data),
    enabled:  activeView === 'history',
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const fees    = feeResult?.data    || []
  const summary = feeResult?.summary || { total_amount: 0, total_paid: 0, balance: 0, net_total: 0 }
  const history = histResult?.data   || []

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">Loading your fees...</p>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Summary hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-5 text-white">
        <p className="text-white/70 text-sm mb-3">Fee Summary</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Fees',   value: fCurrency(summary.net_total || summary.total_amount), highlight: false },
            { label: 'Paid',         value: fCurrency(summary.total_paid),   highlight: false  },
            { label: 'Balance Due',  value: fCurrency(summary.balance),      highlight: true   },
          ].map(s => (
            <div key={s.label} className={cn('p-3 rounded-xl text-center', s.highlight ? 'bg-red-500/30' : 'bg-white/10')}>
              <p className="text-lg font-bold font-display">{s.value}</p>
              <p className="text-xs text-white/70 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Overall progress */}
        {summary.net_total > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>Payment Progress</span>
              <span>{((summary.total_paid / summary.net_total) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all"
                style={{ width: `${Math.min(100, (summary.total_paid / summary.net_total) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Alert for overdue */}
      {fees.some(f => f.status === 'overdue' || (f.due_date && new Date(f.due_date) < new Date() && f.status !== 'paid')) && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">You have overdue fees</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Please clear your outstanding dues to avoid late fees.</p>
          </div>
        </div>
      )}

      {/* View switcher */}
      <div className="flex gap-2 items-center">
        {[{ id: 'fees', label: 'My Invoices' }, { id: 'history', label: 'Payment History' }].map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              activeView === v.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}>{v.label}</button>
        ))}
        <button onClick={() => refetch()}
          className="ml-auto p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh fees">
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </button>

        {/* Status filter */}
        {activeView === 'fees' && (
          <select value={statusFilter} onChange={e => setStatus(e.target.value)}
            className="ml-auto h-8 rounded-lg border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">All</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        )}
      </div>

      {/* Invoices list */}
      {activeView === 'fees' && (
        <>
          {fees.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="p-3 rounded-xl bg-muted"><DollarSign className="h-8 w-8 text-muted-foreground" /></div>
              <p className="font-medium">No fees assigned</p>
              <p className="text-sm text-muted-foreground">No fees have been assigned to you yet</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {fees.map(fee => (
                <FeeCard key={fee._id} fee={fee} onPaySuccess={() => refetch()} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Payment history */}
      {activeView === 'history' && (
        <>
          {loadingHist ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : history.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="p-3 rounded-xl bg-muted"><Receipt className="h-8 w-8 text-muted-foreground" /></div>
              <p className="font-medium">No payments yet</p>
              <p className="text-sm text-muted-foreground">Your payment history will appear here</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {history.map(p => {
                const assign = p.fee_assign_id
                return (
                  <Card key={p._id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{assign?.fee_master_id?.fee_type_id?.name || 'Payment'}</p>
                            <p className="text-xs text-muted-foreground">{assign?.fee_master_id?.fee_group_id?.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{p.receipt_no}</code>
                              <p className="text-[10px] text-muted-foreground">{fDateTime(p.paid_date)}</p>
                              <p className="text-[10px] capitalize text-muted-foreground">{p.payment_method}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2 shrink-0">
                          <div>
                            <p className="text-base font-bold text-emerald-600">{fCurrency(p.amount_paid)}</p>
                            <p className="text-[10px] text-emerald-600 uppercase font-semibold">Paid</p>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const res = await feesAPI.getReceipt(p._id)
                                const w   = window.open('', '_blank')
                                w.document.write(res.data)
                                w.document.close()
                                w.print()
                              } catch { toast.error('Receipt not available') }
                            }}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
