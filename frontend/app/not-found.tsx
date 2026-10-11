import Link from 'next/link';
export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>This page is not part of RicozMetrics.</p>
      <Link href="/overview">Back to overview</Link>
    </main>
  );
}
