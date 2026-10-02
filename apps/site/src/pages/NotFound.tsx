import { Link } from "react-router-dom";
import { useTitle } from "../components/Docs";

export function NotFound({ inline }: { inline?: boolean }) {
  useTitle("Page not found");
  return (
    <div className={inline ? "not-found inline" : "not-found"}>
      <h1>Page not found</h1>
      <p>This page does not exist. It may have moved.</p>
      <p>
        <Link to="/docs/getting-started" className="btn primary">
          Go to the docs
        </Link>
      </p>
    </div>
  );
}
