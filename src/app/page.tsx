import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to watchlist (main dashboard)
  // Auth middleware will redirect to login if not authenticated
  redirect('/watchlist');
}
