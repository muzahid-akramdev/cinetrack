'use client'

import { useState, useTransition } from 'react'
import { UserPlus, UserCheck } from 'lucide-react'
import { toggleFollow } from '@/lib/actions'

export function FollowButton({ profileId, initialFollowing, path }: { profileId: string; initialFollowing: boolean; path: string }) {
  const [following, setFollowing] = useState(initialFollowing)
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleFollow({ profileId, path })
          setFollowing(result.following)
        })
      }
      className="btn-ghost flex items-center gap-2 border border-line dark:border-lineDark"
    >
      {following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
