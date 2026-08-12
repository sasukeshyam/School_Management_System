import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Trash2, Loader2 } from 'lucide-react'
import api from '@/api/axios'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/hooks/useToast'
import { cn } from '@/utils/cn'

const SIZES = {
  sm:    'h-10 w-10 text-sm',
  md:    'h-16 w-16 text-xl',
  lg:    'h-24 w-24 text-3xl',
  xl:    'h-32 w-32 text-4xl',
  '2xl': 'h-40 w-40 text-5xl',
}

export const AvatarUpload = ({ size = 'xl', onUpdate, readOnly = false, currentAvatar, userName }) => {
  const fileRef  = useRef(null)
  const user     = useAuthStore(s => s.user)
  const qc       = useQueryClient()
  const [preview, setPreview] = useState(null)

  const avatar   = preview || currentAvatar || user?.avatar
  const initials = (userName || user?.name || 'U')
    .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  // Update avatar in authStore
  const updateStoreAvatar = (newAvatar) => {
    const store = useAuthStore.getState()
    store.setAuth({
      user:         { ...store.user, avatar: newAvatar },
      access_token: store.accessToken,
      roles:        store.roles,
      schoolId:     store.schoolId,
    })
  }

  const uploadMutation = useMutation({
    mutationFn: (file) => {
      const form = new FormData()
      form.append('avatar', file)
      return api.post('/users/avatar/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: ({ data }) => {
      const newAvatar = data.data?.avatar
      setPreview(newAvatar)
      updateStoreAvatar(newAvatar)
      qc.invalidateQueries(['me'])
      toast.success('Profile picture updated!')
      onUpdate?.(newAvatar)
    },
    onError: (e) => {
      setPreview(null)
      toast.error(e.response?.data?.message || 'Upload failed — check Cloudinary credentials')
    },
  })

  const removeMutation = useMutation({
    mutationFn: () => api.delete('/users/avatar/remove'),
    onSuccess: () => {
      setPreview(null)
      updateStoreAvatar(null)
      qc.invalidateQueries(['me'])
      toast.success('Profile picture removed')
      onUpdate?.(null)
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to remove'),
  })

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG, PNG or WEBP files allowed')
      return
    }
    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB')
      return
    }

    // Show instant preview before upload
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result)
    reader.readAsDataURL(file)

    uploadMutation.mutate(file)
    // Reset input so same file can be picked again
    e.target.value = ''
  }

  const isLoading = uploadMutation.isPending || removeMutation.isPending

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar circle */}
      <div className={cn(
        'relative rounded-full overflow-hidden bg-primary/10 border-4 border-background shadow-lg flex items-center justify-center shrink-0',
        SIZES[size]
      )}>
        {avatar ? (
          <img src={avatar} alt={initials} className="h-full w-full object-cover" />
        ) : (
          <span className="font-bold text-primary select-none">{initials}</span>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}

        {/* Hover overlay to trigger upload */}
        {!readOnly && !isLoading && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-full"
          >
            <Camera className="h-5 w-5 text-white" />
            <span className="text-[10px] text-white mt-1">Change</span>
          </button>
        )}
      </div>

      {/* Action buttons */}
      {!readOnly && (
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5" />
            {avatar ? 'Change Photo' : 'Upload Photo'}
          </button>

          {avatar && (
            <button
              type="button"
              onClick={() => removeMutation.mutate()}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">JPG, PNG or WEBP · Max 5MB</p>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}
