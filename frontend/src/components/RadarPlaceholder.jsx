export default function RadarPlaceholder() {
  return (
    <div className="h-72 flex flex-col items-center justify-center border border-dashed border-white/20 rounded-xl">
      <div className="text-5xl mb-3 text-cyan-400">🧠</div>
      <p className="text-white/60 mb-1">
        No permission data yet.
      </p>
      <span className="text-cyan-400 cursor-pointer hover:underline">
        Add roles to visualize graph
      </span>
    </div>
  )
}
