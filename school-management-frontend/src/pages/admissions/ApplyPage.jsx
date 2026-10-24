import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, School, User, Users, BookOpen, ChevronRight, Loader2 } from 'lucide-react'
import api from '@/api/axios'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/Button'
import { Input, Label, Card, CardContent } from '@/components/ui/index.jsx'

// ─── Step indicator ───────────────────────────────────────────────────────────
const Steps = ({ current }) => {
  const steps = [
    { label: 'Select School', icon: School },
    { label: 'Student Info',  icon: User   },
    { label: 'Parent Info',   icon: Users  },
    { label: 'Academic',      icon: BookOpen },
  ]
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center">
          <div className={cn(
            'flex flex-col items-center',
          )}>
            <div className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all',
              i < current  ? 'bg-primary border-primary text-white' :
              i === current? 'border-primary text-primary bg-primary/10' :
                             'border-muted text-muted-foreground bg-background'
            )}>
              {i < current
                ? <CheckCircle2 className="h-5 w-5" />
                : <s.icon className="h-4 w-4" />
              }
            </div>
            <span className={cn(
              'text-[10px] mt-1 font-medium hidden sm:block',
              i === current ? 'text-primary' : 'text-muted-foreground'
            )}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn('h-0.5 w-8 sm:w-16 mx-1 transition-all', i < current ? 'bg-primary' : 'bg-muted')} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Success Screen ───────────────────────────────────────────────────────────
const SuccessScreen = ({ studentName, schoolName }) => (
  <div className="text-center py-8 space-y-4 animate-fade-in">
    <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
      <CheckCircle2 className="h-10 w-10 text-emerald-600" />
    </div>
    <h2 className="font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400">
      Application Submitted!
    </h2>
    <p className="text-muted-foreground max-w-sm mx-auto">
      Thank you <strong>{studentName}</strong>! Your admission application to <strong>{schoolName}</strong> has been received.
    </p>
    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 max-w-sm mx-auto text-left">
      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">What happens next?</p>
      <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
        <li>✓ School admin will review your application</li>
        <li>✓ You will receive an email with your login credentials</li>
        <li>✓ Login to the student portal to track your status</li>
      </ul>
    </div>
    <a href="/login"
      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
      Go to Login <ChevronRight className="h-4 w-4" />
    </a>
  </div>
)

