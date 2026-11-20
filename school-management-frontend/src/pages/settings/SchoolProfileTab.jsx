import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Trash2, Save, School, Loader2 } from 'lucide-react'
import api from '@/api/axios'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from '@/components/ui/index.jsx'
import { toast } from '@/hooks/useToast'

const FIELDS = ['name', 'tagline', 'address', 'phone', 'email', 'website', 'established_year', 'registration_no']
const toForm = (s) => Object.fromEntries(FIELDS.map((k) => [k, s?.[k] ?? '']))

export const SchoolProfileTab = () => {
  const qc      = useQueryClient()
  const fileRef = useRef(null)
  const [logoBusy, setLogoBusy] = useState(false)

  const { data: school, isLoading } = useQuery({
    queryKey: ['school-profile'],
    queryFn:  () => api.get('/schools/me').then((r) => r.data.data),
  })

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({ defaultValues: toForm(null) })
  useEffect(() => { if (school) reset(toForm(school)) }, [school, reset])
  const live = watch()

  const save = useMutation({
    mutationFn: (d) => api.put('/schools/me', d),
    onSuccess: () => { toast.success('School profile saved'); qc.invalidateQueries(['school-profile']) },
    onError:   (e) => toast.error(e.response?.data?.message || 'Could not save'),
  })

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) return toast.error('Logo must be a JPG, PNG or WEBP image')
    if (file.size > 2 * 1024 * 1024) return toast.error('Logo must be 2 MB or smaller')
    setLogoBusy(true)
    try {
      const form = new FormData()
      form.append('logo', file)
      await api.post('/schools/me/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Logo updated')
      qc.invalidateQueries(['school-profile'])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Logo upload failed')
    } finally {
      setLogoBusy(false)
    }
  }

  const removeLogo = async () => {
    setLogoBusy(true)
    try {
      await api.delete('/schools/me/logo')
      toast.success('Logo removed')
      qc.invalidateQueries(['school-profile'])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove the logo')
    } finally {
      setLogoBusy(false)
    }
  }

  if (isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading school profile…</p>

  const headerLine = [
    live.established_year && `Estd : ${live.established_year}`,
    live.phone && `Mob. : ${live.phone}`,
  ].filter(Boolean).join('     ')

  return (
    <div className="space-y-5">
      {/* Logo */}
      <Card>
        <CardHeader><CardTitle>School logo</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
              {school?.logo
                ? <img src={school.logo} alt="School logo" className="h-full w-full object-contain" />
                : <School className="h-8 w-8 text-muted-foreground" />}
              {logoBusy && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={logoBusy} onClick={() => fileRef.current?.click()}>
                  <Camera className="h-4 w-4" /> {school?.logo ? 'Change logo' : 'Upload logo'}
                </Button>
                {school?.logo && (
                  <Button type="button" variant="outline" size="sm" disabled={logoBusy} onClick={removeLogo}
                    className="border-destructive/40 text-destructive">
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG or WEBP, up to 2 MB. A square logo on a plain or transparent background prints best.</p>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadLogo} className="hidden" />
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>School details printed on receipts</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>School name *</Label>
                <Input placeholder="e.g. Kiddozone School" {...register('name', { required: 'School name is required' })} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Tagline <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input placeholder="e.g. Where dreams begin" {...register('tagline')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Textarea rows={2} placeholder="Village / town, post office, district" {...register('address')} />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile number <span className="font-normal text-muted-foreground">(printed as “Mob.”)</span></Label>
                <Input placeholder="+91 XXXXX XXXXX" {...register('phone')} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="school@example.com" {...register('email')} />
              </div>
              <div className="space-y-1.5">
                <Label>Established year <span className="font-normal text-muted-foreground">(printed as “Estd”)</span></Label>
                <Input type="number" placeholder="e.g. 2021"
                  {...register('established_year', { min: { value: 1800, message: 'Enter a valid year' }, max: { value: new Date().getFullYear() + 1, message: 'Enter a valid year' } })} />
                {errors.established_year && <p className="text-xs text-destructive">{errors.established_year.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Registration number <span className="font-normal text-muted-foreground">(printed as “Regd. No.”)</span></Label>
                <Input placeholder="e.g. S0034637" {...register('registration_no')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Website <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input placeholder="https://" {...register('website')} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview of the printed header */}
        <Card>
          <CardHeader><CardTitle>Receipt header preview</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-xl border border-dashed border-border p-4">
              <div className="flex items-center gap-3">
                {school?.logo
                  ? <img src={school.logo} alt="" className="h-14 w-14 shrink-0 object-contain" />
                  : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted"><School className="h-6 w-6 text-muted-foreground" /></div>}
                <div className="min-w-0">
                  <p className="font-display text-xl font-extrabold uppercase leading-tight">{live.name || 'School name'}</p>
                  {headerLine && <p className="text-xs">{headerLine}</p>}
                  {live.address && <p className="text-xs">{live.address}</p>}
                  {live.registration_no && <p className="text-xs">Regd. No. - {live.registration_no}</p>}
                  {live.tagline && <p className="text-[11px] italic text-muted-foreground">{live.tagline}</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending}><Save className="h-4 w-4" /> Save school profile</Button>
        </div>
      </form>
    </div>
  )
}
