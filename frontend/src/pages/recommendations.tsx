import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { getRecommendations } from '@/lib/api'
import { Recommendation } from '@/lib/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function Recommendations() {
  const { user } = useAuth()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      getRecommendations(user.id)
        .then(data => {
          setRecommendations(data || [])
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
        })
    }
  }, [user])

  if (loading) return <div>Loading Recommendations...</div>

  if (recommendations.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-4 text-center">
        <h2 className="text-2xl font-bold mb-4">No recommendations found.</h2>
        <p className="text-muted-foreground">Try adding more skills to your profile or wait for more jobs to be scraped.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-6">⭐ Personalized Job Recommendations</h1>
      <div className="grid gap-4">
        {recommendations.map((rec, idx) => (
          <Card key={idx} className="hover:border-primary transition-colors">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl mb-1">{rec.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    🏢 <strong>{rec.company}</strong> &nbsp;|&nbsp; 📍 {rec.job?.location || 'N/A'} &nbsp;|&nbsp; 🌐 {rec.source}
                  </p>
                </div>
                <div>
                   <Badge 
                    className="text-sm px-3 py-1"
                    variant={rec.match_score >= 70 ? 'default' : (rec.match_score >= 40 ? 'secondary' : 'destructive')}
                   >
                     {rec.match_score.toFixed(0)}% Match
                   </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rec.matched_skills?.length > 0 && (
                <div className="mb-2">
                  <strong className="text-sm">✅ Matched: </strong>
                  {rec.matched_skills.map(s => <Badge key={s} variant="outline" className="mr-1 border-green-500 text-green-700 bg-green-50">{s}</Badge>)}
                </div>
              )}
              {rec.missing_skills?.length > 0 && (
                <div>
                  <strong className="text-sm">📚 To Learn: </strong>
                  {rec.missing_skills.slice(0, 5).map(s => <Badge key={s} variant="outline" className="mr-1 text-slate-500">{s}</Badge>)}
                </div>
              )}
              <div className="mt-4">
                <a href={rec.url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm font-medium">
                  View Offer →
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