// ─── Main Apply Page ──────────────────────────────────────────────────────────
export const ApplyPage = () => {
  const [step, setStep]           = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState(null)
  const [formData, setFormData]   = useState({})

  const { data: schools, isLoading: loadingSchools } = useQuery({
    queryKey: ['public-schools'],
    queryFn:  () => api.get('/admissions/schools').then(r => r.data.data),
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm()

  const mutation = useMutation({
    mutationFn: (data) => api.post('/admissions/apply', data),
    onSuccess:  () => setSubmitted(true),
    onError:    (e) => alert(e.response?.data?.message || 'Submission failed. Please try again.'),
  })

  const nextStep = (data) => {
    setFormData(prev => ({ ...prev, ...data }))
    setStep(s => s + 1)
  }

  const handleFinalSubmit = (data) => {
    const payload = {
      ...formData,
      ...data,
      school_id: selectedSchool?._id,
    }
    mutation.mutate(payload)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5">
      {/* Header */}
      <div className="bg-primary text-white py-5 px-4 text-center">
        <h1 className="font-display text-2xl font-bold">EduCore</h1>
        <p className="text-white/70 text-sm mt-1">Online Admission Portal</p>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8">
        {submitted ? (
          <Card>
            <CardContent className="pt-6">
              <SuccessScreen studentName={formData.student_name} schoolName={selectedSchool?.name} />
            </CardContent>
          </Card>
        ) : (
          <>
            <Steps current={step} />

            <Card>
              <CardContent className="pt-6">
                {/* Step 0 — Select School */}
                {step === 0 && (
                  <div className="space-y-4 animate-fade-in">
                    <h2 className="font-display text-xl font-bold">Select School</h2>
                    <p className="text-sm text-muted-foreground">Choose the school you want to apply to</p>
                    {loadingSchools ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {(schools || []).map(school => (
                          <button key={school._id} type="button"
                            onClick={() => setSelectedSchool(school)}
                            className={cn(
                              'w-full p-4 rounded-xl border-2 text-left transition-all',
                              selectedSchool?._id === school._id
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/40'
                            )}>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <School className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{school.name}</p>
                                <p className="text-xs text-muted-foreground">{school.address}</p>
                              </div>
                              {selectedSchool?._id === school._id && (
                                <CheckCircle2 className="h-5 w-5 text-primary ml-auto" />
                              )}
                            </div>
                          </button>
                        ))}
                        {!schools?.length && (
                          <p className="text-center text-muted-foreground py-8">No schools available</p>
                        )}
                      </div>
                    )}
                    <Button className="w-full" disabled={!selectedSchool}
                      onClick={() => setStep(1)}>
                      Continue <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Step 1 — Student Info */}
                {step === 1 && (
                  <form onSubmit={handleSubmit(nextStep)} className="space-y-4 animate-fade-in">
                    <h2 className="font-display text-xl font-bold">Student Information</h2>
                    <p className="text-sm text-muted-foreground">Applying to: <strong>{selectedSchool?.name}</strong></p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 col-span-2">
                        <Label>Full Name *</Label>
                        <Input placeholder="Student's full name"
                          {...register('student_name', { required: 'Required' })} />
                        {errors.student_name && <p className="text-xs text-destructive">{errors.student_name.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Date of Birth *</Label>
                        <Input type="date"
                          {...register('dob', { required: 'Required' })} />
                        {errors.dob && <p className="text-xs text-destructive">{errors.dob.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Gender *</Label>
                        <select {...register('gender', { required: 'Required' })}
                          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                          <option value="">Select</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                        {errors.gender && <p className="text-xs text-destructive">{errors.gender.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Blood Group</Label>
                        <select {...register('blood_group')}
                          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                          <option value="">Select</option>
                          {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => (
                            <option key={bg} value={bg}>{bg}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Religion</Label>
                        <Input placeholder="Religion" {...register('religion')} />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label>Address</Label>
                        <Input placeholder="Full address" {...register('address')} />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
                      <Button type="submit" className="flex-1">Continue <ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </form>
                )}

                {/* Step 2 — Parent/Guardian Info */}
                {step === 2 && (
                  <form onSubmit={handleSubmit(nextStep)} className="space-y-4 animate-fade-in">
                    <h2 className="font-display text-xl font-bold">Parent / Guardian Info</h2>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Father's Name</Label>
                        <Input placeholder="Father's full name" {...register('father_name')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Father's Phone</Label>
                        <Input placeholder="+91 XXXXX XXXXX" {...register('father_phone')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Mother's Name</Label>
                        <Input placeholder="Mother's full name" {...register('mother_name')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Mother's Phone</Label>
                        <Input placeholder="+91 XXXXX XXXXX" {...register('mother_phone')} />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label>Guardian Email * <span className="text-muted-foreground font-normal">(used for login)</span></Label>
                        <Input type="email" placeholder="guardian@example.com"
                          {...register('guardian_email', {
                            required: 'Email is required',
                            pattern:  { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' }
                          })} />
                        {errors.guardian_email && <p className="text-xs text-destructive">{errors.guardian_email.message}</p>}
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label>Guardian Phone</Label>
                        <Input placeholder="+91 XXXXX XXXXX" {...register('guardian_phone')} />
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        ⚠️ Login credentials will be sent to the guardian email after approval.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                      <Button type="submit" className="flex-1">Continue <ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </form>
                )}

                {/* Step 3 — Academic Info */}
                {step === 3 && (
                  <form onSubmit={handleSubmit(handleFinalSubmit)} className="space-y-4 animate-fade-in">
                    <h2 className="font-display text-xl font-bold">Academic Information</h2>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 col-span-2">
                        <Label>Class Applying For *</Label>
                        <Input placeholder="e.g. Class 6, Grade 10"
                          {...register('class_applying_for', { required: 'Required' })} />
                        {errors.class_applying_for && <p className="text-xs text-destructive">{errors.class_applying_for.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Previous School</Label>
                        <Input placeholder="Previous school name" {...register('previous_school')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Previous Class</Label>
                        <Input placeholder="e.g. Class 5" {...register('previous_class')} />
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Application Summary</p>
                      {[
                        { label: 'School',    value: selectedSchool?.name },
                        { label: 'Student',   value: formData.student_name },
                        { label: 'Gender',    value: formData.gender },
                        { label: 'Email',     value: formData.guardian_email },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-medium capitalize">{item.value || '—'}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                      <Button type="submit" loading={mutation.isPending} className="flex-1">
                        Submit Application
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}