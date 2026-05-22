import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to dashboard (home page)
  // Auth middleware will redirect to login if not authenticated
  redirect('/dashboard');
}
