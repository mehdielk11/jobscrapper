export default function Home() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-slate-50 border p-10 rounded-lg text-center shadow-sm">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">💼 Job Offers Analyzer & Recommender</h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Moroccan job market intelligence powered by NLP and AI. Discover the jobs that directly match your unique skills seamlessly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="border p-6 rounded-lg shadow-sm text-center">
            <h3 className="text-lg font-medium text-slate-500">Total Jobs Scraped</h3>
            <p className="text-4xl font-bold text-primary mt-2">Live</p>
         </div>
         <div className="border p-6 rounded-lg shadow-sm text-center">
            <h3 className="text-lg font-medium text-slate-500">Skills Extracted</h3>
            <p className="text-4xl font-bold text-primary mt-2">NLP Analyzed</p>
         </div>
         <div className="border p-6 rounded-lg shadow-sm text-center">
            <h3 className="text-lg font-medium text-slate-500">Platforms</h3>
            <p className="text-4xl font-bold text-primary mt-2">6</p>
         </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
        <h3 className="font-semibold text-blue-800 text-xl mb-4">💡 Ready to get started?</h3>
        <ol className="list-decimal list-inside text-blue-900 space-y-2">
          <li>Login via the sidebar.</li>
          <li>Go to <strong>Profile</strong> to enter your skills.</li>
          <li>Check <strong>Recommendations</strong> for your targeted job matches.</li>
        </ol>
      </div>
    </div>
  )
}
