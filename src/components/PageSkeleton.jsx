// Placeholder shown while a page's real data is still loading: the same shapes
// as the finished page (title, hero panel, a few rows) so nothing jumps when it
// arrives. Shimmer comes from the .skeleton class.
export default function PageSkeleton() {
  return (
    <div className="ps" aria-busy="true" aria-label="Loading">
      <div className="skeleton ps-title" />
      <div className="skeleton ps-sub" />
      <div className="skeleton ps-hero" />
      <div className="ps-pair">
        <div className="skeleton ps-stat" />
        <div className="skeleton ps-stat" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="ps-row">
          <div className="skeleton ps-dot" />
          <div className="ps-lines">
            <div className="skeleton ps-line" />
            <div className="skeleton ps-line short" />
          </div>
          <div className="skeleton ps-amt" />
        </div>
      ))}
    </div>
  )
}
