import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { getProfile, saveProfile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Profile() {
  const { user } = useAuth()
  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      getProfile(user.id)
        .then(data => {
          setSkills(data || [])
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
        })
    }
  }, [user])

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSkill.trim()) return
    const s = newSkill.trim().toLowerCase()
    if (!skills.includes(s)) {
      setSkills([...skills, s])
    }
    setNewSkill('')
  }

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill))
  }

  const handleSave = async () => {
    if (!user) return
    try {
      await saveProfile(user.id, user.email || 'Student', skills)
      toast({ title: "Profile Saved", description: "Your skills have been updated successfully." })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  if (loading) return <div>Loading Profile...</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Skill Profile</CardTitle>
          <CardDescription>Add the technical and soft skills you possess to get personalized job recommendations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddSkill} className="flex gap-2">
            <Input 
              value={newSkill} 
              onChange={e => setNewSkill(e.target.value)} 
              placeholder="e.g. Python, SQL, React..." 
            />
            <Button type="submit">Add Skill</Button>
          </form>

          <div className="flex flex-wrap gap-2 p-4 border rounded-md min-h-[100px] bg-slate-50">
            {skills.length === 0 ? (
              <p className="text-muted-foreground w-full text-center">No skills added yet.</p>
            ) : (
              skills.map(skill => (
                <Badge key={skill} variant="secondary" className="text-sm py-1 px-3 flex items-center gap-1">
                  {skill}
                  <button onClick={() => handleRemoveSkill(skill)} className="hover:text-destructive">
                    <X size={14} />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <Button onClick={handleSave} className="w-full">Save Profile</Button>
        </CardContent>
      </Card>
    </div>
  )
}
