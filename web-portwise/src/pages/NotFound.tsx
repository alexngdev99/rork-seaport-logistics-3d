import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
    <div className="panel max-w-sm p-8 text-center">
      <p className="font-mono text-[44px] font-bold text-signal">404</p>
      <h1 className="mt-1 text-[18px] font-bold text-ink">Page not found</h1>
      <p className="mt-1 text-[13px] text-slate">This address isn't on the terminal map.</p>
      <Link to="/" className="mt-5 inline-flex h-10 items-center rounded-[11px] bg-ink px-4 text-[13.5px] font-semibold text-paper hover:bg-ink/90">
        Back to overview
      </Link>
    </div>
  </div>
);

export default NotFound;
