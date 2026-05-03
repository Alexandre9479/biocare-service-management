import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Stethoscope, Phone, Mail, Wrench } from 'lucide-react'
import supabase from '@/lib/supabase'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { getAvailabilityClasses, getAvailabilityLabel } from '@/utils/helpers'
import type { Profile } from '@/types'

export default function EngineerList() {
  const { data: engineers, isLoading } = useQuery({
    queryKey: ['engineers-full'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'engineer')
        .order('availability_status')
        .order('name')
      return data as Profile[]
    },
  })

  const { data: assignmentCounts } = useQuery({
    queryKey: ['engineer-assignment-counts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('service_assignments')
        .select('engineer_id')
        .in('status', ['scheduled', 'in_progress'])
      const counts: Record<string, number> = {}
      data?.forEach(a => {
        if (a.engineer_id) counts[a.engineer_id] = (counts[a.engineer_id] ?? 0) + 1
      })
      return counts
    },
  })

  if (isLoading) return <PageSpinner />

  const available = engineers?.filter(e => e.availability_status === 'available') ?? []
  const unavailable = engineers?.filter(e => e.availability_status !== 'available') ?? []

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Engineers</h1>
        <p className="text-slate-500 text-sm">{engineers?.length ?? 0} engineers • {available.length} available</p>
      </div>

      {!engineers?.length ? (
        <EmptyState icon={<Stethoscope size={28} />} title="No engineers" description="Add engineers via User Management." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {engineers.map(eng => {
            const activeCount = assignmentCounts?.[eng.id] ?? 0
            return (
              <div key={eng.id} className="card p-5 card-hover">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-biocare-purple-500/20 border border-biocare-purple-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-biocare-purple-300">{eng.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{eng.name}</p>
                    <span className={`badge text-xs mt-1 ${getAvailabilityClasses(eng.availability_status)}`}>
                      {getAvailabilityLabel(eng.availability_status)}
                    </span>
                  </div>
                </div>

                {eng.specializations?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {eng.specializations.map(s => (
                      <span key={s} className="badge bg-biocare-cyan-500/10 text-biocare-cyan-400 border border-biocare-cyan-500/20 text-xs">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5 text-xs text-slate-500">
                  {eng.email && (
                    <a href={`mailto:${eng.email}`} className="flex items-center gap-2 hover:text-biocare-cyan-400 transition-colors">
                      <Mail size={12} /> {eng.email}
                    </a>
                  )}
                  {eng.phone && (
                    <a href={`tel:${eng.phone}`} className="flex items-center gap-2 hover:text-biocare-cyan-400 transition-colors">
                      <Phone size={12} /> {eng.phone}
                    </a>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Wrench size={12} />
                    <span>{activeCount} active assignment{activeCount !== 1 ? 's' : ''}</span>
                  </div>
                  {activeCount > 0 && (
                    <span className="badge bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs">
                      Busy
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
