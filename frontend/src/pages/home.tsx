import { motion } from 'framer-motion'
import { ArrowRight, Briefcase, Zap, Globe } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto space-y-12 py-8 relative">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass-card p-12 rounded-3xl text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 mb-6 drop-shadow-sm">
          Job Offers Analyzer & Recommender
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
          Moroccan job market intelligence powered by NLP and AI. Discover the jobs that directly match your unique skills seamlessly.
        </p>
        
        <div className="mt-8">
          <Link to="/login">
            <Button size="lg" className="rounded-full px-8 py-6 text-lg font-medium shadow-primary/30 shadow-lg hover:shadow-primary/50 transition-all">
              Get Started <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { title: "Live Jobs Scraped", icon: Briefcase, color: "text-blue-500" },
          { title: "NLP Analyzed", icon: Zap, color: "text-amber-500" },
          { title: "6 Integrated Platforms", icon: Globe, color: "text-emerald-500" }
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 + (i * 0.1) }}
            whileHover={{ scale: 1.05 }}
            className="glass-card p-8 rounded-2xl text-center group cursor-default relative overflow-hidden"
          >
            <div className={`absolute top-0 left-0 w-1 h-full opacity-50 group-hover:opacity-100 transition-opacity ${stat.color.replace('text', 'bg')}`} />
            <stat.icon className={`w-12 h-12 mx-auto mb-4 ${stat.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
            <h3 className="text-2xl font-bold text-foreground mt-2">{stat.title}</h3>
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="glass-card p-8 rounded-2xl bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-l-4 border-l-blue-500"
      >
        <h3 className="font-bold text-2xl mb-6 text-foreground flex items-center gap-2">
          💡 Your AI Journey Starts Here
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl">
            <span className="text-xl font-bold text-blue-500 mb-2 block">1. Login</span>
            <p className="text-slate-600 dark:text-slate-400">Access your secure dashboard.</p>
          </div>
          <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl">
            <span className="text-xl font-bold text-primary mb-2 block">2. Profile</span>
            <p className="text-slate-600 dark:text-slate-400">Enter your skills to build your vector.</p>
          </div>
          <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl">
            <span className="text-xl font-bold text-emerald-500 mb-2 block">3. Matches</span>
            <p className="text-slate-600 dark:text-slate-400">Get cosine-similarity job recommendations.</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
