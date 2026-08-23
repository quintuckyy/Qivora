import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page state">
      <h1>Page not found</h1>
      <p>The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link to="/" className="btn btn-primary">
        Go home
      </Link>
    </div>
  );
}
